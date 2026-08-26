import type { Measurement, MeasurementTag, PeriodOfDay } from '../types'

export interface DateRange {
	/** Inclusive ISO start (compared as strings if both are ISO-8601 UTC). */
	from: string
	/** Inclusive ISO end. */
	to: string
}

export interface MeasurementStats {
	count: number
	avgSystolic: number | null
	avgDiastolic: number | null
	avgPulse: number | null
	minSystolic: number | null
	maxSystolic: number | null
	minDiastolic: number | null
	maxDiastolic: number | null
	minPulse: number | null
	maxPulse: number | null
}

export interface DayGroup {
	/** YYYY-MM-DD in local interpretation of measuredAt date portion when Z. */
	day: string
	measurements: Measurement[]
}

export interface TagGroup {
	tag: MeasurementTag
	measurements: Measurement[]
	stats: MeasurementStats
}

function average(values: number[]): number | null {
	if (values.length === 0) {
		return null
	}
	const sum = values.reduce((acc, n) => acc + n, 0)
	return sum / values.length
}

function minOf(values: number[]): number | null {
	if (values.length === 0) {
		return null
	}
	return Math.min(...values)
}

function maxOf(values: number[]): number | null {
	if (values.length === 0) {
		return null
	}
	return Math.max(...values)
}

/**
 * Descriptive aggregates only — no medical interpretation.
 * Uses saved numeric fields exclusively.
 */
export function computeMeasurementStats(
	measurements: readonly Measurement[],
): MeasurementStats {
	const systolic = measurements.map((m) => m.systolic)
	const diastolic = measurements.map((m) => m.diastolic)
	const pulse = measurements.map((m) => m.pulse)

	return {
		count: measurements.length,
		avgSystolic: average(systolic),
		avgDiastolic: average(diastolic),
		avgPulse: average(pulse),
		minSystolic: minOf(systolic),
		maxSystolic: maxOf(systolic),
		minDiastolic: minOf(diastolic),
		maxDiastolic: maxOf(diastolic),
		minPulse: minOf(pulse),
		maxPulse: maxOf(pulse),
	}
}

/** Inclusive ISO string range filter on measuredAt. */
export function filterByDateRange(
	measurements: readonly Measurement[],
	range: DateRange,
): Measurement[] {
	return measurements.filter(
		(m) => m.measuredAt >= range.from && m.measuredAt <= range.to,
	)
}

export function filterByPeriodOfDay(
	measurements: readonly Measurement[],
	period: PeriodOfDay,
): Measurement[] {
	return measurements.filter((m) => m.periodOfDay === period)
}

export function filterByTag(
	measurements: readonly Measurement[],
	tag: MeasurementTag,
): Measurement[] {
	return measurements.filter((m) => m.tags.includes(tag))
}

/** Groups by UTC calendar day of measuredAt (YYYY-MM-DD). */
export function groupByDay(
	measurements: readonly Measurement[],
): DayGroup[] {
	const map = new Map<string, Measurement[]>()

	for (const m of measurements) {
		const day = m.measuredAt.slice(0, 10)
		const list = map.get(day)
		if (list) {
			list.push(m)
		} else {
			map.set(day, [m])
		}
	}

	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([day, items]) => ({ day, measurements: items }))
}

/** Groups by each tag present on a measurement (a row may appear in multiple). */
export function groupByTag(
	measurements: readonly Measurement[],
): TagGroup[] {
	const map = new Map<MeasurementTag, Measurement[]>()

	for (const m of measurements) {
		for (const tag of m.tags) {
			const list = map.get(tag)
			if (list) {
				list.push(m)
			} else {
				map.set(tag, [m])
			}
		}
	}

	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([tag, items]) => ({
			tag,
			measurements: items,
			stats: computeMeasurementStats(items),
		}))
}
