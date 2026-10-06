import type { HealthMetric, HealthMetricKind } from '@/domain/types'
import {
	parseGlucoseInput,
	parseSpo2Input,
	parseTemperatureCInput,
	parseWeightKgInput,
	type ParseNumberResult,
} from '@/domain/input/normalize'
import { formatLocalDayKey, localDayKeyFromIso } from '@/domain/dates/local-day'
import type { MessageKey } from '@/i18n/dictionaries'
import type { AppLocale } from '@/i18n/locale'
import { formatLongDate } from '@/i18n/format'

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

/**
 * @deprecated Prefer getMetricLabel(kind, t). Kept for PDF/report builders.
 */
export const METRIC_LABELS_RU: Record<HealthMetricKind, string> = {
	weight: 'Вес',
	glucose: 'Сахар крови',
	spo2: 'Сатурация',
	temperature: 'Температура',
}

/**
 * @deprecated Prefer getMetricHint(kind, t).
 */
export const METRIC_HINTS_RU: Record<HealthMetricKind, string> = {
	weight: 'кг',
	glucose: 'ммоль/л (глюкоза)',
	spo2: '%',
	temperature: '°C',
}

/**
 * Canonical storage units (also used as RU fallback display).
 * Prefer getMetricUnit(kind, t) for UI presentation.
 */
export const METRIC_UNITS: Record<HealthMetricKind, string> = {
	weight: 'кг',
	glucose: 'ммоль/л',
	spo2: '%',
	temperature: '°C',
}

type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string

const METRIC_LABEL_KEYS: Record<HealthMetricKind, MessageKey> = {
	weight: 'health.metric.weight',
	glucose: 'health.metric.glucose',
	spo2: 'health.metric.spo2',
	temperature: 'health.metric.temperature',
}

const METRIC_HINT_KEYS: Record<HealthMetricKind, MessageKey> = {
	weight: 'health.hint.weight',
	glucose: 'health.hint.glucose',
	spo2: 'health.hint.spo2',
	temperature: 'health.hint.temperature',
}

const METRIC_UNIT_KEYS: Record<HealthMetricKind, MessageKey> = {
	weight: 'units.kg',
	glucose: 'units.mmolL',
	spo2: 'units.spo2',
	temperature: 'units.celsius',
}

/** Localized metric title for Health UI. */
export function getMetricLabel(
	kind: HealthMetricKind,
	t: TranslateFn,
): string {
	return t(METRIC_LABEL_KEYS[kind])
}

/** Localized input hint (unit-oriented) for metric forms. */
export function getMetricHint(
	kind: HealthMetricKind,
	t: TranslateFn,
): string {
	return t(METRIC_HINT_KEYS[kind])
}

/** Localized unit string for metric display. */
export function getMetricUnit(
	kind: HealthMetricKind,
	t: TranslateFn,
): string {
	return t(METRIC_UNIT_KEYS[kind])
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
	unitLabel?: string,
): string {
	const unit = unitLabel ?? METRIC_UNITS[kind]
	return `${formatMetricValue(kind, value)} ${unit}`
}

/** Formats a metric value with a localized unit from the translator. */
export function formatMetricWithUnitT(
	kind: HealthMetricKind,
	value: number,
	t: TranslateFn,
): string {
	return formatMetricWithUnit(kind, value, getMetricUnit(kind, t))
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
 * Pass unitLabel from getMetricUnit(kind, t) for localized presentation.
 */
export function computePreviousDelta(
	kind: HealthMetricKind,
	newestFirst: HealthMetric[],
	unitLabel?: string,
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
	const unit = unitLabel ?? METRIC_UNITS[kind]
	return {
		absolute,
		direction,
		formatted: `${sign}${magnitude} ${unit}`,
	}
}

/**
 * Change over roughly the last `days` relative to the newest reading.
 * Compares newest vs oldest point still inside the window (or the closest older).
 * Pass unitLabel + periodSuffix from i18n for localized presentation.
 */
export function computePeriodDelta(
	kind: HealthMetricKind,
	newestFirst: HealthMetric[],
	days: number,
	now: Date = new Date(),
	options?: { unitLabel?: string; periodSuffix?: string },
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
	const unit = options?.unitLabel ?? METRIC_UNITS[kind]
	const suffix = options?.periodSuffix ?? `за ${days} дн.`
	return {
		absolute,
		direction,
		formatted: `${sign}${magnitude} ${unit} ${suffix}`,
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

/**
 * Day section heading — "Today" (via t) or locale-aware long date.
 * When t/locale omitted, falls back to Russian (legacy callers / PDF).
 */
export function dayHeadingForKey(
	dayKey: string,
	today: Date = new Date(),
	options?: {
		locale?: AppLocale
		todayLabel?: string
	},
): string {
	if (dayKey === formatLocalDayKey(today)) {
		return options?.todayLabel ?? 'Сегодня'
	}
	const [y, m, d] = dayKey.split('-').map(Number)
	const date = new Date(y!, m! - 1, d!)
	const locale = options?.locale ?? 'ru'
	return formatLongDate(date, locale)
}

export function normalizeEnabledKinds(
	kinds: HealthMetricKind[],
): HealthMetricKind[] {
	const set = new Set(kinds)
	return ALL_METRIC_KINDS.filter((k) => set.has(k))
}
