/**
 * Rebuilds persisted reminder title/body for the active UI locale, then
 * callers should reconcile platform notifications.
 */
import type { AppLocale } from '@/i18n'
import { createTranslator } from '@/i18n'
import {
	buildMeasurementReminderContent,
	buildReminderContent,
} from '@/domain/reminders/reminder-content'
import { formatScheduleHm } from '@/domain/medications/schedule'
import type { DiaryRepositories } from '@/storage/repositories/types'

/**
 * Updates every reminder row's title/body to match the given locale,
 * preserving schedule, enabled state, weekdays, and medication links.
 */
export async function refreshReminderCopyForLocale(input: {
	repos: DiaryRepositories
	locale: AppLocale
}): Promise<number> {
	const { repos, locale } = input
	const t = createTranslator(locale)
	const profiles = await repos.profiles.list()
	const includeProfileName = profiles.length > 1
	const profileById = new Map(profiles.map((p) => [p.id, p]))
	const meds = (
		await Promise.all(profiles.map((p) => repos.medications.listByProfile(p.id)))
	).flat()
	const medById = new Map(meds.map((m) => [m.id, m]))

	let updated = 0
	for (const profile of profiles) {
		const reminders = await repos.reminders.listByProfile(profile.id)
		for (const reminder of reminders) {
			const profileName = profileById.get(reminder.profileId)?.name ?? null
			if (reminder.medicationId == null) {
				const content = buildMeasurementReminderContent({
					profileName,
					includeProfileName,
					t,
				})
				await repos.reminders.update(reminder.id, {
					title: content.title,
					body: content.body,
				})
				updated += 1
				continue
			}

			const medication = medById.get(reminder.medicationId)
				const medicationName = medication?.name ?? (reminder.body ?? '').split(' — ')[0] ?? ''
			const content = buildReminderContent({
				medicationName,
				scheduleHm: formatScheduleHm({
					hour: reminder.hour,
					minute: reminder.minute,
				}),
				profileName,
				includeProfileName,
				t,
			})
			await repos.reminders.update(reminder.id, {
				title: content.title,
				body: content.body,
			})
			updated += 1
		}
	}
	return updated
}
