import {
	computeMeasurementStats,
	filterByDateRange,
	filterByPeriodOfDay,
	filterByTag,
	groupByDay,
	groupByTag,
} from '@/domain/statistics/measurement-stats'
import type { Measurement } from '@/domain/types'

function m(
	partial: Partial<Measurement> &
		Pick<Measurement, 'id' | 'systolic' | 'diastolic' | 'pulse' | 'measuredAt' | 'periodOfDay'>,
): Measurement {
	return {
		profileId: 'p1',
		wellbeing: null,
		tags: [],
		note: null,
		createdAt: partial.measuredAt,
		updatedAt: partial.measuredAt,
		...partial,
	}
}

describe('measurement statistics', () => {
	const sample: Measurement[] = [
		m({
			id: '1',
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-01T08:00:00.000Z',
			periodOfDay: 'morning',
			tags: ['stress'],
		}),
		m({
			id: '2',
			systolic: 140,
			diastolic: 90,
			pulse: 80,
			measuredAt: '2026-08-01T19:00:00.000Z',
			periodOfDay: 'evening',
			tags: ['stress', 'coffee'],
		}),
		m({
			id: '3',
			systolic: 130,
			diastolic: 85,
			pulse: 75,
			measuredAt: '2026-08-02T09:00:00.000Z',
			periodOfDay: 'morning',
			tags: ['normal'],
		}),
	]

	it('computes averages and min/max', () => {
		const stats = computeMeasurementStats(sample)
		expect(stats.count).toBe(3)
		expect(stats.avgSystolic).toBeCloseTo(130)
		expect(stats.avgDiastolic).toBeCloseTo(85)
		expect(stats.avgPulse).toBeCloseTo(75)
		expect(stats.minSystolic).toBe(120)
		expect(stats.maxSystolic).toBe(140)
		expect(stats.minPulse).toBe(70)
		expect(stats.maxPulse).toBe(80)
	})

	it('returns null aggregates for empty set', () => {
		const stats = computeMeasurementStats([])
		expect(stats.count).toBe(0)
		expect(stats.avgSystolic).toBeNull()
		expect(stats.minDiastolic).toBeNull()
	})

	it('filters by date range inclusively', () => {
		const filtered = filterByDateRange(sample, {
			from: '2026-08-01T00:00:00.000Z',
			to: '2026-08-01T23:59:59.000Z',
		})
		expect(filtered.map((x) => x.id)).toEqual(['1', '2'])
	})

	it('filters morning/evening periods', () => {
		expect(filterByPeriodOfDay(sample, 'morning')).toHaveLength(2)
		expect(filterByPeriodOfDay(sample, 'evening')).toHaveLength(1)
	})

	it('filters and groups by tag without medical claims', () => {
		const stress = filterByTag(sample, 'stress')
		expect(stress).toHaveLength(2)
		const groups = groupByTag(sample)
		const stressGroup = groups.find((g) => g.tag === 'stress')
		expect(stressGroup?.stats.avgSystolic).toBe(130)
	})

	it('groups by day', () => {
		const days = groupByDay(sample)
		expect(days.map((d) => d.day)).toEqual(['2026-08-01', '2026-08-02'])
		expect(days[0]?.measurements).toHaveLength(2)
	})
})
