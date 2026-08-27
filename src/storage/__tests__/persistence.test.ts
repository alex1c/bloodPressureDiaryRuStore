import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'
import {
	CURRENT_SCHEMA_VERSION,
	listMigrationVersions,
} from '@/storage'
import { applyMigrations } from '@/storage/migrate'
import type { SqlExecutor } from '@/storage/sql-executor'

describe('migrations', () => {
	it('lists contiguous versions starting at 1', () => {
		const versions = listMigrationVersions()
		expect(versions[0]).toBe(1)
		for (let i = 1; i < versions.length; i += 1) {
			expect(versions[i]).toBe(versions[i - 1]! + 1)
		}
		expect(versions[versions.length - 1]).toBe(CURRENT_SCHEMA_VERSION)
	})

	it('applies pending migrations and stores schemaVersion', async () => {
		let schema = 0
		const statements: string[] = []
		const db: SqlExecutor = {
			async exec(sql) {
				statements.push(sql)
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
		expect(statements.length).toBeGreaterThan(0)
	})

	it('is a no-op when already at current version', async () => {
		const db: SqlExecutor = {
			async exec() {},
			async run() {
				throw new Error('should not run migrations')
			},
			async getAll() {
				return []
			},
			async getFirst<T>() {
				return { value: String(CURRENT_SCHEMA_VERSION) } as T
			},
			async withTransaction(fn) {
				return fn()
			},
		}
		await expect(applyMigrations(db)).resolves.toBe(CURRENT_SCHEMA_VERSION)
	})
})

describe('memory diary persistence', () => {
	it('supports measurement CRUD', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я', isDefault: true })

		const created = await store.measurements.create({
			profileId: profile.id,
			systolic: 125,
			diastolic: 82,
			pulse: 68,
			measuredAt: '2026-08-26T07:30:00.000Z',
			periodOfDay: 'morning',
			tags: ['coffee'],
			note: null,
			wellbeing: 'ok',
		})

		expect(created.id).toBeTruthy()
		const listed = await store.measurements.listByProfile(profile.id)
		expect(listed).toHaveLength(1)

		const updated = await store.measurements.update(created.id, {
			systolic: 128,
			note: 'after coffee',
		})
		expect(updated.systolic).toBe(128)
		expect(updated.note).toBe('after coffee')

		await store.measurements.delete(created.id)
		expect(await store.measurements.listByProfile(profile.id)).toHaveLength(0)
	})

	it('isolates data by profileId', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я' })
		const mom = await store.profiles.create({ name: 'Мама' })

		await store.measurements.create({
			profileId: me.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-26T08:00:00.000Z',
			periodOfDay: 'morning',
		})
		await store.measurements.create({
			profileId: mom.id,
			systolic: 135,
			diastolic: 85,
			pulse: 74,
			measuredAt: '2026-08-26T08:05:00.000Z',
			periodOfDay: 'morning',
		})

		expect(await store.measurements.listByProfile(me.id)).toHaveLength(1)
		expect(await store.measurements.listByProfile(mom.id)).toHaveLength(1)
		expect(
			(await store.measurements.listByProfile(me.id))[0]?.systolic,
		).toBe(120)
	})

	it('lists today measurements by day key', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я' })
		await store.measurements.create({
			profileId: profile.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-26T08:00:00.000Z',
			periodOfDay: 'morning',
		})
		await store.measurements.create({
			profileId: profile.id,
			systolic: 122,
			diastolic: 81,
			pulse: 71,
			measuredAt: '2026-08-25T08:00:00.000Z',
			periodOfDay: 'morning',
		})

		const today = await store.measurements.listByProfileOnDay(
			profile.id,
			'2026-08-26',
		)
		expect(today).toHaveLength(1)
	})

	it('keeps medication schedule separate from intake facts', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я' })
		const med = await store.medications.create({
			profileId: profile.id,
			name: 'Example',
			dosageText: '5 мг',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})

		expect(med.schedule).toEqual([{ hour: 8, minute: 0 }])
		expect(await store.medicationIntakes.listByMedication(med.id)).toEqual([])

		const intake = await store.medicationIntakes.create({
			profileId: profile.id,
			medicationId: med.id,
			takenAt: '2026-08-26T08:05:00.000Z',
			scheduledHour: 8,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})

		expect(intake.taken).toBe(true)
		expect(intake.scheduledHour).toBe(8)
		expect(await store.medicationIntakes.listByMedication(med.id)).toHaveLength(
			1,
		)
		// Schedule unchanged after recording an intake fact.
		const meds = await store.medications.listByProfile(profile.id)
		expect(meds[0]?.schedule).toEqual([{ hour: 8, minute: 0 }])
	})

	it('stores reminders without requiring notification delivery yet', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я' })
		const reminder = await store.reminders.create({
			profileId: profile.id,
			medicationId: null,
			title: 'Измерить давление',
			body: null,
			hour: 8,
			minute: 0,
			weekdays: [1, 2, 3, 4, 5],
			enabled: true,
			platformNotificationId: null,
		})
		expect(reminder.platformNotificationId).toBeNull()
		expect(reminder.enabled).toBe(true)
	})

	it('rejects invalid measurement integers via domain builder', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я' })
		await expect(
			store.measurements.create({
				profileId: profile.id,
				systolic: 12,
				diastolic: 80,
				pulse: 70,
				measuredAt: '2026-08-26T08:00:00.000Z',
				periodOfDay: 'morning',
			}),
		).rejects.toThrow(/INVALID_SYSTOLIC/)
	})

	it('treats optional note null vs string distinctly', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({ name: 'Я' })
		const withNull = await store.measurements.create({
			profileId: profile.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-26T08:00:00.000Z',
			periodOfDay: 'morning',
			note: null,
		})
		expect(withNull.note).toBeNull()

		const cleared = await store.measurements.update(withNull.id, {
			note: '',
		})
		expect(cleared.note).toBe('')
	})

	it('exposes current schema version', async () => {
		const store = createMemoryDiaryStore()
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION)
	})
})
