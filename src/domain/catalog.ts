import type { MeasurementTag, PeriodOfDay } from './types'

/** Preset tags shown in the measurement form (order is UI order). */
export const MEASUREMENT_TAGS: readonly MeasurementTag[] = [
	'normal',
	'headache',
	'lack_of_sleep',
	'stress',
	'coffee',
	'physical_activity',
] as const

/** Russian labels for preset tags — presentation helper, not medical copy. */
export const MEASUREMENT_TAG_LABELS_RU: Record<MeasurementTag, string> = {
	normal: 'Нормально',
	headache: 'Головная боль',
	lack_of_sleep: 'Недосып',
	stress: 'Стресс',
	coffee: 'Кофе',
	physical_activity: 'После нагрузки',
}

export function isMeasurementTag(value: string): value is MeasurementTag {
	return (MEASUREMENT_TAGS as readonly string[]).includes(value)
}

/**
 * Derives period-of-day from a local Date.
 * Product defaults (not medical): night 22–04, morning 05–11, day 12–16, evening 17–21.
 */
export function derivePeriodOfDay(date: Date): PeriodOfDay {
	const hour = date.getHours()
	if (hour >= 5 && hour < 12) {
		return 'morning'
	}
	if (hour >= 12 && hour < 17) {
		return 'day'
	}
	if (hour >= 17 && hour < 22) {
		return 'evening'
	}
	return 'night'
}

export function isPeriodOfDay(value: string): value is PeriodOfDay {
	return (
		value === 'morning' ||
		value === 'day' ||
		value === 'evening' ||
		value === 'night'
	)
}
