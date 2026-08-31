import {
	DEFAULT_REPORT_PERIOD_DAYS,
	buildDoctorReportData,
	buildDoctorReportFileName,
	formatReportPeriodLabelRu,
	getInclusiveLocalDayRange,
	getReportPresetRange,
	sanitizeFileNamePart,
} from '@/domain/report/build-doctor-report'
import {
	escapeHtml,
	renderDoctorReportHtml,
} from '@/domain/report/render-doctor-report-html'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'

describe('report period ranges', () => {
	const ref = new Date(2026, 7, 31, 15, 0, 0) // 31 Aug 2026 local

	it('defaults to 14 days', () => {
		expect(DEFAULT_REPORT_PERIOD_DAYS).toBe(14)
	})

	it('builds inclusive 7/14/30/90 local-day windows', () => {
		const r14 = getReportPresetRange(14, ref)
		expect(r14.from).toBe(
			new Date(2026, 7, 18, 0, 0, 0, 0).toISOString(),
		)
		expect(r14.to).toBe(
			new Date(2026, 7, 31, 23, 59, 59, 999).toISOString(),
		)

		const r7 = getReportPresetRange(7, ref)
		expect(r7.from).toBe(new Date(2026, 7, 25, 0, 0, 0, 0).toISOString())

		const r30 = getReportPresetRange(30, ref)
		expect(r30.from).toBe(new Date(2026, 7, 2, 0, 0, 0, 0).toISOString())

		const r90 = getReportPresetRange(90, ref)
		expect(r90.from).toBe(new Date(2026, 5, 3, 0, 0, 0, 0).toISOString())
	})

	it('supports custom inclusive day keys', () => {
		const range = getInclusiveLocalDayRange('2026-08-17', '2026-08-31')
		expect(range).not.toBeNull()
		expect(range!.from).toBe(
			new Date(2026, 7, 17, 0, 0, 0, 0).toISOString(),
		)
		expect(range!.to).toBe(
			new Date(2026, 7, 31, 23, 59, 59, 999).toISOString(),
		)
		expect(getInclusiveLocalDayRange('2026-08-31', '2026-08-17')).toBeNull()
		expect(getInclusiveLocalDayRange('bad', '2026-08-31')).toBeNull()
	})

	it('formats Russian period labels', () => {
		const range = getInclusiveLocalDayRange('2026-08-17', '2026-08-31')!
		expect(formatReportPeriodLabelRu(range)).toContain('17')
		expect(formatReportPeriodLabelRu(range)).toContain('31')
		expect(formatReportPeriodLabelRu(range)).toContain('2026')
	})
})

describe('buildDoctorReportData', () => {
	it('isolates profiles and builds chronological measurements', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const mom = await store.profiles.create({ name: 'Мама' })

		await store.measurements.create({
			profileId: me.id,
			systolic: 128,
			diastolic: 82,
			pulse: 70,
			measuredAt: '2026-08-20T06:00:00.000Z',
			periodOfDay: 'morning',
			tags: ['stress'],
			note: 'ok',
		})
		await store.measurements.create({
			profileId: me.id,
			systolic: 134,
			diastolic: 84,
			pulse: 72,
			measuredAt: '2026-08-25T18:00:00.000Z',
			periodOfDay: 'evening',
			tags: ['stress'],
		})
		await store.measurements.create({
			profileId: mom.id,
			systolic: 145,
			diastolic: 88,
			pulse: 74,
			measuredAt: '2026-08-25T08:00:00.000Z',
			periodOfDay: 'morning',
		})

		const med = await store.medications.create({
			profileId: me.id,
			name: 'Лозартан',
			dosageText: '50 мг',
			schedule: [
				{ hour: 8, minute: 0 },
				{ hour: 20, minute: 0 },
			],
			isActive: true,
		})
		await store.medications.create({
			profileId: mom.id,
			name: 'B',
			dosageText: '1',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})
		await store.medicationIntakes.create({
			profileId: me.id,
			medicationId: med.id,
			takenAt: '2026-08-25T08:10:00.000Z',
			scheduledHour: 8,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})

		await store.healthMetrics.create({
			profileId: me.id,
			kind: 'weight',
			value: 86.5,
			unit: 'кг',
			measuredAt: '2026-08-25T07:00:00.000Z',
			note: null,
		})
		await store.profileMetricSettings.setEnabledKinds(me.id, ['weight'])

		const report = await buildDoctorReportData({
			repos: store,
			profileId: me.id,
			selection: { kind: 'preset', days: 30 },
			reference: new Date(2026, 7, 31, 12, 0, 0),
		})

		expect(report.profileName).toBe('Я')
		expect(report.bp.count).toBe(2)
		expect(report.bp.avgSystolic).toBe(131)
		expect(report.bp.morning?.avgSystolic).toBe(128)
		expect(report.bp.evening?.avgSystolic).toBe(134)
		expect(report.measurements.map((m) => m.systolic)).toEqual([128, 134])
		expect(report.tagStats[0]?.labelRu).toBe('Стресс')
		expect(report.tagStats[0]?.count).toBe(2)
		expect(report.medications).toHaveLength(1)
		expect(report.medications[0]?.name).toBe('Лозартан')
		expect(report.medications[0]?.takenCountInPeriod).toBe(1)
		expect(report.health[0]?.latestValueFormatted).toBe('86,5')
		expect(report.hasAnyData).toBe(true)

		const momReport = await buildDoctorReportData({
			repos: store,
			profileId: mom.id,
			selection: { kind: 'preset', days: 30 },
			reference: new Date(2026, 7, 31, 12, 0, 0),
		})
		expect(momReport.bp.count).toBe(1)
		expect(momReport.bp.avgSystolic).toBe(145)
		expect(momReport.medications[0]?.name).toBe('B')
		expect(momReport.health).toHaveLength(0)
	})

	it('hides empty sections and marks empty reports', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const report = await buildDoctorReportData({
			repos: store,
			profileId: me.id,
			selection: { kind: 'preset', days: 7 },
			reference: new Date(2026, 7, 31),
		})
		expect(report.hasAnyData).toBe(false)
		expect(report.bp.count).toBe(0)
		expect(report.measurements).toEqual([])
		expect(report.tagStats).toEqual([])
		expect(report.medications).toEqual([])
	})

	it('supports custom day boundaries for night-edge measurements', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const range = getInclusiveLocalDayRange('2026-08-17', '2026-08-17')!
		await store.measurements.create({
			profileId: me.id,
			systolic: 120,
			diastolic: 80,
			pulse: 60,
			measuredAt: range.from,
			periodOfDay: 'night',
		})
		await store.measurements.create({
			profileId: me.id,
			systolic: 121,
			diastolic: 81,
			pulse: 61,
			measuredAt: range.to,
			periodOfDay: 'night',
		})
		const report = await buildDoctorReportData({
			repos: store,
			profileId: me.id,
			selection: {
				kind: 'custom',
				fromDayKey: '2026-08-17',
				toDayKey: '2026-08-17',
			},
		})
		expect(report.bp.count).toBe(2)
	})
})

describe('filename + HTML renderer', () => {
	it('sanitizes filenames and transliterates Cyrillic', () => {
		expect(sanitizeFileNamePart('Мама Валя')).toBe('mama_valya')
		expect(sanitizeFileNamePart('Я')).toBe('ya')
		expect(sanitizeFileNamePart('a/b\\c:d')).toBe('abcd')
	})

	it('builds safe pdf filenames', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		await store.measurements.create({
			profileId: me.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-20T08:00:00.000Z',
			periodOfDay: 'morning',
		})
		const report = await buildDoctorReportData({
			repos: store,
			profileId: me.id,
			selection: { kind: 'preset', days: 14 },
			reference: new Date(2026, 7, 31),
		})
		const name = buildDoctorReportFileName(report)
		expect(name.startsWith('davlenie_ya_')).toBe(true)
		expect(name.endsWith('.pdf')).toBe(true)
		expect(name.includes('/')).toBe(false)
	})

	it('escapes HTML and preserves Russian + decimal comma', async () => {
		expect(escapeHtml('<script>"x"&')).toBe(
			'&lt;script&gt;&quot;x&quot;&amp;',
		)

		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({
			name: 'Мама <test>',
			isDefault: true,
		})
		await store.measurements.create({
			profileId: me.id,
			systolic: 130,
			diastolic: 85,
			pulse: 70,
			measuredAt: '2026-08-20T08:00:00.000Z',
			periodOfDay: 'morning',
			note: '<b>note</b>',
			tags: ['coffee'],
		})
		await store.healthMetrics.create({
			profileId: me.id,
			kind: 'weight',
			value: 86.5,
			unit: 'кг',
			measuredAt: '2026-08-20T07:00:00.000Z',
			note: null,
		})
		await store.profileMetricSettings.setEnabledKinds(me.id, ['weight'])

		const report = await buildDoctorReportData({
			repos: store,
			profileId: me.id,
			selection: { kind: 'preset', days: 30 },
			reference: new Date(2026, 7, 31),
		})
		const html = renderDoctorReportHtml(report)
		expect(html).toContain('charset="utf-8"')
		expect(html).toContain('Дневник давления')
		expect(html).toContain('Мама &lt;test&gt;')
		expect(html).not.toContain('<b>note</b>')
		expect(html).toContain('&lt;b&gt;note&lt;/b&gt;')
		expect(html).toContain('86,5')
		expect(html).toContain('кг')
		expect(html).toContain('не является медицинским прибором')
		expect(html).toContain('Кофе')
	})
})
