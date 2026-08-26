/**
 * Local-calendar day helpers.
 * Storage keeps ISO UTC; "today" and list grouping use the device local day.
 */

/** Formats a Date as local YYYY-MM-DD. */
export function formatLocalDayKey(date: Date): string {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

/** Local day key for an ISO timestamp string. */
export function localDayKeyFromIso(iso: string): string {
	return formatLocalDayKey(new Date(iso))
}

/**
 * Inclusive local-day bounds as ISO strings suitable for measuredAt filtering.
 * Handles DST by constructing local midnight via Date(y, m, d).
 */
export function getLocalDayBounds(reference: Date = new Date()): {
	dayKey: string
	fromIso: string
	toIso: string
} {
	const start = new Date(
		reference.getFullYear(),
		reference.getMonth(),
		reference.getDate(),
		0,
		0,
		0,
		0,
	)
	const end = new Date(
		reference.getFullYear(),
		reference.getMonth(),
		reference.getDate(),
		23,
		59,
		59,
		999,
	)
	return {
		dayKey: formatLocalDayKey(reference),
		fromIso: start.toISOString(),
		toIso: end.toISOString(),
	}
}

/** True when the ISO timestamp falls on the same local calendar day as reference. */
export function isIsoOnLocalDay(iso: string, reference: Date = new Date()): boolean {
	return localDayKeyFromIso(iso) === formatLocalDayKey(reference)
}

/**
 * Russian long date for diary headers, e.g. «26 августа».
 * Kept simple — no dependency on Intl locale data edge cases beyond ru-RU.
 */
export function formatRussianLongDate(date: Date): string {
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
	})
}

/** Local HH:mm for diary rows. */
export function formatLocalTime(iso: string): string {
	const date = new Date(iso)
	const h = String(date.getHours()).padStart(2, '0')
	const m = String(date.getMinutes()).padStart(2, '0')
	return `${h}:${m}`
}

/** Builds ISO from a local calendar date + HH:mm strings. */
export function isoFromLocalDateAndTime(
	dayKey: string,
	timeHm: string,
): string | null {
	const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim())
	const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim())
	if (!dayMatch || !timeMatch) {
		return null
	}
	const year = Number(dayMatch[1])
	const month = Number(dayMatch[2]) - 1
	const day = Number(dayMatch[3])
	const hour = Number(timeMatch[1])
	const minute = Number(timeMatch[2])
	if (
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59 ||
		month < 0 ||
		month > 11 ||
		day < 1 ||
		day > 31
	) {
		return null
	}
	const date = new Date(year, month, day, hour, minute, 0, 0)
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month ||
		date.getDate() !== day
	) {
		return null
	}
	return date.toISOString()
}
