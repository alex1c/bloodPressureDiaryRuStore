import { derivePeriodOfDay } from '@/domain/catalog'
import {
	isoFromLocalDateAndTime,
	localDayKeyFromIso,
} from '@/domain/dates/local-day'
import {
	buildChartSeries,
	computeMeasurementStats,
	downsampleChartSeries,
	filterByPeriodOfDay,
	filterByProfileId,
	filterByStatsPeriod,
	getStatsPeriodRange,
	groupByTag,
	groupHistoryByLocalDay,
} from '@/domain/statistics/measurement-stats'
import type { Measurement } from '@/domain/types'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'

function m(
	partial: Partial<Measurement> &
		Pick<
			Measurement,
			| 'id'
			| 'profileId'
			| 'systolic'
			| 'diastolic'
			| 'pulse'
			| 'measuredAt'
			| 'periodOfDay'
		>,
): Measurement {
	return {
		wellbeing: null,
		tags: [],
		note: null,
		createdAt: partial.measuredAt,
		updatedAt: partial.measuredAt,
		...partial,
	}
}

function localIso(day: string, time: string): string {
	const iso = isoFromLocalDateAndTime(day, time)
	if (!iso) {
		throw new Error(`bad local iso ${day} ${time}`)
	}
	return iso
}

describe('Phase 4 statistics ranges and history', () => {
	const reference = new Date(2026, 7, 26, 15, 0, 0, 0)

	const fixture: Measurement[] = [
		m({
			id: 'a',
			profileId: 'p1',
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: localIso('2026-08-26', '08:00'),
			periodOfDay: 'morning',
			tags: ['stress'],
		}),
		m({
			id: 'b',
			profileId: 'p1',
			systolic: 140,
			diastolic: 90,
			pulse: 80,
			measuredAt: localIso('2026-08-26', '20:00'),
			periodOfDay: 'evening',
			tags: ['stress', 'coffee'],
		}),
		m({
			id: 'c',
			profileId: 'p1',
			systolic: 130,
			diastolic: 85,
			pulse: 75,
			measuredAt: localIso('2026-08-20', '09:00'),
			periodOfDay: 'morning',
			tags: ['normal'],
		}),
		m({
			id: 'd',
			profileId: 'p1',
			systolic: 125,
			diastolic: 82,
			pulse: 72,
			measuredAt: localIso('2026-07-01', '10:00'),
			periodOfDay: 'morning',
		}),
		m({
			id: 'other',
			profileId: 'p2',
			systolic: 200,
			diastolic: 120,
			pulse: 100,
			measuredAt: localIso('2026-08-26', '12:00'),
			periodOfDay: 'day',
		}),
	]

	it('filters 7 / 30 / 90 day periods from reference', () => {
		expect(filterByStatsPeriod(fixture, 7, reference).map((x) => x.id)).toEqual(
			expect.arrayContaining(['a', 'b', 'c', 'other']),
		)
		expect(filterByStatsPeriod(fixture, 7, reference).map((x) => x.id)).not.toContain(
			'd',
		)

		const thirty = filterByStatsPeriod(fixture, 30, reference)
		expect(thirty.map((x) => x.id)).toContain('c')
		expect(thirty.map((x) => x.id)).not.toContain('d')

		const ninety = filterByStatsPeriod(fixture, 90, reference)
		expect(ninety.map((x) => x.id)).toContain('d')

		expect(getStatsPeriodRange('all', reference)).toBeNull()
		expect(filterByStatsPeriod(fixture, 'all', reference)).toHaveLength(5)
	})

	it('isolates profile before aggregating', () => {
		const onlyP1 = filterByProfileId(fixture, 'p1')
		expect(onlyP1.every((row) => row.profileId === 'p1')).toBe(true)
		expect(computeMeasurementStats(onlyP1).maxSystolic).toBe(140)
	})

	it('splits morning/evening averages', () => {
		const p1 = filterByProfileId(fixture, 'p1')
		const morning = computeMeasurementStats(
			filterByPeriodOfDay(p1, 'morning'),
		)
		const evening = computeMeasurementStats(
			filterByPeriodOfDay(p1, 'evening'),
		)
		expect(morning.count).toBe(3)
		expect(evening.count).toBe(1)
		expect(evening.avgSystolic).toBe(140)
	})

	it('groups history newest-first with same-day newest-first', () => {
		const groups = groupHistoryByLocalDay(filterByProfileId(fixture, 'p1'))
		expect(groups[0]?.day).toBe('2026-08-26')
		expect(groups[0]?.measurements.map((x) => x.id)).toEqual(['b', 'a'])
	})

	it('builds chronological chart series and downsamples large sets', () => {
		const series = buildChartSeries(filterByProfileId(fixture, 'p1'))
		expect(series.map((p) => p.measuredAt)).toEqual(
			[...series.map((p) => p.measuredAt)].sort(),
		)

		const large = Array.from({ length: 300 }, (_, i) =>
			m({
				id: `n${i}`,
				profileId: 'p1',
				systolic: 120 + (i % 10),
				diastolic: 80,
				pulse: 70,
				measuredAt: new Date(2026, 0, 1, 0, i).toISOString(),
				periodOfDay: 'day',
			}),
		)
		const down = downsampleChartSeries(buildChartSeries(large), 50)
		expect(down.length).toBeLessThanOrEqual(50)
		expect(down[0]?.measuredAt).toBe(buildChartSeries(large)[0]?.measuredAt)
		expect(down[down.length - 1]?.measuredAt).toBe(
			buildChartSeries(large)[299]?.measuredAt,
		)
	})

	it('handles empty and single-point stats', () => {
		expect(computeMeasurementStats([]).count).toBe(0)
		const one = computeMeasurementStats([fixture[0]!])
		expect(one.avgSystolic).toBe(120)
		expect(one.minSystolic).toBe(120)
		expect(one.maxSystolic).toBe(120)
	})

	it('groups tags with factual averages only', () => {
		const tags = groupByTag(filterByProfileId(fixture, 'p1'))
		const stress = tags.find((t) => t.tag === 'stress')
		expect(stress?.stats.count).toBe(2)
		expect(stress?.stats.avgSystolic).toBe(130)
	})

	it('keeps midnight boundary on the correct local day', () => {
		const late = localIso('2026-08-26', '23:50')
		const early = localIso('2026-08-27', '00:10')
		expect(localDayKeyFromIso(late)).toBe('2026-08-26')
		expect(localDayKeyFromIso(early)).toBe('2026-08-27')
		expect(derivePeriodOfDay(new Date(late))).toBe('night')
	})

	it('persists history edits through repository for active profile', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я', isDefault: true })
		const created = await store.measurements.create({
			profileId: profile.id,
			systolic: 128,
			diastolic: 82,
			pulse: 71,
			measuredAt: localIso('2026-08-26', '08:15'),
			periodOfDay: 'morning',
			tags: ['coffee'],
		})
		await store.measurements.update(created.id, { systolic: 133 })
		const listed = await store.measurements.listByProfile(profile.id)
		expect(listed[0]?.systolic).toBe(133)
		expect(listed[0]?.profileId).toBe(profile.id)
	})
})
