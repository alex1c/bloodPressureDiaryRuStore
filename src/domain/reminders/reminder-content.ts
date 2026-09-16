/**
 * Neutral notification copy for medication and measurement reminders.
 * Kept free of React Native imports so unit tests stay lightweight.
 */

/** Fixed measurement reminder title/body. */
export const MEASUREMENT_REMINDER_TITLE = 'Пора измерить давление'
export const MEASUREMENT_REMINDER_BODY =
	'Если сейчас удобно, запишите новое измерение в дневник.'

/**
 * Neutral copy for local medication reminders — never medical advice.
 * When multiple profiles exist, prefix the title with the profile name.
 */
export function buildReminderContent(input: {
	medicationName: string
	/** @deprecated Prefer scheduleHm — kept for older call sites. */
	dosageText?: string
	/** Local wall-clock HH:mm shown in the body. */
	scheduleHm?: string
	hour?: number
	minute?: number
	profileName?: string | null
	/** When true, include profile name in the title even for a single profile. */
	includeProfileName?: boolean
}): { title: string; body: string } {
	const baseTitle = 'Напоминание о лекарстве'
	const profileName = input.profileName?.trim()
	const title =
		input.includeProfileName && profileName
			? `${profileName} — ${baseTitle.toLowerCase()}`
			: baseTitle

	const scheduleHm =
		input.scheduleHm ??
		(typeof input.hour === 'number' && typeof input.minute === 'number'
			? `${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`
			: null)

	const body = scheduleHm
		? `${input.medicationName} — запланированный приём в ${scheduleHm}`
		: input.dosageText?.trim()
			? `${input.medicationName} — ${input.dosageText.trim()}`
			: input.medicationName

	return { title, body }
}

/** Fixed copy for blood-pressure measurement reminders. */
export function buildMeasurementReminderContent(input?: {
	profileName?: string | null
	includeProfileName?: boolean
}): { title: string; body: string } {
	const profileName = input?.profileName?.trim()
	const title =
		input?.includeProfileName && profileName
			? `${profileName} — ${MEASUREMENT_REMINDER_TITLE.toLowerCase()}`
			: MEASUREMENT_REMINDER_TITLE
	return { title, body: MEASUREMENT_REMINDER_BODY }
}
