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
			/** Neutral double-check hint — not a medical warning. */
			softCheckMessage: string | null
	  }
	| { ok: false; code: MeasurementFormFieldError }

/**
 * Parses measurement form draft strings on submit.
 * Keeps editable drafts as strings until this point.
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

	const softParts: string[] = []
	if (isOutsideSoftBpRange('systolic', systolic.value)) {
		softParts.push('верхнее')
	}
	if (isOutsideSoftBpRange('diastolic', diastolic.value)) {
		softParts.push('нижнее')
	}
	if (isOutsideSoftBpRange('pulse', pulse.value)) {
		softParts.push('пульс')
	}

	return {
		ok: true,
		systolic: systolic.value,
		diastolic: diastolic.value,
		pulse: pulse.value,
		measuredAt,
		periodOfDay: derivePeriodOfDay(new Date(measuredAt)),
		tags,
		note,
		softCheckMessage:
			softParts.length > 0 ? 'Проверьте введённое значение.' : null,
	}
}

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
