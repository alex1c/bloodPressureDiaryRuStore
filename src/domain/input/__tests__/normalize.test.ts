import {
	normalizeDecimalInput,
	parseDiastolicInput,
	parsePulseInput,
	parseSystolicInput,
	parseTemperatureCInput,
	parseUserDecimalNumber,
	parseUserIntegerNumber,
	parseWeightKgInput,
} from '@/domain/input/normalize'

describe('normalizeDecimalInput', () => {
	it('converts comma to dot', () => {
		expect(normalizeDecimalInput('86,5')).toBe('86.5')
	})

	it('keeps dot decimals', () => {
		expect(normalizeDecimalInput('86.5')).toBe('86.5')
	})
})

describe('parseUserDecimalNumber', () => {
	it('accepts comma and dot weight-like values', () => {
		expect(parseUserDecimalNumber('86,5')).toEqual({ ok: true, value: 86.5 })
		expect(parseUserDecimalNumber('86.5')).toEqual({ ok: true, value: 86.5 })
	})

	it('rejects incomplete trailing separator', () => {
		expect(parseUserDecimalNumber('86,')).toEqual({
			ok: false,
			code: 'INVALID_FORMAT',
		})
	})

	it('rejects empty and junk', () => {
		expect(parseUserDecimalNumber('')).toEqual({ ok: false, code: 'EMPTY' })
		expect(parseUserDecimalNumber('abc')).toEqual({
			ok: false,
			code: 'INVALID_FORMAT',
		})
	})

	it('rejects zero unless allowZero', () => {
		expect(parseUserDecimalNumber('0')).toEqual({
			ok: false,
			code: 'NOT_POSITIVE',
		})
		expect(parseUserDecimalNumber('0', { allowZero: true })).toEqual({
			ok: true,
			value: 0,
		})
	})
})

describe('parseUserIntegerNumber / BP fields', () => {
	it('parses systolic diastolic pulse integers', () => {
		expect(parseSystolicInput('120')).toEqual({ ok: true, value: 120 })
		expect(parseDiastolicInput('80')).toEqual({ ok: true, value: 80 })
		expect(parsePulseInput('72')).toEqual({ ok: true, value: 72 })
	})

	it('rejects decimals for integer BP input', () => {
		expect(parseSystolicInput('120.5')).toEqual({
			ok: false,
			code: 'NOT_INTEGER',
		})
		expect(parseUserIntegerNumber('120,5')).toEqual({
			ok: false,
			code: 'NOT_INTEGER',
		})
	})

	it('rejects out of journal bounds', () => {
		expect(parseSystolicInput('10')).toEqual({
			ok: false,
			code: 'OUT_OF_RANGE',
		})
		expect(parsePulseInput('999')).toEqual({
			ok: false,
			code: 'OUT_OF_RANGE',
		})
	})
})

describe('health metric parsers', () => {
	it('accepts weight and temperature with comma', () => {
		expect(parseWeightKgInput('86,5')).toEqual({ ok: true, value: 86.5 })
		expect(parseTemperatureCInput('36,6')).toEqual({ ok: true, value: 36.6 })
	})
})
