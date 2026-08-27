import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'
import {
	buildPlannedDosesForDay,
	findTakenIntakeForSlot,
	parseScheduleHm,
	summarizeTodaysDoses,
	uniqueScheduleTimes,
} from '@/domain/medications/schedule'
import { formatLocalDayKey } from '@/domain/dates/local-day'
import {
	syncMedicationReminders,
} from '@/services/reconcile-medication-reminders'
import { applyMigrations } from '@/storage/migrate'
import { CURRENT_SCHEMA_VERSION } from '@/storage/schema-version'
import type { SqlExecutor } from '@/storage/sql-executor'

jest.mock('@/services/medication-notifications', () => ({
	buildReminderContent: ({
		medicationName,
		dosageText,
	}: {
		medicationName: string
		dosageText: string
	}) => ({
		title: 'Лекарство по расписанию',
		body: dosageText
			? `${medicationName} — ${dosageText}`
			: medicationName,
	}),
	configureNotificationHandler: jest.fn(),
	ensureAndroidChannel: jest.fn(async () => {}),
	getNotificationPermissionState: jest.fn(async () => 'granted'),
	requestNotificationPermission: jest.fn(async () => 'granted'),
	scheduleDailyReminderNotification: jest.fn(async () => 'notif-1'),
	cancelPlatformNotification: jest.fn(async () => {}),
	cancelAllScheduledNotifications: jest.fn(async () => {}),
}))

describe('medication schedule parsing', () => {
	it('parses HH:mm wall-clock times', () => {
		expect(parseScheduleHm('8:00')).toEqual({ hour: 8, minute: 0 })
		expect(parseScheduleHm('20:30')).toEqual({ hour: 20, minute: 30 })
		expect(parseScheduleHm('25:00')).toBeNull()
		expect(parseScheduleHm('abc')).toBeNull()
	})

	it('dedupes and sorts multiple daily times', () => {
		expect(
			uniqueScheduleTimes([
				{ hour: 20, minute: 0 },
				{ hour: 8, minute: 0 },
				{ hour: 8, minute: 0 },
			]),
		).toEqual([
			{ hour: 8, minute: 0 },
			{ hour: 20, minute: 0 },
		])
	})
})

describe('today planned doses', () => {
	const day = new Date(2026, 7, 27, 12, 0, 0) // local Aug 27 2026

	it('builds doses from active medication schedule without inventing intakes', () => {
		const doses = buildPlannedDosesForDay(
			[
				{
					id: 'm1',
					profileId: 'p1',
					name: 'Лозартан',
					dosageText: '50 мг',
					schedule: [
						{ hour: 8, minute: 0 },
						{ hour: 20, minute: 0 },
					],
					isActive: true,
					createdAt: '',
					updatedAt: '',
				},
			],
			[],
			day,
		)
		expect(doses).toHaveLength(2)
		expect(doses.every((d) => d.status === 'pending')).toBe(true)
		expect(doses.every((d) => d.intake === null)).toBe(true)
	})

	it('marks a slot taken and prevents duplicate matching', () => {
		const takenAt = new Date(2026, 7, 27, 8, 7, 0).toISOString()
		const intakes = [
			{
				id: 'i1',
				profileId: 'p1',
				medicationId: 'm1',
				takenAt,
				scheduledHour: 8,
				scheduledMinute: 0,
				taken: true,
				note: null,
				createdAt: takenAt,
				updatedAt: takenAt,
			},
		]
		const doses = buildPlannedDosesForDay(
			[
				{
					id: 'm1',
					profileId: 'p1',
					name: 'Лозартан',
					dosageText: '50 мг',
					schedule: [
						{ hour: 8, minute: 0 },
						{ hour: 20, minute: 0 },
					],
					isActive: true,
					createdAt: '',
					updatedAt: '',
				},
			],
			intakes,
			day,
		)
		expect(doses[0]?.status).toBe('taken')
		expect(doses[1]?.status).toBe('pending')
		const summary = summarizeTodaysDoses(doses)
		expect(summary).toEqual({
			total: 2,
			taken: 1,
			nextPending: doses[1],
		})
		expect(
			findTakenIntakeForSlot(intakes, 'm1', 8, 0, day)?.id,
		).toBe('i1')
		expect(findTakenIntakeForSlot(intakes, 'm1', 20, 0, day)).toBeNull()
	})

	it('ignores intakes from a different local day (midnight boundary)', () => {
		const yesterday = new Date(2026, 7, 26, 23, 50, 0).toISOString()
		const doses = buildPlannedDosesForDay(
			[
				{
					id: 'm1',
					profileId: 'p1',
					name: 'A',
					dosageText: '',
					schedule: [{ hour: 8, minute: 0 }],
					isActive: true,
					createdAt: '',
					updatedAt: '',
				},
			],
			[
				{
					id: 'i1',
					profileId: 'p1',
					medicationId: 'm1',
					takenAt: yesterday,
					scheduledHour: 8,
					scheduledMinute: 0,
					taken: true,
					note: null,
					createdAt: yesterday,
					updatedAt: yesterday,
				},
			],
			day,
		)
		expect(doses[0]?.status).toBe('pending')
		expect(formatLocalDayKey(day)).not.toBe(
			formatLocalDayKey(new Date(yesterday)),
		)
	})

	it('skips inactive medications', () => {
		const doses = buildPlannedDosesForDay(
			[
				{
					id: 'm1',
					profileId: 'p1',
					name: 'Old',
					dosageText: '',
					schedule: [{ hour: 9, minute: 0 }],
					isActive: false,
					createdAt: '',
					updatedAt: '',
				},
			],
			[],
			day,
		)
		expect(doses).toEqual([])
	})
})

describe('medication intake history + profile isolation', () => {
	it('preserves intakes when medication schedule is edited', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		const med = await store.medications.create({
			profileId: profile.id,
			name: 'Лозартан',
			dosageText: '50 мг',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})
		await store.medicationIntakes.create({
			profileId: profile.id,
			medicationId: med.id,
			takenAt: new Date().toISOString(),
			scheduledHour: 8,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})
		await store.medications.update(med.id, {
			schedule: [
				{ hour: 8, minute: 0 },
				{ hour: 20, minute: 0 },
			],
		})
		const history = await store.medicationIntakes.listByMedication(med.id)
		expect(history).toHaveLength(1)
		expect(history[0]?.scheduledHour).toBe(8)
	})

	it('deactivate keeps intake history', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		const med = await store.medications.create({
			profileId: profile.id,
			name: 'A',
			dosageText: '',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})
		await store.medicationIntakes.create({
			profileId: profile.id,
			medicationId: med.id,
			takenAt: new Date().toISOString(),
			scheduledHour: 9,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})
		await store.medications.update(med.id, { isActive: false })
		expect(await store.medicationIntakes.listByMedication(med.id)).toHaveLength(
			1,
		)
	})

	it('undo deletes intake (no duplicate after remake)', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		const med = await store.medications.create({
			profileId: profile.id,
			name: 'A',
			dosageText: '',
			schedule: [{ hour: 10, minute: 0 }],
			isActive: true,
		})
		const intake = await store.medicationIntakes.create({
			profileId: profile.id,
			medicationId: med.id,
			takenAt: new Date().toISOString(),
			scheduledHour: 10,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})
		await store.medicationIntakes.delete(intake.id)
		expect(await store.medicationIntakes.listByMedication(med.id)).toEqual([])
	})

	it('isolates medications by profile', async () => {
		const store = createMemoryDiaryStore()
		const a = await store.profiles.create({ name: 'A', isDefault: true })
		const b = await store.profiles.create({ name: 'B', isDefault: false })
		await store.medications.create({
			profileId: a.id,
			name: 'OnlyA',
			dosageText: '',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})
		await store.medications.create({
			profileId: b.id,
			name: 'OnlyB',
			dosageText: '',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})
		expect(await store.medications.listByProfile(a.id)).toHaveLength(1)
		expect((await store.medications.listByProfile(a.id))[0]?.name).toBe(
			'OnlyA',
		)
		expect(await store.medications.listByProfile(b.id)).toHaveLength(1)
	})
})

describe('reminder sync', () => {
	it('creates reminders for each schedule time and removes orphans on edit', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		let med = await store.medications.create({
			profileId: profile.id,
			name: 'Лозартан',
			dosageText: '50 мг',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})
		await syncMedicationReminders({
			repos: store,
			medication: med,
			remindEnabled: true,
		})
		expect(await store.reminders.listByProfile(profile.id)).toHaveLength(1)

		med = await store.medications.update(med.id, {
			schedule: [
				{ hour: 8, minute: 0 },
				{ hour: 20, minute: 0 },
			],
		})
		await syncMedicationReminders({
			repos: store,
			medication: med,
			remindEnabled: true,
		})
		const reminders = await store.reminders.listByProfile(profile.id)
		expect(reminders).toHaveLength(2)
		expect(
			reminders.map((r) => `${r.hour}:${r.minute}`).sort(),
		).toEqual(['20:0', '8:0'])

		await syncMedicationReminders({
			repos: store,
			medication: med,
			remindEnabled: false,
		})
		expect(await store.reminders.listByProfile(profile.id)).toEqual([])
	})
})

describe('schema migration to v2', () => {
	it('upgrades from v1 to CURRENT without dropping tables', async () => {
		const tables = new Set<string>()
		let schema = 0
		const db: SqlExecutor = {
			async exec(sql) {
				if (sql.includes('CREATE TABLE') && sql.includes('measurements')) {
					tables.add('measurements')
				}
				if (sql.includes('ALTER TABLE medication_intakes')) {
					tables.add('altered_intakes')
				}
			},
			async run(sql, params = []) {
				if (sql.includes('INSERT INTO meta') || sql.includes('ON CONFLICT')) {
					schema = Number(params[1])
				}
			},
			async getAll() {
				return []
			},
			async getFirst(sql) {
				if (sql.includes('FROM meta') && schema > 0) {
					return { value: String(schema) } as never
				}
				return null
			},
			async withTransaction(fn) {
				return fn()
			},
		}

		const version = await applyMigrations(db)
		expect(version).toBe(CURRENT_SCHEMA_VERSION)
		expect(CURRENT_SCHEMA_VERSION).toBe(2)
		expect(tables.has('measurements')).toBe(true)
		expect(tables.has('altered_intakes')).toBe(true)
	})

	it('is a no-op at v2', async () => {
		const db: SqlExecutor = {
			async exec() {},
			async run() {
				throw new Error('should not migrate')
			},
			async getAll() {
				return []
			},
			async getFirst<T>() {
				return { value: '2' } as T
			},
			async withTransaction(fn) {
				return fn()
			},
		}
		await expect(applyMigrations(db)).resolves.toBe(2)
	})
})
