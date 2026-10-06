import type { AppLocale } from './locale'
import { toIntlLocale } from './locale'

/** Locale-aware long date for diary headers (day + month name). */
export function formatLongDate(date: Date, locale: AppLocale): string {
	return date.toLocaleDateString(toIntlLocale(locale), {
		day: 'numeric',
		month: 'long',
	})
}

/** Locale-aware short date (day.month or locale equivalent). */
export function formatShortDate(date: Date, locale: AppLocale): string {
	return date.toLocaleDateString(toIntlLocale(locale), {
		day: 'numeric',
		month: 'short',
	})
}

/** Locale-aware date+time for settings backup preview. */
export function formatDateTime(date: Date, locale: AppLocale): string {
	const datePart = formatLongDate(date, locale)
	const h = String(date.getHours()).padStart(2, '0')
	const m = String(date.getMinutes()).padStart(2, '0')
	return `${datePart}, ${h}:${m}`
}

/**
 * @deprecated Prefer formatLongDate(date, locale). Kept for gradual migration
 * of call sites that still assume Russian presentation.
 */
export function formatRussianLongDate(date: Date): string {
	return formatLongDate(date, 'ru')
}
