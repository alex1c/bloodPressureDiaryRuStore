import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import type { Measurement, Profile } from '@/domain/types'
import { getLocalDayBounds } from '@/domain/dates/local-day'
import { openDiaryDatabase } from '@/storage/sqlite/open-diary-database'
import type { DiaryRepositories } from '@/storage/repositories/types'

type DiaryContextValue = {
	ready: boolean
	error: string | null
	repos: DiaryRepositories | null
	profile: Profile | null
	todayMeasurements: Measurement[]
	/** All measurements for the active profile (newest first from repo). */
	profileMeasurements: Measurement[]
	refreshToday: () => Promise<void>
	refreshAll: () => Promise<void>
}

const DiaryContext = createContext<DiaryContextValue | null>(null)

/**
 * Opens SQLite, ensures a default profile, exposes today + full profile history.
 */
export function DiaryProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [repos, setRepos] = useState<DiaryRepositories | null>(null)
	const [profile, setProfile] = useState<Profile | null>(null)
	const [todayMeasurements, setTodayMeasurements] = useState<Measurement[]>(
		[],
	)
	const [profileMeasurements, setProfileMeasurements] = useState<
		Measurement[]
	>([])

	const refreshAll = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		const { fromIso, toIso } = getLocalDayBounds(new Date())
		const [today, all] = await Promise.all([
			repos.measurements.listByProfileInRange(profile.id, fromIso, toIso),
			repos.measurements.listByProfile(profile.id),
		])
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

				setRepos(database)
				setProfile(active)
				const { fromIso, toIso } = getLocalDayBounds(new Date())
				const [today, all] = await Promise.all([
					database.measurements.listByProfileInRange(
						active.id,
						fromIso,
						toIso,
					),
					database.measurements.listByProfile(active.id),
				])
				setTodayMeasurements(today)
				setProfileMeasurements(all)
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
	}, [])

	const value = useMemo(
		() => ({
			ready,
			error,
			repos,
			profile,
			todayMeasurements,
			profileMeasurements,
			refreshToday,
			refreshAll,
		}),
		[
			ready,
			error,
			repos,
			profile,
			todayMeasurements,
			profileMeasurements,
			refreshToday,
			refreshAll,
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
