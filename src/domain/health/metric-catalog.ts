import type { HealthMetric, HealthMetricKind } from '@/domain/types'
import {
	parseGlucoseInput,
	parseSpo2Input,
	parseTemperatureCInput,
	parseWeightKgInput,
	type ParseNumberResult,
} from '@/domain/input/normalize'
import { formatLocalDayKey, localDayKeyFromIso } from '@/domain/dates/local-day'

/** Default enabled kinds for a new profile — weight only. */
export const DEFAULT_ENABLED_METRIC_KINDS: readonly HealthMetricKind[] = [
	'weight',
]

export const ALL_METRIC_KINDS: readonly HealthMetricKind[] = [
	'weight',
	'glucose',
	'spo2',
	'temperature',
]

export const METRIC_LABELS_RU: Record<HealthMetricKind, string> = {
	weight: 'Вес',
	glucose: 'Сахар крови',
	spo2: 'Сатурация',
	temperature: 'Температура',
}

export const METRIC_HINTS_RU: Record<HealthMetricKind, string> = {
	weight: 'кг',
	glucose: 'ммоль/л (глюкоза)',
	spo2: '%',
	temperature: '°C',
}

export const METRIC_UNITS: Record<HealthMetricKind, string> = {
	weight: 'кг',
	glucose: 'ммоль/л',
	spo2: '%',
	temperature: '°C',
}

/**
 * Soft check ranges — unusual but possible journal values.
 * Soft hint only; hard bounds live in parse* helpers.
 */
export const METRIC_SOFT_RANGES: Record<
	HealthMetricKind,
	{ min: number; max: number }
> = {
	weight: { min: 30, max: 250 },
	glucose: { min: 2.5, max: 20 },
	spo2: { min: 85, max: 100 },
	temperature: { min: 35, max: 40 },
}

export function isOutsideSoftMetricRange(
	kind: HealthMetricKind,
	value: number,
): boolean {
	const range = METRIC_SOFT_RANGES[kind]
	return value < range.min || value > range.max
}

export function parseMetricValue(
	kind: HealthMetricKind,
	raw: string,
): ParseNumberResult {
	switch (kind) {
		case 'weight':
			return parseWeightKgInput(raw)
		case 'glucose':
			return parseGlucoseInput(raw)
		case 'spo2':
			return parseSpo2Input(raw)
		case 'temperature':
			return parseTemperatureCInput(raw)
		default: {
			const _exhaustive: never = kind
			return _exhaustive
		}
	}
}

/** Formats a stored metric for display (ru decimal comma for non-integers). */
export function formatMetricValue(
	kind: HealthMetricKind,
	value: number,
): string {
	if (kind === 'spo2') {
		return String(Math.round(value))
	}
	const rounded =
		kind === 'weight' || kind === 'glucose' || kind === 'temperature'
			? Math.round(value * 10) / 10
			: value
	const text = Number.isInteger(rounded)
		? String(rounded)
		: rounded.toFixed(1)
	return text.replace('.', ',')
}

export function formatMetricWithUnit(
	kind: HealthMetricKind,
	value: number,
): string {
	return `${formatMetricValue(kind, value)} ${METRIC_UNITS[kind]}`
}

export type MetricDelta = {
	absolute: number
	formatted: string
	/** Positive = increased vs previous. */
	direction: 'up' | 'down' | 'same'
}

/**
 * Delta vs previous reading of the same kind (newest-first list).
 * Returns null when fewer than two points.
 */
export function computePreviousDelta(
	kind: HealthMetricKind,
	newestFirst: HealthMetric[],
): MetricDelta | null {
	const ofKind = newestFirst.filter((m) => m.kind === kind)
	if (ofKind.length < 2) {
		return null
	}
	const latest = ofKind[0]!.value
	const previous = ofKind[1]!.value
	const absolute = latest - previous
	const direction =
		absolute > 0.0001 ? 'up' : absolute < -0.0001 ? 'down' : 'same'
	const sign = absolute > 0 ? '+' : absolute < 0 ? '−' : ''
	const magnitude = formatMetricValue(kind, Math.abs(absolute))
	return {
		absolute,
		direction,
		formatted: `${sign}${magnitude} ${METRIC_UNITS[kind]}`,
	}
}

/**
 * Change over roughly the last `days` relative to the newest reading.
 * Compares newest vs oldest point still inside the window (or the closest older).
 */
export function computePeriodDelta(
	kind: HealthMetricKind,
	newestFirst: HealthMetric[],
	days: number,
	now: Date = new Date(),
): MetricDelta | null {
	const ofKind = newestFirst.filter((m) => m.kind === kind)
	if (ofKind.length < 2) {
		return null
	}
	const latest = ofKind[0]!
	const windowStart = new Date(now)
	windowStart.setDate(windowStart.getDate() - days)
	const windowStartIso = windowStart.toISOString()

	const inWindow = ofKind.filter((m) => m.measuredAt >= windowStartIso)
	const baseline =
		inWindow.length >= 2
			? inWindow[inWindow.length - 1]!
			: ofKind[ofKind.length - 1]!
	if (baseline.id === latest.id) {
		return null
	}
	const absolute = latest.value - baseline.value
	const direction =
		absolute > 0.0001 ? 'up' : absolute < -0.0001 ? 'down' : 'same'
	const sign = absolute > 0 ? '+' : absolute < 0 ? '−' : ''
	const magnitude = formatMetricValue(kind, Math.abs(absolute))
	return {
		absolute,
		direction,
		formatted: `${sign}${magnitude} ${METRIC_UNITS[kind]} за ${days} дн.`,
	}
}

export function groupMetricsByLocalDay(
	items: HealthMetric[],
): { dayKey: string; items: HealthMetric[] }[] {
	const map = new Map<string, HealthMetric[]>()
	for (const item of items) {
		const key = localDayKeyFromIso(item.measuredAt)
		const list = map.get(key) ?? []
		list.push(item)
		map.set(key, list)
	}
	return [...map.entries()].map(([dayKey, groupItems]) => ({
		dayKey,
		items: groupItems,
	}))
}

export function dayHeadingForKey(dayKey: string, today = new Date()): string {
	if (dayKey === formatLocalDayKey(today)) {
		return 'Сегодня'
	}
	const [y, m, d] = dayKey.split('-').map(Number)
	const date = new Date(y!, m! - 1, d!)
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
	})
}

export function normalizeEnabledKinds(
	kinds: HealthMetricKind[],
): HealthMetricKind[] {
	const set = new Set(kinds)
	return ALL_METRIC_KINDS.filter((k) => set.has(k))
}
