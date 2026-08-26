import { BP_INPUT_BOUNDS } from '../input/normalize'
import type { CreateMeasurementInput, Measurement, UpdateMeasurementInput } from '../types'
import { createEntityId, nowIso } from '../ids'
import { isMeasurementTag, isPeriodOfDay } from '../catalog'

export type MeasurementValidationError =
	| 'INVALID_SYSTOLIC'
	| 'INVALID_DIASTOLIC'
	| 'INVALID_PULSE'
	| 'INVALID_PERIOD'
	| 'INVALID_TAGS'
	| 'INVALID_MEASURED_AT'

export type MeasurementValidationResult =
	| { ok: true }
	| { ok: false; code: MeasurementValidationError }

function inBounds(value: number, min: number, max: number): boolean {
	return Number.isInteger(value) && value >= min && value <= max
}

export function validateMeasurementFields(input: {
	systolic: number
	diastolic: number
	pulse: number
	periodOfDay: string
	tags: string[]
	measuredAt: string
}): MeasurementValidationResult {
	if (!inBounds(input.systolic, BP_INPUT_BOUNDS.systolic.min, BP_INPUT_BOUNDS.systolic.max)) {
		return { ok: false, code: 'INVALID_SYSTOLIC' }
	}
	if (
		!inBounds(
			input.diastolic,
			BP_INPUT_BOUNDS.diastolic.min,
			BP_INPUT_BOUNDS.diastolic.max,
		)
	) {
		return { ok: false, code: 'INVALID_DIASTOLIC' }
	}
	if (!inBounds(input.pulse, BP_INPUT_BOUNDS.pulse.min, BP_INPUT_BOUNDS.pulse.max)) {
		return { ok: false, code: 'INVALID_PULSE' }
	}
	if (!isPeriodOfDay(input.periodOfDay)) {
		return { ok: false, code: 'INVALID_PERIOD' }
	}
	if (!input.tags.every(isMeasurementTag)) {
		return { ok: false, code: 'INVALID_TAGS' }
	}
	if (Number.isNaN(Date.parse(input.measuredAt))) {
		return { ok: false, code: 'INVALID_MEASURED_AT' }
	}
	return { ok: true }
}

export function buildMeasurement(input: CreateMeasurementInput): Measurement {
	const tags = input.tags ?? []
	const validation = validateMeasurementFields({
		systolic: input.systolic,
		diastolic: input.diastolic,
		pulse: input.pulse,
		periodOfDay: input.periodOfDay,
		tags,
		measuredAt: input.measuredAt,
	})
	if (!validation.ok) {
		throw new Error(`Invalid measurement: ${validation.code}`)
	}

	const timestamp = nowIso()
	return {
		id: createEntityId(),
		profileId: input.profileId,
		systolic: input.systolic,
		diastolic: input.diastolic,
		pulse: input.pulse,
		measuredAt: input.measuredAt,
		periodOfDay: input.periodOfDay,
		wellbeing: input.wellbeing ?? null,
		tags,
		note: input.note === undefined ? null : input.note,
		createdAt: timestamp,
		updatedAt: timestamp,
	}
}

export function applyMeasurementUpdate(
	existing: Measurement,
	patch: UpdateMeasurementInput,
): Measurement {
	const next: Measurement = {
		...existing,
		systolic: patch.systolic ?? existing.systolic,
		diastolic: patch.diastolic ?? existing.diastolic,
		pulse: patch.pulse ?? existing.pulse,
		measuredAt: patch.measuredAt ?? existing.measuredAt,
		periodOfDay: patch.periodOfDay ?? existing.periodOfDay,
		wellbeing:
			patch.wellbeing === undefined ? existing.wellbeing : patch.wellbeing,
		tags: patch.tags ?? existing.tags,
		note: patch.note === undefined ? existing.note : patch.note,
		updatedAt: nowIso(),
	}

	const validation = validateMeasurementFields({
		systolic: next.systolic,
		diastolic: next.diastolic,
		pulse: next.pulse,
		periodOfDay: next.periodOfDay,
		tags: next.tags,
		measuredAt: next.measuredAt,
	})
	if (!validation.ok) {
		throw new Error(`Invalid measurement update: ${validation.code}`)
	}

	return next
}
