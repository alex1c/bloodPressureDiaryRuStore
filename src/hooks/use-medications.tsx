import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import type { Medication, MedicationIntake, Reminder } from '@/domain/types'
import {
	buildPlannedDosesForDay,
	findTakenIntakeForSlot,
	type PlannedDose,
	summarizeTodaysDoses,
} from '@/domain/medications/schedule'
import { useDiary } from '@/hooks/use-diary'
import {
	configureNotificationHandler,
	getNotificationPermissionState,
	requestNotificationPermission,
	type NotificationPermissionState,
} from '@/services/medication-notifications'
import {
	disableMedicationReminders,
	reconcileProfileNotifications,
	syncMedicationReminders,
} from '@/services/reconcile-medication-reminders'

type MedicationsContextValue = {
	medications: Medication[]
	intakes: MedicationIntake[]
	reminders: Reminder[]
	todayDoses: PlannedDose[]
	todaySummary: ReturnType<typeof summarizeTodaysDoses>
	permission: NotificationPermissionState
	refreshMedications: () => Promise<void>
	markTaken: (dose: PlannedDose) => Promise<MedicationIntake>
	undoTaken: (intakeId: string) => Promise<void>
	saveMedication: (input: {
		id?: string
		name: string
		dosageText: string
		schedule: { hour: number; minute: number }[]
		isActive: boolean
		remindEnabled: boolean
	}) => Promise<Medication>
	deactivateMedication: (id: string) => Promise<void>
	deleteMedicationPermanently: (id: string) => Promise<void>
	ensureNotificationPermission: () => Promise<NotificationPermissionState>
}

const MedicationsContext = createContext<MedicationsContextValue | null>(null)

/**
 * Medications + intakes for the active profile, with reminder reconciliation.
 */
export function MedicationsProvider({ children }: { children: ReactNode }) {
	const { ready, repos, profile } = useDiary()
	const [medications, setMedications] = useState<Medication[]>([])
	const [intakes, setIntakes] = useState<MedicationIntake[]>([])
	const [reminders, setReminders] = useState<Reminder[]>([])
	const [permission, setPermission] =
		useState<NotificationPermissionState>('undetermined')

	const refreshMedications = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		const [meds, intakeRows, reminderRows, perm] = await Promise.all([
			repos.medications.listByProfile(profile.id),
			repos.medicationIntakes.listByProfile(profile.id),
			repos.reminders.listByProfile(profile.id),
			getNotificationPermissionState(),
		])
		setMedications(meds)
		setIntakes(intakeRows)
		setReminders(reminderRows)
		setPermission(perm)
	}, [repos, profile])

	useEffect(() => {
		configureNotificationHandler()
	}, [])

	useEffect(() => {
		if (!ready || !repos || !profile) {
			return
		}
		let cancelled = false
		void (async () => {
			await reconcileProfileNotifications({
				repos,
				profileId: profile.id,
			})
			if (!cancelled) {
				await refreshMedications()
			}
		})()
		return () => {
			cancelled = true
		}
	}, [ready, repos, profile, refreshMedications])

	const todayDoses = useMemo(
		() => buildPlannedDosesForDay(medications, intakes, new Date()),
		[medications, intakes],
	)
	const todaySummary = useMemo(
		() => summarizeTodaysDoses(todayDoses),
		[todayDoses],
	)

	const markTaken = useCallback(
		async (dose: PlannedDose) => {
			if (!repos || !profile) {
				throw new Error('Diary is not ready')
			}
			const existing = findTakenIntakeForSlot(
				intakes,
				dose.medicationId,
				dose.hour,
				dose.minute,
				new Date(),
			)
			if (existing) {
				return existing
			}
			const created = await repos.medicationIntakes.create({
				profileId: profile.id,
				medicationId: dose.medicationId,
				takenAt: new Date().toISOString(),
				scheduledHour: dose.hour,
				scheduledMinute: dose.minute,
				taken: true,
				note: null,
			})
			await refreshMedications()
			return created
		},
		[repos, profile, intakes, refreshMedications],
	)

	const undoTaken = useCallback(
		async (intakeId: string) => {
			if (!repos) {
				return
			}
			await repos.medicationIntakes.delete(intakeId)
			await refreshMedications()
		},
		[repos, refreshMedications],
	)

	const ensureNotificationPermission = useCallback(async () => {
		const next = await requestNotificationPermission()
		setPermission(next)
		return next
	}, [])

	const saveMedication = useCallback(
		async (input: {
			id?: string
			name: string
			dosageText: string
			schedule: { hour: number; minute: number }[]
			isActive: boolean
			remindEnabled: boolean
		}) => {
			if (!repos || !profile) {
				throw new Error('Diary is not ready')
			}

			if (input.remindEnabled) {
				await ensureNotificationPermission()
			}

			let medication: Medication
			if (input.id) {
				medication = await repos.medications.update(input.id, {
					name: input.name.trim(),
					dosageText: input.dosageText.trim(),
					schedule: input.schedule,
					isActive: input.isActive,
				})
			} else {
				medication = await repos.medications.create({
					profileId: profile.id,
					name: input.name.trim(),
					dosageText: input.dosageText.trim(),
					schedule: input.schedule,
					isActive: input.isActive,
				})
			}

			if (input.remindEnabled && medication.isActive) {
				await syncMedicationReminders({
					repos,
					medication,
					remindEnabled: true,
				})
			} else {
				await syncMedicationReminders({
					repos,
					medication,
					remindEnabled: false,
				})
				await disableMedicationReminders({
					repos,
					profileId: profile.id,
					medicationId: medication.id,
				})
			}

			await reconcileProfileNotifications({
				repos,
				profileId: profile.id,
			})
			await refreshMedications()
			return medication
		},
		[repos, profile, ensureNotificationPermission, refreshMedications],
	)

	const deactivateMedication = useCallback(
		async (id: string) => {
			if (!repos || !profile) {
				return
			}
			const medication = await repos.medications.update(id, {
				isActive: false,
			})
			await syncMedicationReminders({
				repos,
				medication,
				remindEnabled: false,
			})
			await reconcileProfileNotifications({
				repos,
				profileId: profile.id,
			})
			await refreshMedications()
		},
		[repos, profile, refreshMedications],
	)

	const deleteMedicationPermanently = useCallback(
		async (id: string) => {
			if (!repos || !profile) {
				return
			}
			const linked = (
				await repos.reminders.listByProfile(profile.id)
			).filter((r) => r.medicationId === id)
			for (const reminder of linked) {
				const { cancelPlatformNotification } = await import(
					'@/services/medication-notifications'
				)
				await cancelPlatformNotification(reminder.platformNotificationId)
			}
			await repos.medications.delete(id)
			await reconcileProfileNotifications({
				repos,
				profileId: profile.id,
			})
			await refreshMedications()
		},
		[repos, profile, refreshMedications],
	)

	const value = useMemo(
		() => ({
			medications,
			intakes,
			reminders,
			todayDoses,
			todaySummary,
			permission,
			refreshMedications,
			markTaken,
			undoTaken,
			saveMedication,
			deactivateMedication,
			deleteMedicationPermanently,
			ensureNotificationPermission,
		}),
		[
			medications,
			intakes,
			reminders,
			todayDoses,
			todaySummary,
			permission,
			refreshMedications,
			markTaken,
			undoTaken,
			saveMedication,
			deactivateMedication,
			deleteMedicationPermanently,
			ensureNotificationPermission,
		],
	)

	return (
		<MedicationsContext.Provider value={value}>
			{children}
		</MedicationsContext.Provider>
	)
}

export function useMedications(): MedicationsContextValue {
	const ctx = useContext(MedicationsContext)
	if (!ctx) {
		throw new Error('useMedications must be used within MedicationsProvider')
	}
	return ctx
}
