/**
 * Rebuilds multi-profile reminder titles for the active UI locale.
 * Pure helper (no react-native) so reconcile + tests share one path.
 */
import type { Profile, Reminder } from '@/domain/types'
import {
	buildMeasurementReminderContent,
	buildReminderContent,
} from '@/domain/reminders/reminder-content'
import { formatScheduleHm } from '@/domain/medications/schedule'
import type { MessageKey } from '@/i18n/dictionaries'
import type { TranslateParams } from '@/i18n/translate'

type ReminderTranslator = (
	key: MessageKey,
	params?: TranslateParams,
) => string

/**
 * Rebuilds multi-profile medication/measurement titles using the active locale
 * translator. Returning null leaves the row title unchanged (already refreshed
 * by refreshReminderCopyForLocale for single-profile cases).
 */
export function buildTitleForStoredReminder(
	reminder: Reminder,
	profile: Profile | undefined,
	includeProfileName: boolean,
	t?: ReminderTranslator,
): string | null {
	if (!includeProfileName || !profile) {
		return null
	}

	if (reminder.medicationId == null) {
		return buildMeasurementReminderContent({
			profileName: profile.name,
			includeProfileName: true,
			t,
		}).title
	}

	const bodyParts = (reminder.body ?? '').split(' — ')
	const medicationName = bodyParts[0] ?? ''
	return buildReminderContent({
		medicationName,
		scheduleHm: formatScheduleHm({
			hour: reminder.hour,
			minute: reminder.minute,
		}),
		profileName: profile.name,
		includeProfileName: true,
		t,
	}).title
}
