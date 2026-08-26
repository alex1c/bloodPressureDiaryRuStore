import type { Measurement, MeasurementTag, PeriodOfDay } from '../types'
import { localDayKeyFromIso } from '../dates/local-day'

export type StatsPeriodDays = 7 | 30 | 90 | 'all'

export interface DateRange {
	/** Inclusive ISO start. */
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
	/** Local YYYY-MM-DD. */
	day: string
	/** Newest first within the day. */
	measurements: Measurement[]
}

export interface TagGroup {
	tag: MeasurementTag
	measurements: Measurement[]
	stats: MeasurementStats
}

export interface ChartPoint {
	measuredAt: string
	systolic: number
	diastolic: number
	pulse: number
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

export function filterByProfileId(
	measurements: readonly Measurement[],
	profileId: string,
): Measurement[] {
	return measurements.filter((m) => m.profileId === profileId)
}

/**
 * Local-day inclusive range ending at `reference` local calendar day.
 * days=7 means today + previous 6 local days.
 */
export function getStatsPeriodRange(
	period: StatsPeriodDays,
	reference: Date = new Date(),
): DateRange | null {
	if (period === 'all') {
		return null
	}

	const end = new Date(
		reference.getFullYear(),
		reference.getMonth(),
		reference.getDate(),
		23,
		59,
		59,
		999,
	)
	const start = new Date(
		reference.getFullYear(),
		reference.getMonth(),
		reference.getDate() - (period - 1),
		0,
		0,
		0,
		0,
	)

	return {
		from: start.toISOString(),
		to: end.toISOString(),
	}
}

export function filterByStatsPeriod(
	measurements: readonly Measurement[],
	period: StatsPeriodDays,
	reference: Date = new Date(),
): Measurement[] {
	const range = getStatsPeriodRange(period, reference)
	if (!range) {
		return [...measurements]
	}
	return filterByDateRange(measurements, range)
}

/** Newest-first history groups by local calendar day. */
export function groupHistoryByLocalDay(
	measurements: readonly Measurement[],
): DayGroup[] {
	const map = new Map<string, Measurement[]>()

	for (const m of measurements) {
		const day = localDayKeyFromIso(m.measuredAt)
		const list = map.get(day)
		if (list) {
			list.push(m)
		} else {
			map.set(day, [m])
		}
	}

	for (const list of map.values()) {
		list.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
	}

	return [...map.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([day, items]) => ({ day, measurements: items }))
}

/** Chronological ascending groups (for charts / older APIs). */
export function groupByDay(
	measurements: readonly Measurement[],
): DayGroup[] {
	return groupHistoryByLocalDay(measurements)
		.slice()
		.reverse()
		.map((group) => ({
			day: group.day,
			measurements: [...group.measurements].sort((a, b) =>
				a.measuredAt.localeCompare(b.measuredAt),
			),
		}))
}

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
		.filter((g) => g.stats.count > 0)
}

/** Chronological points for line charts (oldest → newest). */
export function buildChartSeries(
	measurements: readonly Measurement[],
): ChartPoint[] {
	return [...measurements]
		.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
		.map((m) => ({
			measuredAt: m.measuredAt,
			systolic: m.systolic,
			diastolic: m.diastolic,
			pulse: m.pulse,
		}))
}

/**
 * Caps chart density for very long histories while preserving order.
 * Keeps first/last and evenly samples the middle.
 */
export function downsampleChartSeries(
	points: readonly ChartPoint[],
	maxPoints: number,
): ChartPoint[] {
	if (points.length <= maxPoints || maxPoints < 3) {
		return [...points]
	}

	const result: ChartPoint[] = [points[0]!]
	const inner = maxPoints - 2
	for (let i = 1; i <= inner; i += 1) {
		const index = Math.round((i * (points.length - 1)) / (inner + 1))
		const point = points[index]
		if (point && point !== result[result.length - 1]) {
			result.push(point)
		}
	}
	const last = points[points.length - 1]!
	if (result[result.length - 1] !== last) {
		result.push(last)
	}
	return result
}

export function roundStat(value: number | null): number | null {
	if (value === null) {
		return null
	}
	return Math.round(value)
}
