import type { Medication, Reminder } from '@/domain/types'
import {
	DAILY_WEEKDAYS,
	formatScheduleHm,
} from '@/domain/medications/schedule'
import type { DiaryRepositories } from '@/storage/repositories/types'
import {
	buildReminderContent,
	cancelAllScheduledNotifications,
	cancelPlatformNotification,
	getNotificationPermissionState,
	scheduleDailyReminderNotification,
} from '@/services/medication-notifications'

/**
 * Syncs Reminder rows for one medication to match its schedule + remind flag.
 * Does not delete intake history. Cancels orphan platform notifications.
 */
export async function syncMedicationReminders(input: {
	repos: DiaryRepositories
	medication: Medication
	remindEnabled: boolean
}): Promise<Reminder[]> {
	const { repos, medication, remindEnabled } = input
	const existing = (
		await repos.reminders.listByProfile(medication.profileId)
	).filter((r) => r.medicationId === medication.id)

	const desiredKeys = new Set(
		remindEnabled && medication.isActive
			? medication.schedule.map((t) => formatScheduleHm(t))
			: [],
	)

	const content = buildReminderContent({
		medicationName: medication.name,
		dosageText: medication.dosageText,
	})

	const kept: Reminder[] = []

	for (const reminder of existing) {
		const key = formatScheduleHm({
			hour: reminder.hour,
			minute: reminder.minute,
		})
		if (!desiredKeys.has(key)) {
			await cancelPlatformNotification(reminder.platformNotificationId)
			await repos.reminders.delete(reminder.id)
			continue
		}
		desiredKeys.delete(key)
		const updated = await repos.reminders.update(reminder.id, {
			title: content.title,
			body: content.body,
			enabled: true,
			weekdays: [...DAILY_WEEKDAYS],
			hour: reminder.hour,
			minute: reminder.minute,
		})
		kept.push(updated)
	}

	for (const time of medication.schedule) {
		const key = formatScheduleHm(time)
		if (!desiredKeys.has(key)) {
			continue
		}
		const created = await repos.reminders.create({
			profileId: medication.profileId,
			medicationId: medication.id,
			title: content.title,
			body: content.body,
			hour: time.hour,
			minute: time.minute,
			weekdays: [...DAILY_WEEKDAYS],
			enabled: true,
			platformNotificationId: null,
		})
		kept.push(created)
		desiredKeys.delete(key)
	}

	return kept
}

/**
 * Idempotent: cancel all scheduled notifications, then reschedule enabled
 * reminders for the active profile when OS permission is granted.
 */
export async function reconcileProfileNotifications(input: {
	repos: DiaryRepositories
	profileId: string
}): Promise<{ scheduled: number; permission: string }> {
	const { repos, profileId } = input
	await cancelAllScheduledNotifications()

	const permission = await getNotificationPermissionState()
	const reminders = (await repos.reminders.listByProfile(profileId)).filter(
		(r) => r.enabled,
	)

	// Clear stale platform ids first.
	for (const reminder of reminders) {
		if (reminder.platformNotificationId) {
			await repos.reminders.update(reminder.id, {
				platformNotificationId: null,
			})
		}
	}

	if (permission !== 'granted') {
		return { scheduled: 0, permission }
	}

	let scheduled = 0
	const fresh = (await repos.reminders.listByProfile(profileId)).filter(
		(r) => r.enabled,
	)
	for (const reminder of fresh) {
		const platformId = await scheduleDailyReminderNotification(reminder)
		await repos.reminders.update(reminder.id, {
			platformNotificationId: platformId,
		})
		if (platformId) {
			scheduled += 1
		}
	}

	return { scheduled, permission }
}

/**
 * Disables reminders for a medication (deactivate / remind off) and cancels
 * platform notifications for those rows.
 */
export async function disableMedicationReminders(input: {
	repos: DiaryRepositories
	profileId: string
	medicationId: string
}): Promise<void> {
	const reminders = (
		await input.repos.reminders.listByProfile(input.profileId)
	).filter((r) => r.medicationId === input.medicationId)

	for (const reminder of reminders) {
		await cancelPlatformNotification(reminder.platformNotificationId)
		await input.repos.reminders.update(reminder.id, {
			enabled: false,
			platformNotificationId: null,
		})
	}
}
