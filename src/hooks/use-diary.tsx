import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import type { HealthMetric, HealthMetricKind, Measurement, Profile } from '@/domain/types'
import { getLocalDayBounds } from '@/domain/dates/local-day'
import { DEFAULT_ENABLED_METRIC_KINDS } from '@/domain/health/metric-catalog'
import { openDiaryDatabase } from '@/storage/sqlite/open-diary-database'
import type { DiaryRepositories } from '@/storage/repositories/types'

type DiaryContextValue = {
	ready: boolean
	error: string | null
	repos: DiaryRepositories | null
	/** Currently selected profile (persisted via settings.activeProfileId). */
	profile: Profile | null
	/** All family profiles, newest create order from repo. */
	profiles: Profile[]
	todayMeasurements: Measurement[]
	/** All measurements for the active profile (newest first from repo). */
	profileMeasurements: Measurement[]
	/** Enabled optional metric kinds for the active profile. */
	enabledMetricKinds: HealthMetricKind[]
	/** Health metrics for the active profile (newest first). */
	healthMetrics: HealthMetric[]
	refreshToday: () => Promise<void>
	refreshAll: () => Promise<void>
	refreshHealth: () => Promise<void>
	refreshProfiles: () => Promise<void>
	/** Persist active profile and reload diary / health for that profile. */
	switchProfile: (profileId: string) => Promise<void>
	/** Reload all UI state after a full backup restore. */
	reloadAfterRestore: () => Promise<void>
	createProfile: (name: string) => Promise<Profile>
	renameProfile: (profileId: string, name: string) => Promise<Profile>
	/**
	 * Cascading delete. Refuses when only one profile remains.
	 * Switches active profile to a fallback when the deleted one was active.
	 */
	deleteProfile: (profileId: string) => Promise<void>
	setEnabledMetricKinds: (kinds: HealthMetricKind[]) => Promise<void>
}

const DiaryContext = createContext<DiaryContextValue | null>(null)

async function loadMeasurementsForProfile(
	repos: DiaryRepositories,
	profileId: string,
): Promise<{ today: Measurement[]; all: Measurement[] }> {
	const { fromIso, toIso } = getLocalDayBounds(new Date())
	const [today, all] = await Promise.all([
		repos.measurements.listByProfileInRange(profileId, fromIso, toIso),
		repos.measurements.listByProfile(profileId),
	])
	return { today, all }
}

/**
 * Opens SQLite, ensures a default profile, exposes today + full profile history,
 * family profile switching, and per-profile health metric settings.
 */
export function DiaryProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [repos, setRepos] = useState<DiaryRepositories | null>(null)
	const [profile, setProfile] = useState<Profile | null>(null)
	const [profiles, setProfiles] = useState<Profile[]>([])
	const [todayMeasurements, setTodayMeasurements] = useState<Measurement[]>(
		[],
	)
	const [profileMeasurements, setProfileMeasurements] = useState<
		Measurement[]
	>([])
	const [enabledMetricKinds, setEnabledKindsState] = useState<
		HealthMetricKind[]
	>([...DEFAULT_ENABLED_METRIC_KINDS])
	const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([])

	const applyProfileData = useCallback(
		async (database: DiaryRepositories, active: Profile) => {
			const { today, all } = await loadMeasurementsForProfile(
				database,
				active.id,
			)
			const [settingsRow, metrics] = await Promise.all([
				database.profileMetricSettings.get(active.id),
				database.healthMetrics.listByProfile(active.id),
			])
			setProfile(active)
			setTodayMeasurements(today)
			setProfileMeasurements(all)
			setEnabledKindsState(settingsRow.enabledKinds)
			setHealthMetrics(metrics)
		},
		[],
	)

	const refreshProfiles = useCallback(async () => {
		if (!repos) {
			return
		}
		const list = await repos.profiles.list()
		setProfiles(list)
	}, [repos])

	const refreshAll = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		const { today, all } = await loadMeasurementsForProfile(repos, profile.id)
		setTodayMeasurements(today)
		setProfileMeasurements(all)
	}, [repos, profile])

	const refreshToday = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		const { fromIso, toIso } = getLocalDayBounds(new Date())
		const rows = await repos.measurements.listByProfileInRange(
			profile.id,
			fromIso,
			toIso,
		)
		setTodayMeasurements(rows)
	}, [repos, profile])

	const refreshHealth = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		const [settingsRow, metrics] = await Promise.all([
			repos.profileMetricSettings.get(profile.id),
			repos.healthMetrics.listByProfile(profile.id),
		])
		setEnabledKindsState(settingsRow.enabledKinds)
		setHealthMetrics(metrics)
	}, [repos, profile])

	const reloadAfterRestore = useCallback(async () => {
		if (!repos) {
			return
		}
		const list = await repos.profiles.list()
		setProfiles(list)
		const settings = await repos.settings.get()
		let active =
			settings.activeProfileId !== null
				? await repos.profiles.getById(settings.activeProfileId)
				: null
		if (!active) {
			active = list.find((p) => p.isDefault) ?? list[0] ?? null
		}
		if (!active) {
			throw new Error('No profile after restore')
		}
		if (settings.activeProfileId !== active.id) {
			await repos.settings.update({ activeProfileId: active.id })
		}
		setTodayMeasurements([])
		setProfileMeasurements([])
		setHealthMetrics([])
		await applyProfileData(repos, active)
	}, [repos, applyProfileData])

	const switchProfile = useCallback(
		async (profileId: string) => {
			if (!repos) {
				return
			}
			const next = await repos.profiles.getById(profileId)
			if (!next) {
				throw new Error(`Profile not found: ${profileId}`)
			}
			// Clear stale UI immediately so Graphs/Meds never flash another profile.
			setTodayMeasurements([])
			setProfileMeasurements([])
			setHealthMetrics([])
			await repos.settings.update({ activeProfileId: next.id })
			await applyProfileData(repos, next)
			await refreshProfiles()
		},
		[repos, applyProfileData, refreshProfiles],
	)

	const createProfile = useCallback(
		async (name: string) => {
			if (!repos) {
				throw new Error('Diary is not ready')
			}
			const trimmed = name.trim()
			if (!trimmed) {
				throw new Error('Profile name is required')
			}
			const created = await repos.profiles.create({
				name: trimmed,
				isDefault: false,
			})
			await refreshProfiles()
			return created
		},
		[repos, refreshProfiles],
	)

	const renameProfile = useCallback(
		async (profileId: string, name: string) => {
			if (!repos) {
				throw new Error('Diary is not ready')
			}
			const trimmed = name.trim()
			if (!trimmed) {
				throw new Error('Profile name is required')
			}
			const updated = await repos.profiles.update(profileId, {
				name: trimmed,
			})
			if (profile?.id === profileId) {
				setProfile(updated)
			}
			await refreshProfiles()
			return updated
		},
		[repos, profile, refreshProfiles],
	)

	const deleteProfile = useCallback(
		async (profileId: string) => {
			if (!repos) {
				throw new Error('Diary is not ready')
			}
			const list = await repos.profiles.list()
			if (list.length <= 1) {
				throw new Error('Cannot delete the last profile')
			}
			await repos.profiles.delete(profileId)
			const settings = await repos.settings.get()
			const nextId = settings.activeProfileId
			const next =
				(nextId ? await repos.profiles.getById(nextId) : null) ??
				(await repos.profiles.list())[0]
			if (!next) {
				throw new Error('No profile available after delete')
			}
			setTodayMeasurements([])
			setProfileMeasurements([])
			setHealthMetrics([])
			await applyProfileData(repos, next)
			await refreshProfiles()
		},
		[repos, applyProfileData, refreshProfiles],
	)

	const setEnabledMetricKinds = useCallback(
		async (kinds: HealthMetricKind[]) => {
			if (!repos || !profile) {
				throw new Error('Diary is not ready')
			}
			const next = await repos.profileMetricSettings.setEnabledKinds(
				profile.id,
				kinds,
			)
			setEnabledKindsState(next.enabledKinds)
		},
		[repos, profile],
	)

	useEffect(() => {
		let cancelled = false

		async function boot() {
			try {
				const database = await openDiaryDatabase()
				if (cancelled) {
					return
				}

				const settings = await database.settings.get()
				let active =
					settings.activeProfileId !== null
						? await database.profiles.getById(settings.activeProfileId)
						: null

				if (!active) {
					const existing = await database.profiles.list()
					active = existing.find((p) => p.isDefault) ?? existing[0] ?? null
				}

				if (!active) {
					active = await database.profiles.create({
						name: 'Я',
						isDefault: true,
					})
					await database.settings.update({ activeProfileId: active.id })
				} else if (settings.activeProfileId !== active.id) {
					await database.settings.update({ activeProfileId: active.id })
				}

				if (cancelled) {
					return
				}

				const list = await database.profiles.list()
				setRepos(database)
				setProfiles(list)
				await applyProfileData(database, active)
				setReady(true)
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : 'Не удалось открыть дневник',
					)
					setReady(true)
				}
			}
		}

		void boot()
		return () => {
			cancelled = true
		}
	}, [applyProfileData])

	const value = useMemo(
		() => ({
			ready,
			error,
			repos,
			profile,
			profiles,
			todayMeasurements,
			profileMeasurements,
			enabledMetricKinds,
			healthMetrics,
			refreshToday,
			refreshAll,
			refreshHealth,
			refreshProfiles,
			switchProfile,
			reloadAfterRestore,
			createProfile,
			renameProfile,
			deleteProfile,
			setEnabledMetricKinds,
		}),
		[
			ready,
			error,
			repos,
			profile,
			profiles,
			todayMeasurements,
			profileMeasurements,
			enabledMetricKinds,
			healthMetrics,
			refreshToday,
			refreshAll,
			refreshHealth,
			refreshProfiles,
			switchProfile,
			reloadAfterRestore,
			createProfile,
			renameProfile,
			deleteProfile,
			setEnabledMetricKinds,
		],
	)

	return (
		<DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>
	)
}

export function useDiary(): DiaryContextValue {
	const ctx = useContext(DiaryContext)
	if (!ctx) {
		throw new Error('useDiary must be used within DiaryProvider')
	}
	return ctx
}
