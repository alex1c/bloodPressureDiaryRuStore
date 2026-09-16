/**
 * Packs / unpacks platform notification ids stored on Reminder.platformNotificationId.
 * Measurement reminders with selected weekdays may need several WEEKLY schedules.
 */

/** Serializes one or many platform notification ids for DB storage. */
export function packPlatformNotificationIds(
	ids: (string | null | undefined)[],
): string | null {
	const clean = ids.filter((id): id is string => Boolean(id && id.trim()))
	if (clean.length === 0) {
		return null
	}
	if (clean.length === 1) {
		return clean[0]!
	}
	return JSON.stringify(clean)
}

/** Parses a stored platformNotificationId field into a list of ids. */
export function unpackPlatformNotificationIds(
	raw: string | null | undefined,
): string[] {
	if (!raw || !raw.trim()) {
		return []
	}
	const trimmed = raw.trim()
	if (trimmed.startsWith('[')) {
		try {
			const parsed = JSON.parse(trimmed) as unknown
			if (Array.isArray(parsed)) {
				return parsed.filter((id): id is string => typeof id === 'string')
			}
		} catch {
			return [trimmed]
		}
	}
	return [trimmed]
}

/**
 * Maps JS getDay() (0=Sun…6=Sat) to expo-notifications WEEKLY weekday (1=Sun…7=Sat).
 */
export function jsWeekdayToExpoWeekday(jsDay: number): number {
	return jsDay + 1
}

/** True when the reminder should fire every calendar day. */
export function isEveryDayWeekdays(weekdays: number[]): boolean {
	const set = new Set(weekdays)
	return [0, 1, 2, 3, 4, 5, 6].every((d) => set.has(d))
}
