import type {
	HealthMetric,
	HealthMetricKind,
	Measurement,
} from '@/domain/types'
import { MEASUREMENT_TAG_LABELS_RU } from '@/domain/catalog'
import {
	formatLocalDayKey,
	formatLocalTime,
} from '@/domain/dates/local-day'
import {
	formatMetricValue,
	METRIC_LABELS_RU,
	METRIC_UNITS,
	computePeriodDelta,
} from '@/domain/health/metric-catalog'
import { formatScheduleHm } from '@/domain/medications/schedule'
import {
	buildChartSeries,
	computeMeasurementStats,
	downsampleChartSeries,
	filterByDateRange,
	filterByPeriodOfDay,
	groupByTag,
	roundStat,
	type ChartPoint,
	type DateRange,
	type MeasurementStats,
} from '@/domain/statistics/measurement-stats'
import type { DiaryRepositories } from '@/storage/repositories/types'

/** Preset report windows (local days, inclusive of today). */
export type ReportPeriodPreset = 7 | 14 | 30 | 90

export type ReportPeriodSelection =
	| { kind: 'preset'; days: ReportPeriodPreset }
	| { kind: 'custom'; fromDayKey: string; toDayKey: string }

/** Default doctor-report window — balance for clinicians without overload. */
export const DEFAULT_REPORT_PERIOD_DAYS: ReportPeriodPreset = 14

export type DoctorReportBpSummary = {
	count: number
	avgSystolic: number | null
	avgDiastolic: number | null
	avgPulse: number | null
	minSystolic: number | null
	maxSystolic: number | null
	minDiastolic: number | null
	maxDiastolic: number | null
	morning: MeasurementStats | null
	evening: MeasurementStats | null
}

export type DoctorReportTagStat = {
	tag: string
	labelRu: string
	count: number
	avgSystolic: number | null
	avgDiastolic: number | null
}

export type DoctorReportMedicationRow = {
	name: string
	dosageText: string
	scheduleLabel: string
	/** Taken marks in the selected period (facts only — not adherence %). */
	takenCountInPeriod: number
}

export type DoctorReportHealthRow = {
	kind: HealthMetricKind
	labelRu: string
	unit: string
	latestValueFormatted: string
	latestMeasuredAt: string
	periodDeltaFormatted: string | null
}

export type DoctorReportMeasurementRow = {
	measuredAt: string
	dayLabel: string
	timeLabel: string
	systolic: number
	diastolic: number
	pulse: number
	tagsLabel: string
	noteShort: string | null
}

/**
 * Structured doctor-report snapshot for one profile + inclusive local range.
 * Built once before PDF generation so UI profile switches cannot mix data.
 */
export type DoctorReportData = {
	profileId: string
	profileName: string
	periodLabelRu: string
	fromDayKey: string
	toDayKey: string
	range: DateRange
	hasAnyData: boolean
	bp: DoctorReportBpSummary
	chartPoints: ChartPoint[]
	measurements: DoctorReportMeasurementRow[]
	tagStats: DoctorReportTagStat[]
	medications: DoctorReportMedicationRow[]
	health: DoctorReportHealthRow[]
	generatedAtIso: string
}

const CHART_MAX_POINTS = 90
const NOTE_MAX_CHARS = 80

/**
 * Inclusive local-day range ending at `reference` (today + previous days-1).
 * Mirrors graphs semantics with an extra 14-day preset for reports.
 */
export function getReportPresetRange(
	days: ReportPeriodPreset,
	reference: Date = new Date(),
): DateRange {
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
		reference.getDate() - (days - 1),
		0,
		0,
		0,
		0,
	)
	return { from: start.toISOString(), to: end.toISOString() }
}

/**
 * Inclusive local calendar range from YYYY-MM-DD keys (whole days).
 * Returns null when keys are invalid or from > to.
 */
export function getInclusiveLocalDayRange(
	fromDayKey: string,
	toDayKey: string,
): DateRange | null {
	const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDayKey.trim())
	const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDayKey.trim())
	if (!fromMatch || !toMatch) {
		return null
	}
	const fromY = Number(fromMatch[1])
	const fromM = Number(fromMatch[2]) - 1
	const fromD = Number(fromMatch[3])
	const toY = Number(toMatch[1])
	const toM = Number(toMatch[2]) - 1
	const toD = Number(toMatch[3])
	const start = new Date(fromY, fromM, fromD, 0, 0, 0, 0)
	const end = new Date(toY, toM, toD, 23, 59, 59, 999)
	if (
		start.getFullYear() !== fromY ||
		start.getMonth() !== fromM ||
		start.getDate() !== fromD ||
		end.getFullYear() !== toY ||
		end.getMonth() !== toM ||
		end.getDate() !== toD
	) {
		return null
	}
	if (start.getTime() > end.getTime()) {
		return null
	}
	return { from: start.toISOString(), to: end.toISOString() }
}

export function resolveReportRange(
	selection: ReportPeriodSelection,
	reference: Date = new Date(),
): DateRange | null {
	if (selection.kind === 'preset') {
		return getReportPresetRange(selection.days, reference)
	}
	return getInclusiveLocalDayRange(selection.fromDayKey, selection.toDayKey)
}

/** Russian period heading, e.g. «17–31 августа 2026». */
export function formatReportPeriodLabelRu(range: DateRange): string {
	const from = new Date(range.from)
	const to = new Date(range.to)
	const sameYear = from.getFullYear() === to.getFullYear()
	const sameMonth = sameYear && from.getMonth() === to.getMonth()

	if (sameMonth) {
		const month = to.toLocaleDateString('ru-RU', { month: 'long' })
		return `${from.getDate()}–${to.getDate()} ${month} ${to.getFullYear()}`
	}

	const fromPart = from.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		...(sameYear ? {} : { year: 'numeric' }),
	})
	const toPart = to.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
	return `${fromPart} – ${toPart}`
}

function dayLabelRu(iso: string): string {
	const date = new Date(iso)
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'short',
	})
}

function truncateNote(note: string | null): string | null {
	if (!note) {
		return null
	}
	const trimmed = note.trim()
	if (!trimmed) {
		return null
	}
	if (trimmed.length <= NOTE_MAX_CHARS) {
		return trimmed
	}
	return `${trimmed.slice(0, NOTE_MAX_CHARS - 1)}…`
}

function mapMeasurementRows(
	measurements: Measurement[],
): DoctorReportMeasurementRow[] {
	// Chronological ascending — preferred for clinician reading.
	return [...measurements]
		.sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
		.map((m) => ({
			measuredAt: m.measuredAt,
			dayLabel: dayLabelRu(m.measuredAt),
			timeLabel: formatLocalTime(m.measuredAt),
			systolic: m.systolic,
			diastolic: m.diastolic,
			pulse: m.pulse,
			tagsLabel: m.tags
				.map((t) => MEASUREMENT_TAG_LABELS_RU[t] ?? t)
				.join(', '),
			noteShort: truncateNote(m.note),
		}))
}

function buildHealthRows(
	enabledKinds: HealthMetricKind[],
	metricsNewestFirst: HealthMetric[],
	range: DateRange,
	now: Date,
): DoctorReportHealthRow[] {
	const rows: DoctorReportHealthRow[] = []
	for (const kind of enabledKinds) {
		const ofKind = metricsNewestFirst.filter((m) => m.kind === kind)
		if (ofKind.length === 0) {
			continue
		}
		const inPeriod = ofKind.filter(
			(m) => m.measuredAt >= range.from && m.measuredAt <= range.to,
		)
		// Prefer latest in period; otherwise show last known with no period delta.
		const latest = inPeriod[0] ?? ofKind[0]!
		const deltaSource = inPeriod.length > 0 ? inPeriod : ofKind
		const periodDays = Math.max(
			1,
			Math.round(
				(new Date(range.to).getTime() - new Date(range.from).getTime()) /
					(24 * 60 * 60 * 1000),
			) + 1,
		)
		const delta =
			inPeriod.length >= 2
				? computePeriodDelta(kind, deltaSource, periodDays, now)
				: null

		rows.push({
			kind,
			labelRu: METRIC_LABELS_RU[kind],
			unit: METRIC_UNITS[kind],
			latestValueFormatted: formatMetricValue(kind, latest.value),
			latestMeasuredAt: latest.measuredAt,
			periodDeltaFormatted:
				inPeriod.length >= 2 && delta && delta.direction !== 'same'
					? delta.formatted
					: null,
		})
	}
	return rows
}

/**
 * Loads a consistent doctor-report snapshot for one profileId + range.
 * Callers must pass the frozen profileId at Generate time (not live React state).
 */
export async function buildDoctorReportData(input: {
	repos: DiaryRepositories
	profileId: string
	selection: ReportPeriodSelection
	reference?: Date
}): Promise<DoctorReportData> {
	const reference = input.reference ?? new Date()
	const range = resolveReportRange(input.selection, reference)
	if (!range) {
		throw new Error('Invalid report period')
	}

	const profile = await input.repos.profiles.getById(input.profileId)
	if (!profile) {
		throw new Error(`Profile not found: ${input.profileId}`)
	}

	const [
		allMeasurements,
		allMedications,
		allIntakes,
		allHealth,
		metricSettings,
	] = await Promise.all([
		input.repos.measurements.listByProfile(input.profileId),
		input.repos.medications.listByProfile(input.profileId),
		input.repos.medicationIntakes.listByProfile(input.profileId),
		input.repos.healthMetrics.listByProfile(input.profileId),
		input.repos.profileMetricSettings.get(input.profileId),
	])

	const measurements = filterByDateRange(allMeasurements, range)
	const overall = computeMeasurementStats(measurements)
	const morningStats = computeMeasurementStats(
		filterByPeriodOfDay(measurements, 'morning'),
	)
	const eveningStats = computeMeasurementStats(
		filterByPeriodOfDay(measurements, 'evening'),
	)

	const chartPoints = downsampleChartSeries(
		buildChartSeries(measurements),
		CHART_MAX_POINTS,
	)

	const tagStats: DoctorReportTagStat[] = groupByTag(measurements).map(
		(g) => ({
			tag: g.tag,
			labelRu: MEASUREMENT_TAG_LABELS_RU[g.tag] ?? g.tag,
			count: g.stats.count,
			avgSystolic: roundStat(g.stats.avgSystolic),
			avgDiastolic: roundStat(g.stats.avgDiastolic),
		}),
	)

	const intakesInPeriod = allIntakes.filter(
		(i) =>
			i.taken &&
			i.takenAt >= range.from &&
			i.takenAt <= range.to,
	)

	const medications: DoctorReportMedicationRow[] = allMedications
		.filter((m) => m.isActive)
		.map((m) => ({
			name: m.name,
			dosageText: m.dosageText,
			scheduleLabel: m.schedule.map(formatScheduleHm).join(', '),
			takenCountInPeriod: intakesInPeriod.filter(
				(i) => i.medicationId === m.id,
			).length,
		}))

	const health = buildHealthRows(
		metricSettings.enabledKinds,
		allHealth,
		range,
		reference,
	)

	const hasAnyData =
		measurements.length > 0 ||
		medications.length > 0 ||
		health.length > 0

	return {
		profileId: profile.id,
		profileName: profile.name,
		periodLabelRu: formatReportPeriodLabelRu(range),
		fromDayKey: formatLocalDayKey(new Date(range.from)),
		toDayKey: formatLocalDayKey(new Date(range.to)),
		range,
		hasAnyData,
		bp: {
			count: overall.count,
			avgSystolic: roundStat(overall.avgSystolic),
			avgDiastolic: roundStat(overall.avgDiastolic),
			avgPulse: roundStat(overall.avgPulse),
			minSystolic: overall.minSystolic,
			maxSystolic: overall.maxSystolic,
			minDiastolic: overall.minDiastolic,
			maxDiastolic: overall.maxDiastolic,
			morning: morningStats.count > 0 ? {
				...morningStats,
				avgSystolic: roundStat(morningStats.avgSystolic),
				avgDiastolic: roundStat(morningStats.avgDiastolic),
				avgPulse: roundStat(morningStats.avgPulse),
			} : null,
			evening: eveningStats.count > 0 ? {
				...eveningStats,
				avgSystolic: roundStat(eveningStats.avgSystolic),
				avgDiastolic: roundStat(eveningStats.avgDiastolic),
				avgPulse: roundStat(eveningStats.avgPulse),
			} : null,
		},
		chartPoints,
		measurements: mapMeasurementRows(measurements),
		tagStats,
		medications,
		health,
		generatedAtIso: new Date().toISOString(),
	}
}

/** Safe ASCII filename stem for Share / Files. */
export function buildDoctorReportFileName(data: DoctorReportData): string {
	const profilePart = sanitizeFileNamePart(data.profileName) || 'profile'
	return `davlenie_${profilePart}_${data.fromDayKey}_${data.toDayKey}.pdf`
}

/**
 * Transliterates common Cyrillic letters and strips unsafe path characters.
 */
export function sanitizeFileNamePart(raw: string): string {
	const map: Record<string, string> = {
		а: 'a',
		б: 'b',
		в: 'v',
		г: 'g',
		д: 'd',
		е: 'e',
		ё: 'e',
		ж: 'zh',
		з: 'z',
		и: 'i',
		й: 'y',
		к: 'k',
		л: 'l',
		м: 'm',
		н: 'n',
		о: 'o',
		п: 'p',
		р: 'r',
		с: 's',
		т: 't',
		у: 'u',
		ф: 'f',
		х: 'h',
		ц: 'ts',
		ч: 'ch',
		ш: 'sh',
		щ: 'sch',
		ъ: '',
		ы: 'y',
		ь: '',
		э: 'e',
		ю: 'yu',
		я: 'ya',
	}
	const lower = raw.trim().toLowerCase()
	let out = ''
	for (const ch of lower) {
		if (map[ch] !== undefined) {
			out += map[ch]
		} else if (/[a-z0-9]/.test(ch)) {
			out += ch
		} else if (ch === ' ' || ch === '-' || ch === '_') {
			out += '_'
		}
	}
	out = out.replace(/_+/g, '_').replace(/^_|_$/g, '')
	return out.slice(0, 40)
}
