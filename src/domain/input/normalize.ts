/**
 * Locale-aware decimal parsing for Android text input.
 *
 * Keeps editable UI strings separate from parsed numbers: call these helpers
 * on submit, not on every keystroke.
 */

export type ParseNumberErrorCode =
	| 'EMPTY'
	| 'INVALID_FORMAT'
	| 'NOT_FINITE'
	| 'NEGATIVE'
	| 'NOT_POSITIVE'
	| 'OUT_OF_RANGE'
	| 'NOT_INTEGER'

export type ParseNumberResult =
	| { ok: true; value: number }
	| { ok: false; code: ParseNumberErrorCode }

/**
 * Normalizes locale decimal text: trim + comma → dot.
 * Does not invent a number from incomplete drafts such as `86,`.
 */
export function normalizeDecimalInput(raw: string): string {
	return raw.trim().replace(',', '.')
}

/**
 * Parses a user decimal string to a finite number.
 * Accepts `86`, `86.5`, `86,5`. Rejects empty, `86,`, NaN, Infinity, junk.
 */
export function parseUserDecimalNumber(
	raw: string,
	options: {
		allowZero?: boolean
		allowNegative?: boolean
		min?: number
		max?: number
	} = {},
): ParseNumberResult {
	const trimmed = raw.trim()

	if (trimmed.length === 0) {
		return { ok: false, code: 'EMPTY' }
	}

	const normalized = normalizeDecimalInput(trimmed)

	if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
		return { ok: false, code: 'INVALID_FORMAT' }
	}

	const value = Number(normalized)

	if (!Number.isFinite(value)) {
		return { ok: false, code: 'NOT_FINITE' }
	}

	if (value < 0 && !options.allowNegative) {
		return { ok: false, code: 'NEGATIVE' }
	}

	if (!options.allowZero && value === 0) {
		return { ok: false, code: 'NOT_POSITIVE' }
	}

	if (options.min !== undefined && value < options.min) {
		return { ok: false, code: 'OUT_OF_RANGE' }
	}

	if (options.max !== undefined && value > options.max) {
		return { ok: false, code: 'OUT_OF_RANGE' }
	}

	return { ok: true, value }
}

/**
 * Parses integer blood-pressure / pulse input.
 * Rejects decimals even if they look like `120.0`.
 */
export function parseUserIntegerNumber(
	raw: string,
	options: { min?: number; max?: number; allowZero?: boolean } = {},
): ParseNumberResult {
	const trimmed = raw.trim()

	if (trimmed.length === 0) {
		return { ok: false, code: 'EMPTY' }
	}

	if (!/^\d+$/.test(trimmed)) {
		return { ok: false, code: 'NOT_INTEGER' }
	}

	const value = Number(trimmed)

	if (!Number.isFinite(value)) {
		return { ok: false, code: 'NOT_FINITE' }
	}

	if (!options.allowZero && value === 0) {
		return { ok: false, code: 'NOT_POSITIVE' }
	}

	if (options.min !== undefined && value < options.min) {
		return { ok: false, code: 'OUT_OF_RANGE' }
	}

	if (options.max !== undefined && value > options.max) {
		return { ok: false, code: 'OUT_OF_RANGE' }
	}

	return { ok: true, value }
}

/** Practical journal bounds — not diagnostic thresholds. Hard reject outside. */
export const BP_INPUT_BOUNDS = {
	systolic: { min: 50, max: 300 },
	diastolic: { min: 30, max: 200 },
	pulse: { min: 20, max: 250 },
} as const

/**
 * Soft expected ranges — unusual but possible values.
 * UI may ask the user to double-check; must not block save as a "diagnosis".
 */
export const BP_SOFT_RANGES = {
	systolic: { min: 80, max: 200 },
	diastolic: { min: 40, max: 130 },
	pulse: { min: 35, max: 180 },
} as const

export function isOutsideSoftBpRange(
	field: 'systolic' | 'diastolic' | 'pulse',
	value: number,
): boolean {
	const range = BP_SOFT_RANGES[field]
	return value < range.min || value > range.max
}

export function parseSystolicInput(raw: string): ParseNumberResult {
	return parseUserIntegerNumber(raw, BP_INPUT_BOUNDS.systolic)
}

export function parseDiastolicInput(raw: string): ParseNumberResult {
	return parseUserIntegerNumber(raw, BP_INPUT_BOUNDS.diastolic)
}

export function parsePulseInput(raw: string): ParseNumberResult {
	return parseUserIntegerNumber(raw, BP_INPUT_BOUNDS.pulse)
}

export function parseWeightKgInput(raw: string): ParseNumberResult {
	return parseUserDecimalNumber(raw, { min: 1, max: 500 })
}

export function parseGlucoseInput(raw: string): ParseNumberResult {
	return parseUserDecimalNumber(raw, { min: 0.1, max: 50, allowZero: false })
}

export function parseTemperatureCInput(raw: string): ParseNumberResult {
	return parseUserDecimalNumber(raw, { min: 30, max: 45 })
}

export function parseSpo2Input(raw: string): ParseNumberResult {
	return parseUserIntegerNumber(raw, { min: 50, max: 100 })
}

/**
 * Keeps editable decimal text as typed (including incomplete `86,`).
 * Validation happens on submit.
 */
export function filterDecimalInputText(raw: string): string {
	return raw
}

/** Allows digits only for BP / pulse draft fields. */
export function filterIntegerInputText(raw: string): string {
	return raw.replace(/[^\d]/g, '')
}
