/**
 * Neutral notification copy for medication and measurement reminders.
 * Accepts an optional translator so callers can localize without RN imports.
 */

import type { MessageKey } from '@/i18n/dictionaries'
import type { TranslateParams } from '@/i18n/translate'
import { translate } from '@/i18n/translate'

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string

const defaultT: TranslateFn = (key, params) => translate('ru', key, params)

/** @deprecated Prefer localized buildMeasurementReminderContent via t(). */
export const MEASUREMENT_REMINDER_TITLE = 'Пора измерить давление'
/** @deprecated Prefer localized body via t(). */
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
	t?: TranslateFn
}): { title: string; body: string } {
	const t = input.t ?? defaultT
	const baseTitle = t('notif.medication.title')
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
		? t('notif.medication.body', {
				name: input.medicationName,
				time: scheduleHm,
			})
		: input.dosageText?.trim()
			? `${input.medicationName} — ${input.dosageText.trim()}`
			: input.medicationName

	return { title, body }
}

/** Fixed copy for blood-pressure measurement reminders. */
export function buildMeasurementReminderContent(input?: {
	profileName?: string | null
	includeProfileName?: boolean
	t?: TranslateFn
}): { title: string; body: string } {
	const t = input?.t ?? defaultT
	const baseTitle = t('notif.measurement.title')
	const body = t('notif.measurement.body')
	const profileName = input?.profileName?.trim()
	const title =
		input?.includeProfileName && profileName
			? `${profileName} — ${baseTitle.toLowerCase()}`
			: baseTitle
	return { title, body }
}
