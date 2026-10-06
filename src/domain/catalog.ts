import type { MessageKey } from '@/i18n/dictionaries'
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

/**
 * @deprecated Prefer getMeasurementTagLabel(tag, t). Kept for PDF/report
 * builders that still assume Russian presentation.
 */
export const MEASUREMENT_TAG_LABELS_RU: Record<MeasurementTag, string> = {
	normal: 'Нормально',
	headache: 'Головная боль',
	lack_of_sleep: 'Недосып',
	stress: 'Стресс',
	coffee: 'Кофе',
	physical_activity: 'После нагрузки',
}

const TAG_MESSAGE_KEYS: Record<MeasurementTag, MessageKey> = {
	normal: 'tag.normal',
	headache: 'tag.headache',
	lack_of_sleep: 'tag.lack_of_sleep',
	stress: 'tag.stress',
	coffee: 'tag.coffee',
	physical_activity: 'tag.physical_activity',
}

/** Localized tag chip / list label via the active translator. */
export function getMeasurementTagLabel(
	tag: MeasurementTag,
	t: (key: MessageKey) => string,
): string {
	return t(TAG_MESSAGE_KEYS[tag])
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
