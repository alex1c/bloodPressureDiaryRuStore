import type { Reminder } from '@/domain/types'
import { DAILY_WEEKDAYS, formatScheduleHm } from '@/domain/medications/schedule'
import type { DiaryRepositories } from '@/storage/repositories/types'
import {
	buildMeasurementReminderContent,
	cancelPlatformNotification,
	getNotificationPermissionState,
	requestNotificationPermission,
} from '@/services/medication-notifications'
import { reconcileAllProfileNotifications } from '@/services/reconcile-medication-reminders'

/** Lists measurement reminders (medicationId === null) for a profile. */
export function filterMeasurementReminders(reminders: Reminder[]): Reminder[] {
	return reminders.filter((r) => r.medicationId == null)
}

export type UpsertMeasurementReminderInput = {
	repos: DiaryRepositories
	profileId: string
	id?: string
	hour: number
	minute: number
	weekdays: number[]
	enabled: boolean
}

/**
 * Creates or updates a measurement reminder and reconciles platform schedules.
 * Requests notification permission only when enabling.
 */
export async function upsertMeasurementReminder(
	input: UpsertMeasurementReminderInput,
): Promise<Reminder> {
	const weekdays =
		input.weekdays.length > 0 ? input.weekdays : [...DAILY_WEEKDAYS]
	const profiles = await input.repos.profiles.list()
	const includeProfileName = profiles.length > 1
	const profileName =
		profiles.find((p) => p.id === input.profileId)?.name ?? ''
	const content = buildMeasurementReminderContent({
		profileName,
		includeProfileName,
	})

	if (input.enabled) {
		await requestNotificationPermission()
	}

	let row: Reminder
	if (input.id) {
		const existing = (
			await input.repos.reminders.listByProfile(input.profileId)
		).find((r) => r.id === input.id && r.medicationId == null)
		if (!existing) {
			throw new Error('Measurement reminder not found')
		}
		await cancelPlatformNotification(existing.platformNotificationId)
		row = await input.repos.reminders.update(existing.id, {
			title: content.title,
			body: content.body,
			hour: input.hour,
			minute: input.minute,
			weekdays,
			enabled: input.enabled,
			platformNotificationId: null,
			medicationId: null,
		})
	} else {
		row = await input.repos.reminders.create({
			profileId: input.profileId,
			medicationId: null,
			title: content.title,
			body: content.body,
			hour: input.hour,
			minute: input.minute,
			weekdays,
			enabled: input.enabled,
			platformNotificationId: null,
		})
	}

	await reconcileAllProfileNotifications({ repos: input.repos })
	const refreshed = (
		await input.repos.reminders.listByProfile(input.profileId)
	).find((r) => r.id === row.id)
	return refreshed ?? row
}

/** Deletes a measurement reminder and cancels its platform notification. */
export async function deleteMeasurementReminder(input: {
	repos: DiaryRepositories
	profileId: string
	id: string
}): Promise<void> {
	const existing = (
		await input.repos.reminders.listByProfile(input.profileId)
	).find((r) => r.id === input.id && r.medicationId == null)
	if (!existing) {
		return
	}
	await cancelPlatformNotification(existing.platformNotificationId)
	await input.repos.reminders.delete(existing.id)
	await reconcileAllProfileNotifications({ repos: input.repos })
}

/** Toggles enabled flag and reschedules. */
export async function setMeasurementReminderEnabled(input: {
	repos: DiaryRepositories
	profileId: string
	id: string
	enabled: boolean
}): Promise<Reminder | null> {
	const existing = (
		await input.repos.reminders.listByProfile(input.profileId)
	).find((r) => r.id === input.id && r.medicationId == null)
	if (!existing) {
		return null
	}
	return upsertMeasurementReminder({
		repos: input.repos,
		profileId: input.profileId,
		id: existing.id,
		hour: existing.hour,
		minute: existing.minute,
		weekdays: existing.weekdays,
		enabled: input.enabled,
	})
}

/** Human-readable HH:mm for a reminder. */
export function formatReminderHm(input: {
	hour: number
	minute: number
}): string {
	return formatScheduleHm({ hour: input.hour, minute: input.minute })
}

/** Short Russian weekday labels (Sun…Sat order matching JS getDay). */
export const WEEKDAY_LABELS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const

export function formatWeekdaysRu(weekdays: number[]): string {
	if (isEveryDay(weekdays)) {
		return 'Каждый день'
	}
	return [...weekdays]
		.sort((a, b) => a - b)
		.map((d) => WEEKDAY_LABELS_RU[d] ?? '?')
		.join(', ')
}

function isEveryDay(weekdays: number[]): boolean {
	const set = new Set(weekdays)
	return [0, 1, 2, 3, 4, 5, 6].every((d) => set.has(d))
}

export async function getReminderPermissionLabel(): Promise<{
	permission: string
	denied: boolean
}> {
	const permission = await getNotificationPermissionState()
	return { permission, denied: permission === 'denied' }
}
