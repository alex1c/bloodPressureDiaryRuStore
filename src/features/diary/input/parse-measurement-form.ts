import { derivePeriodOfDay, isMeasurementTag } from '@/domain/catalog'
import {
	isOutsideSoftBpRange,
	parseDiastolicInput,
	parsePulseInput,
	parseSystolicInput,
} from '@/domain/input/normalize'
import { isoFromLocalDateAndTime } from '@/domain/dates/local-day'
import type { MeasurementTag, PeriodOfDay } from '@/domain/types'

export type MeasurementFormDraft = {
	systolicText: string
	diastolicText: string
	pulseText: string
	/** Local YYYY-MM-DD */
	dayKey: string
	/** Local HH:mm */
	timeHm: string
	tags: MeasurementTag[]
	note: string
}

export type MeasurementFormFieldError =
	| 'EMPTY_SYSTOLIC'
	| 'EMPTY_DIASTOLIC'
	| 'EMPTY_PULSE'
	| 'INVALID_SYSTOLIC'
	| 'INVALID_DIASTOLIC'
	| 'INVALID_PULSE'
	| 'INVALID_DATETIME'
	| 'SYSTOLIC_NOT_ABOVE_DIASTOLIC'

export type MeasurementFormParseResult =
	| {
			ok: true
			systolic: number
			diastolic: number
			pulse: number
			measuredAt: string
			periodOfDay: PeriodOfDay
			tags: MeasurementTag[]
			note: string | null
			/** True when values are outside soft ranges — UI shows t('measurement.softHint'). */
			hasSoftCheck: boolean
	  }
	| { ok: false; code: MeasurementFormFieldError }

/**
 * Parses measurement form draft strings on submit.
 * Keeps editable drafts as strings until this point.
 * Error / soft-hint copy is resolved in the UI via i18n keys.
 */
export function parseMeasurementForm(
	draft: MeasurementFormDraft,
): MeasurementFormParseResult {
	const systolic = parseSystolicInput(draft.systolicText)
	if (!systolic.ok) {
		return {
			ok: false,
			code: systolic.code === 'EMPTY' ? 'EMPTY_SYSTOLIC' : 'INVALID_SYSTOLIC',
		}
	}

	const diastolic = parseDiastolicInput(draft.diastolicText)
	if (!diastolic.ok) {
		return {
			ok: false,
			code:
				diastolic.code === 'EMPTY' ? 'EMPTY_DIASTOLIC' : 'INVALID_DIASTOLIC',
		}
	}

	const pulse = parsePulseInput(draft.pulseText)
	if (!pulse.ok) {
		return {
			ok: false,
			code: pulse.code === 'EMPTY' ? 'EMPTY_PULSE' : 'INVALID_PULSE',
		}
	}

	if (systolic.value <= diastolic.value) {
		return { ok: false, code: 'SYSTOLIC_NOT_ABOVE_DIASTOLIC' }
	}

	const measuredAt = isoFromLocalDateAndTime(draft.dayKey, draft.timeHm)
	if (!measuredAt) {
		return { ok: false, code: 'INVALID_DATETIME' }
	}

	const tags = draft.tags.filter(isMeasurementTag)
	const noteTrimmed = draft.note.trim()
	const note = noteTrimmed.length === 0 ? null : noteTrimmed

	const hasSoftCheck =
		isOutsideSoftBpRange('systolic', systolic.value) ||
		isOutsideSoftBpRange('diastolic', diastolic.value) ||
		isOutsideSoftBpRange('pulse', pulse.value)

	return {
		ok: true,
		systolic: systolic.value,
		diastolic: diastolic.value,
		pulse: pulse.value,
		measuredAt,
		periodOfDay: derivePeriodOfDay(new Date(measuredAt)),
		tags,
		note,
		hasSoftCheck,
	}
}

/** Maps parse error codes to message catalog keys (translate in the UI). */
export function measurementFormErrorKey(
	code: MeasurementFormFieldError,
):
	| 'measurement.error.emptySystolic'
	| 'measurement.error.emptyDiastolic'
	| 'measurement.error.emptyPulse'
	| 'measurement.error.invalidSystolic'
	| 'measurement.error.invalidDiastolic'
	| 'measurement.error.invalidPulse'
	| 'measurement.error.invalidDatetime'
	| 'measurement.error.systolicNotAbove' {
	switch (code) {
		case 'EMPTY_SYSTOLIC':
			return 'measurement.error.emptySystolic'
		case 'EMPTY_DIASTOLIC':
			return 'measurement.error.emptyDiastolic'
		case 'EMPTY_PULSE':
			return 'measurement.error.emptyPulse'
		case 'INVALID_SYSTOLIC':
			return 'measurement.error.invalidSystolic'
		case 'INVALID_DIASTOLIC':
			return 'measurement.error.invalidDiastolic'
		case 'INVALID_PULSE':
			return 'measurement.error.invalidPulse'
		case 'INVALID_DATETIME':
			return 'measurement.error.invalidDatetime'
		case 'SYSTOLIC_NOT_ABOVE_DIASTOLIC':
			return 'measurement.error.systolicNotAbove'
		default: {
			const _exhaustive: never = code
			return _exhaustive
		}
	}
}

/**
 * @deprecated Prefer measurementFormErrorKey + t() in UI.
 * Kept for older tests that assert Russian copy.
 */
export function measurementFormErrorMessage(
	code: MeasurementFormFieldError,
): string {
	switch (code) {
		case 'EMPTY_SYSTOLIC':
			return 'Укажите верхнее давление'
		case 'EMPTY_DIASTOLIC':
			return 'Укажите нижнее давление'
		case 'EMPTY_PULSE':
			return 'Укажите пульс'
		case 'INVALID_SYSTOLIC':
			return 'Проверьте верхнее давление'
		case 'INVALID_DIASTOLIC':
			return 'Проверьте нижнее давление'
		case 'INVALID_PULSE':
			return 'Проверьте пульс'
		case 'INVALID_DATETIME':
			return 'Проверьте дату и время'
		case 'SYSTOLIC_NOT_ABOVE_DIASTOLIC':
			return 'Верхнее давление должно быть больше нижнего'
		default:
			return 'Проверьте введённые данные'
	}
}
