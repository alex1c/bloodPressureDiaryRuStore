import { derivePeriodOfDay } from '@/domain/catalog'
import {
	formatLocalDayKey,
	getLocalDayBounds,
	isIsoOnLocalDay,
	isoFromLocalDateAndTime,
	localDayKeyFromIso,
} from '@/domain/dates/local-day'
import {
	measurementFormErrorMessage,
	parseMeasurementForm,
} from '@/features/diary/input/parse-measurement-form'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'

describe('derivePeriodOfDay with night', () => {
	it('maps morning day evening night from local hours', () => {
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 8, 0))).toBe('morning')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 14, 0))).toBe('day')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 19, 0))).toBe('evening')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 23, 0))).toBe('night')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 2, 0))).toBe('night')
	})
})

describe('local day boundaries', () => {
	it('keeps late evening on the same local day as morning', () => {
		const evening = new Date(2026, 7, 26, 23, 30, 0, 0)
		const morning = new Date(2026, 7, 26, 0, 15, 0, 0)
		expect(formatLocalDayKey(evening)).toBe('2026-08-26')
		expect(formatLocalDayKey(morning)).toBe('2026-08-26')
		expect(isIsoOnLocalDay(evening.toISOString(), morning)).toBe(true)
	})

	it('does not treat just-after-midnight as previous local day', () => {
		const before = new Date(2026, 7, 26, 23, 59, 0, 0)
		const after = new Date(2026, 7, 27, 0, 1, 0, 0)
		expect(formatLocalDayKey(before)).toBe('2026-08-26')
		expect(formatLocalDayKey(after)).toBe('2026-08-27')
		expect(isIsoOnLocalDay(after.toISOString(), before)).toBe(false)
	})

	it('builds ISO from local date+time and filters range inclusively', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я', isDefault: true })
		const measuredAt = isoFromLocalDateAndTime('2026-08-26', '23:45')
		expect(measuredAt).toBeTruthy()

		await store.measurements.create({
			profileId: profile.id,
			systolic: 128,
			diastolic: 82,
			pulse: 71,
			measuredAt: measuredAt!,
			periodOfDay: derivePeriodOfDay(new Date(measuredAt!)),
			tags: ['stress'],
			note: 'ok',
		})

		const bounds = getLocalDayBounds(new Date(2026, 7, 26, 12, 0, 0, 0))
		const today = await store.measurements.listByProfileInRange(
			profile.id,
			bounds.fromIso,
			bounds.toIso,
		)
		expect(today).toHaveLength(1)
		expect(localDayKeyFromIso(today[0]!.measuredAt)).toBe('2026-08-26')
	})
})

describe('parseMeasurementForm', () => {
	const base = {
		dayKey: '2026-08-26',
		timeHm: '08:15',
		tags: [] as const,
		note: '',
	}

	it('requires integer BP and pulse', () => {
		const empty = parseMeasurementForm({
			...base,
			systolicText: '',
			diastolicText: '80',
			pulseText: '70',
			tags: [],
		})
		expect(empty.ok).toBe(false)
		if (!empty.ok) {
			expect(measurementFormErrorMessage(empty.code)).toMatch(/верхнее/i)
		}
	})

	it('rejects systolic not above diastolic', () => {
		const result = parseMeasurementForm({
			...base,
			systolicText: '80',
			diastolicText: '90',
			pulseText: '70',
			tags: [],
		})
		expect(result).toEqual({
			ok: false,
			code: 'SYSTOLIC_NOT_ABOVE_DIASTOLIC',
		})
	})

	it('parses valid form and derives periodOfDay', () => {
		const result = parseMeasurementForm({
			...base,
			systolicText: '128',
			diastolicText: '82',
			pulseText: '71',
			tags: ['coffee'],
			note: '  after coffee  ',
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.systolic).toBe(128)
			expect(result.note).toBe('after coffee')
			expect(result.tags).toEqual(['coffee'])
			expect(result.periodOfDay).toBe('morning')
			expect(result.softCheckMessage).toBeNull()
		}
	})

	it('surfaces soft check without blocking unusual values', () => {
		const result = parseMeasurementForm({
			...base,
			systolicText: '210',
			diastolicText: '100',
			pulseText: '70',
			tags: [],
		})
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.softCheckMessage).toBe('Проверьте введённое значение.')
		}
	})
})

describe('measurement edit/delete through repository', () => {
	it('creates edits and deletes with profile association', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я', isDefault: true })
		const created = await store.measurements.create({
			profileId: profile.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: isoFromLocalDateAndTime('2026-08-26', '08:00')!,
			periodOfDay: 'morning',
			tags: ['normal'],
			note: null,
		})

		const updated = await store.measurements.update(created.id, {
			systolic: 132,
			measuredAt: isoFromLocalDateAndTime('2026-08-26', '21:00')!,
			periodOfDay: 'evening',
			tags: ['stress', 'coffee'],
			note: 'evening',
		})
		expect(updated.systolic).toBe(132)
		expect(updated.tags).toEqual(['stress', 'coffee'])
		expect(updated.note).toBe('evening')
		expect(updated.updatedAt >= created.updatedAt).toBe(true)

		const reloaded = await store.measurements.getById(created.id)
		expect(reloaded?.systolic).toBe(132)

		await store.measurements.delete(created.id)
		expect(await store.measurements.getById(created.id)).toBeNull()
	})
})
