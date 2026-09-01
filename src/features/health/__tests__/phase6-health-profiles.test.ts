import {
	computePreviousDelta,
	formatMetricValue,
	parseMetricValue,
	DEFAULT_ENABLED_METRIC_KINDS,
} from '@/domain/health/metric-catalog'
import {
	parseGlucoseInput,
	parseSpo2Input,
	parseTemperatureCInput,
	parseWeightKgInput,
} from '@/domain/input/normalize'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'
import { CURRENT_SCHEMA_VERSION } from '@/storage/schema-version'
import { applyMigrations } from '@/storage/migrate'
import type { SqlExecutor } from '@/storage/sql-executor'
import {
	reconcileAllProfileNotifications,
	syncMedicationReminders,
} from '@/services/reconcile-medication-reminders'

jest.mock('@/services/medication-notifications', () => ({
	buildReminderContent: ({
		medicationName,
		dosageText,
		profileName,
		includeProfileName,
	}: {
		medicationName: string
		dosageText: string
		profileName?: string | null
		includeProfileName?: boolean
	}) => ({
		title:
			includeProfileName && profileName
				? `${profileName} — лекарство по расписанию`
				: 'Лекарство по расписанию',
		body: dosageText
			? `${medicationName} — ${dosageText}`
			: medicationName,
	}),
	configureNotificationHandler: jest.fn(),
	ensureAndroidChannel: jest.fn(async () => {}),
	getNotificationPermissionState: jest.fn(async () => 'granted'),
	requestNotificationPermission: jest.fn(async () => 'granted'),
	scheduleDailyReminderNotification: jest.fn(async (reminder: { id: string }) => {
		return `notif-${reminder.id}`
	}),
	cancelPlatformNotification: jest.fn(async () => {}),
	cancelPlatformNotificationIds: jest.fn(async () => {}),
	cancelManagedPlatformNotifications: jest.fn(async () => {}),
	cancelAllScheduledNotifications: jest.fn(async () => {}),
}))

describe('health metric parsing', () => {
	it('parses weight with comma and dot', () => {
		expect(parseWeightKgInput('86,5')).toEqual({ ok: true, value: 86.5 })
		expect(parseWeightKgInput('86.5')).toEqual({ ok: true, value: 86.5 })
		expect(parseMetricValue('weight', '86,5')).toEqual({
			ok: true,
			value: 86.5,
		})
	})

	it('parses glucose with comma', () => {
		expect(parseGlucoseInput('5,7')).toEqual({ ok: true, value: 5.7 })
		expect(parseMetricValue('glucose', '5.7')).toEqual({
			ok: true,
			value: 5.7,
		})
	})

	it('parses temperature with comma', () => {
		expect(parseTemperatureCInput('36,6')).toEqual({ ok: true, value: 36.6 })
	})

	it('parses SpO2 as integer percent', () => {
		expect(parseSpo2Input('97')).toEqual({ ok: true, value: 97 })
		expect(parseSpo2Input('97,5')).toEqual({
			ok: false,
			code: 'NOT_INTEGER',
		})
	})

	it('formats display with decimal comma', () => {
		expect(formatMetricValue('weight', 86.5)).toBe('86,5')
		expect(formatMetricValue('spo2', 97)).toBe('97')
	})
})

describe('health metric CRUD + settings', () => {
	it('stores metrics per profile and sorts newest first', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })

		await store.healthMetrics.create({
			profileId: me.id,
			kind: 'weight',
			value: 87,
			unit: 'кг',
			measuredAt: '2026-08-10T08:00:00.000Z',
			note: null,
		})
		const newer = await store.healthMetrics.create({
			profileId: me.id,
			kind: 'weight',
			value: 86.5,
			unit: 'кг',
			measuredAt: '2026-08-20T08:00:00.000Z',
			note: null,
		})
		const listed = await store.healthMetrics.listByProfileAndKind(
			me.id,
			'weight',
		)
		expect(listed[0]?.id).toBe(newer.id)
		expect(listed).toHaveLength(2)

		const updated = await store.healthMetrics.update(newer.id, {
			value: 86.4,
		})
		expect(updated.value).toBe(86.4)

		await store.healthMetrics.delete(newer.id)
		expect(
			await store.healthMetrics.listByProfileAndKind(me.id, 'weight'),
		).toHaveLength(1)
	})

	it('defaults enabled kinds to weight and persists toggles', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const settings = await store.profileMetricSettings.get(me.id)
		expect(settings.enabledKinds).toEqual([...DEFAULT_ENABLED_METRIC_KINDS])

		const next = await store.profileMetricSettings.setEnabledKinds(me.id, [
			'weight',
			'glucose',
		])
		expect(next.enabledKinds).toEqual(['weight', 'glucose'])
	})

	it('computes previous delta without medical labels', () => {
		const delta = computePreviousDelta('weight', [
			{
				id: '1',
				profileId: 'p',
				kind: 'weight',
				value: 86.4,
				unit: 'кг',
				measuredAt: '2026-08-20T00:00:00.000Z',
				note: null,
				createdAt: '',
				updatedAt: '',
			},
			{
				id: '2',
				profileId: 'p',
				kind: 'weight',
				value: 87.6,
				unit: 'кг',
				measuredAt: '2026-08-10T00:00:00.000Z',
				note: null,
				createdAt: '',
				updatedAt: '',
			},
		])
		expect(delta?.direction).toBe('down')
		expect(delta?.formatted).toContain('1,2')
	})
})

describe('family profile isolation', () => {
	it('keeps diary, meds, intakes, health separate across profiles', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const mom = await store.profiles.create({ name: 'Мама' })

		await store.measurements.create({
			profileId: me.id,
			systolic: 128,
			diastolic: 82,
			pulse: 70,
			measuredAt: '2026-08-26T08:00:00.000Z',
			periodOfDay: 'morning',
		})
		await store.measurements.create({
			profileId: mom.id,
			systolic: 145,
			diastolic: 88,
			pulse: 72,
			measuredAt: '2026-08-26T08:05:00.000Z',
			periodOfDay: 'morning',
		})

		const medA = await store.medications.create({
			profileId: me.id,
			name: 'A',
			dosageText: '1',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})
		const medB = await store.medications.create({
			profileId: mom.id,
			name: 'B',
			dosageText: '1',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})

		await store.medicationIntakes.create({
			profileId: me.id,
			medicationId: medA.id,
			takenAt: '2026-08-26T08:10:00.000Z',
			scheduledHour: 8,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})
		await store.medicationIntakes.create({
			profileId: mom.id,
			medicationId: medB.id,
			takenAt: '2026-08-26T09:10:00.000Z',
			scheduledHour: 9,
			scheduledMinute: 0,
			taken: true,
			note: null,
		})

		await store.healthMetrics.create({
			profileId: me.id,
			kind: 'weight',
			value: 86,
			unit: 'кг',
			measuredAt: '2026-08-26T07:00:00.000Z',
			note: null,
		})
		await store.healthMetrics.create({
			profileId: mom.id,
			kind: 'weight',
			value: 70,
			unit: 'кг',
			measuredAt: '2026-08-26T07:00:00.000Z',
			note: null,
		})

		await store.profileMetricSettings.setEnabledKinds(mom.id, [
			'glucose',
			'spo2',
		])

		expect(await store.measurements.listByProfile(me.id)).toHaveLength(1)
		expect(
			(await store.measurements.listByProfile(me.id))[0]?.systolic,
		).toBe(128)
		expect(
			(await store.measurements.listByProfile(mom.id))[0]?.systolic,
		).toBe(145)
		expect((await store.medications.listByProfile(me.id))[0]?.name).toBe('A')
		expect((await store.medications.listByProfile(mom.id))[0]?.name).toBe(
			'B',
		)
		expect(
			await store.medicationIntakes.listByProfile(me.id),
		).toHaveLength(1)
		expect(
			(await store.healthMetrics.listByProfile(me.id))[0]?.value,
		).toBe(86)
		expect(
			(await store.healthMetrics.listByProfile(mom.id))[0]?.value,
		).toBe(70)
		expect(
			(await store.profileMetricSettings.get(mom.id)).enabledKinds,
		).toEqual(['glucose', 'spo2'])
	})

	it('persists activeProfileId and falls back after delete', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const mom = await store.profiles.create({ name: 'Мама' })
		await store.settings.update({ activeProfileId: mom.id })
		expect((await store.settings.get()).activeProfileId).toBe(mom.id)

		await store.profiles.update(mom.id, { name: 'Мама Валя' })
		expect((await store.profiles.getById(mom.id))?.name).toBe('Мама Валя')

		await store.healthMetrics.create({
			profileId: mom.id,
			kind: 'weight',
			value: 70,
			unit: 'кг',
			measuredAt: '2026-08-26T07:00:00.000Z',
			note: null,
		})
		await store.profiles.delete(mom.id)
		expect(await store.profiles.getById(mom.id)).toBeNull()
		expect(await store.healthMetrics.listByProfile(mom.id)).toHaveLength(0)
		expect((await store.settings.get()).activeProfileId).toBe(me.id)
	})

	it('refuses deleting the last profile', async () => {
		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		await expect(store.profiles.delete(me.id)).rejects.toThrow(
			/last profile/i,
		)
		expect(await store.profiles.list()).toHaveLength(1)
	})
})

describe('reminder reconciliation across profiles', () => {
	it('schedules reminders for every profile after managed cancel', async () => {
		const {
			cancelManagedPlatformNotifications,
			scheduleDailyReminderNotification,
		} = jest.requireMock('@/services/medication-notifications') as {
			cancelManagedPlatformNotifications: jest.Mock
			scheduleDailyReminderNotification: jest.Mock
		}
		cancelManagedPlatformNotifications.mockClear()
		scheduleDailyReminderNotification.mockClear()

		const store = createMemoryDiaryStore()
		const me = await store.profiles.create({ name: 'Я', isDefault: true })
		const mom = await store.profiles.create({ name: 'Мама' })

		const medMe = await store.medications.create({
			profileId: me.id,
			name: 'A',
			dosageText: '10 мг',
			schedule: [{ hour: 8, minute: 0 }],
			isActive: true,
		})
		const medMom = await store.medications.create({
			profileId: mom.id,
			name: 'Лозартан',
			dosageText: '50 мг',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})

		await syncMedicationReminders({
			repos: store,
			medication: medMe,
			remindEnabled: true,
		})
		await syncMedicationReminders({
			repos: store,
			medication: medMom,
			remindEnabled: true,
		})

		const result = await reconcileAllProfileNotifications({ repos: store })
		expect(cancelManagedPlatformNotifications).toHaveBeenCalled()
		expect(result.scheduled).toBe(2)
		expect(scheduleDailyReminderNotification).toHaveBeenCalledTimes(2)

		const momReminders = await store.reminders.listByProfile(mom.id)
		expect(momReminders[0]?.title).toContain('Мама')
		expect(momReminders[0]?.profileId).toBe(mom.id)
	})
})

describe('schema version Phase 6', () => {
	it('reports schema version 3 and applies migration 003 SQL', async () => {
		expect(CURRENT_SCHEMA_VERSION).toBe(3)

		let schema = 2
		const execSql: string[] = []
		const profileIds = ['existing-profile']
		const db: SqlExecutor = {
			async exec(sql) {
				execSql.push(sql)
			},
			async run(sql, params = []) {
				if (sql.includes('INSERT INTO meta') || sql.includes('ON CONFLICT')) {
					schema = Number(params[1])
				}
			},
			async getAll(sql) {
				if (sql.includes('FROM profiles')) {
					return profileIds.map((id) => ({ id })) as never
				}
				return []
			},
			async getFirst(sql) {
				if (sql.includes('FROM meta')) {
					return { value: String(schema) } as never
				}
				return null
			},
			async withTransaction(fn) {
				return fn()
			},
		}

		const version = await applyMigrations(db)
		expect(version).toBe(3)
		expect(execSql.some((s) => s.includes('profile_metric_settings'))).toBe(
			true,
		)
	})

	it('does not duplicate default profile on fresh memory boot path', async () => {
		const store = createMemoryDiaryStore()
		const first = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		const list = await store.profiles.list()
		expect(list.filter((p) => p.name === 'Я')).toHaveLength(1)
		expect(list[0]?.id).toBe(first.id)
		expect(await store.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION)
	})
})
