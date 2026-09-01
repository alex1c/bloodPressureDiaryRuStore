import {
	BACKUP_FORMAT_ID,
	BACKUP_FORMAT_VERSION,
	validateDiaryBackup,
} from '@/domain/backup/validate-backup'
import { buildDiaryBackup } from '@/domain/backup/build-backup'
import {
	collectPlatformNotificationIds,
	restoreDiaryBackup,
} from '@/domain/backup/restore-diary-backup'
import { buildBackupFileName } from '@/domain/backup/backup-filename'
import { resolveActiveSettings } from '@/storage/backup/import-backup-dataset'
import { setMemoryImportFailureHookForTests } from '@/storage/backup/import-backup-dataset-memory'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'
import type { DiaryBackup } from '@/domain/backup/validate-backup'

async function seedDatasetA(store: ReturnType<typeof createMemoryDiaryStore>) {
	const me = await store.profiles.create({ name: 'Я', isDefault: true })
	const mom = await store.profiles.create({ name: 'Мама', isDefault: false })
	await store.settings.update({ activeProfileId: mom.id })

	await store.measurements.create({
		profileId: me.id,
		systolic: 120,
		diastolic: 80,
		pulse: 70,
		measuredAt: '2026-08-01T08:00:00.000Z',
		periodOfDay: 'morning',
		tags: ['normal'],
		note: null,
	})
	await store.measurements.create({
		profileId: mom.id,
		systolic: 140,
		diastolic: 90,
		pulse: 75,
		measuredAt: '2026-08-02T09:00:00.000Z',
		periodOfDay: 'morning',
		tags: ['stress'],
		note: 'after walk',
	})

	await store.healthMetrics.create({
		profileId: me.id,
		kind: 'weight',
		value: 86.5,
		unit: 'kg',
		measuredAt: '2026-08-03T10:00:00.000Z',
		note: null,
	})

	const med = await store.medications.create({
		profileId: mom.id,
		name: 'Лозартан',
		dosageText: '50 мг',
		schedule: [{ hour: 8, minute: 0 }],
		isActive: true,
	})
	await store.medicationIntakes.create({
		profileId: mom.id,
		medicationId: med.id,
		takenAt: '2026-08-04T08:00:00.000Z',
		scheduledHour: 8,
		scheduledMinute: 0,
		taken: true,
		note: null,
	})
	await store.reminders.create({
		profileId: mom.id,
		medicationId: med.id,
		title: 'Лекарство',
		body: 'Лозартан — 50 мг',
		hour: 8,
		minute: 0,
		weekdays: [1, 2, 3, 4, 5, 6, 7],
		enabled: true,
		platformNotificationId: 'old-platform-id-123',
	})

	await store.profileMetricSettings.setEnabledKinds(me.id, [
		'weight',
		'glucose',
	])
}

function assertSameDataset(
	before: Awaited<ReturnType<typeof buildDiaryBackup>>,
	after: Awaited<ReturnType<typeof buildDiaryBackup>>,
) {
	expect(after.profiles).toEqual(before.profiles)
	expect(after.measurements).toEqual(before.measurements)
	expect(after.healthMetrics).toEqual(before.healthMetrics)
	expect(after.medications).toEqual(before.medications)
	expect(after.medicationIntakes).toEqual(before.medicationIntakes)
	expect(after.reminders).toEqual(before.reminders)
	expect(after.settings).toEqual(before.settings)
	expect(after.profileMetricSettings).toEqual(before.profileMetricSettings)
}

async function snapshotLogical(store: ReturnType<typeof createMemoryDiaryStore>) {
	return buildDiaryBackup(store)
}

describe('Phase 8 backup restore', () => {
	it('builds backup with format metadata and strips platform ids', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const backup = await buildDiaryBackup(store)
		expect(backup.format).toBe(BACKUP_FORMAT_ID)
		expect(backup.backupVersion).toBe(BACKUP_FORMAT_VERSION)
		expect(backup.schemaVersion).toBeGreaterThan(0)
		expect(backup.reminders.every((r) => r.platformNotificationId === null)).toBe(
			true,
		)
	})

	it('round-trips export → mutate → restore → same logical data', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const snapshotA = await snapshotLogical(store)
		const backupJson = JSON.parse(JSON.stringify(await buildDiaryBackup(store)))

		await store.measurements.create({
			profileId: (await store.profiles.list())[0]!.id,
			systolic: 150,
			diastolic: 95,
			pulse: 88,
			measuredAt: '2026-09-01T12:00:00.000Z',
			periodOfDay: 'day',
			tags: [],
			note: 'mutated',
		})

		const result = await restoreDiaryBackup(store, backupJson)
		expect(result.ok).toBe(true)

		const after = await snapshotLogical(store)
		assertSameDataset(snapshotA, after)
	})

	it('rejects duplicate profile ids without mutating store', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const before = await snapshotLogical(store)
		const backup = await buildDiaryBackup(store)
		const corrupted = {
			...backup,
			profiles: [backup.profiles[0], backup.profiles[0]],
		}
		const result = await restoreDiaryBackup(store, corrupted)
		expect(result.ok).toBe(false)
		const after = await snapshotLogical(store)
		expect(after.measurements).toEqual(before.measurements)
	})

	it('rejects orphan intake medication reference', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const before = await snapshotLogical(store)
		const backup = await buildDiaryBackup(store)
		const corrupted = {
			...backup,
			medicationIntakes: [
				{
					...backup.medicationIntakes[0],
					medicationId: 'missing-med',
				},
			],
		}
		const result = await restoreDiaryBackup(store, corrupted)
		expect(result.ok).toBe(false)
		const after = await snapshotLogical(store)
		assertSameDataset(before, after)
	})

	it('rolls back on mid-restore failure', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const before = await snapshotLogical(store)
		const backup = await buildDiaryBackup(store)

		setMemoryImportFailureHookForTests({ afterStep: 3 })
		await expect(restoreDiaryBackup(store, backup)).rejects.toThrow(
			'Injected import failure',
		)
		setMemoryImportFailureHookForTests(null)

		const after = await snapshotLogical(store)
		assertSameDataset(before, after)
	})

	it('restores active profile with fallback', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const backup = await buildDiaryBackup(store)
		backup.settings.activeProfileId = 'missing-profile'
		const resolved = resolveActiveSettings(backup.settings, backup.profiles)
		expect(resolved.activeProfileId).toBe(
			backup.profiles.find((p) => p.isDefault)?.id ??
				backup.profiles[0]?.id,
		)
	})

	it('handles large dataset without error', async () => {
		const store = createMemoryDiaryStore()
		const p1 = await store.profiles.create({ name: 'A', isDefault: true })
		const p2 = await store.profiles.create({ name: 'B', isDefault: false })
		const p3 = await store.profiles.create({ name: 'C', isDefault: false })

		for (let i = 0; i < 700; i++) {
			const profileId = [p1.id, p2.id, p3.id][i % 3]!
			await store.measurements.create({
				profileId,
				systolic: 120 + (i % 20),
				diastolic: 80 + (i % 10),
				pulse: 70 + (i % 5),
				measuredAt: new Date(Date.UTC(2025, 0, 1) + i * 3600_000).toISOString(),
				periodOfDay: 'day',
				tags: [],
				note: null,
			})
		}

		for (let i = 0; i < 500; i++) {
			await store.healthMetrics.create({
				profileId: p1.id,
				kind: 'weight',
				value: 80 + i * 0.01,
				unit: 'kg',
				measuredAt: new Date(Date.UTC(2025, 0, 1) + i * 7200_000).toISOString(),
				note: null,
			})
		}

		const med = await store.medications.create({
			profileId: p1.id,
			name: 'Med',
			dosageText: '1 tab',
			schedule: [{ hour: 9, minute: 0 }],
			isActive: true,
		})
		for (let i = 0; i < 1000; i++) {
			await store.medicationIntakes.create({
				profileId: p1.id,
				medicationId: med.id,
				takenAt: new Date(Date.UTC(2025, 0, 1) + i * 1800_000).toISOString(),
				scheduledHour: 9,
				scheduledMinute: 0,
				taken: true,
				note: null,
			})
		}

		const backup = await buildDiaryBackup(store)
		expect(backup.measurements.length).toBeGreaterThanOrEqual(700)

		const storeB = createMemoryDiaryStore()
		const result = await restoreDiaryBackup(storeB, backup)
		expect(result.ok).toBe(true)
		const restored = await buildDiaryBackup(storeB)
		expect(restored.measurements.length).toBe(backup.measurements.length)
		expect(restored.medicationIntakes.length).toBe(backup.medicationIntakes.length)
	})

	it('sanitizes backup filename', () => {
		const name = buildBackupFileName(new Date(2026, 8, 1, 13, 50))
		expect(name).toBe('davlenie_backup_2026-09-01_1350.json')
		expect(name).not.toMatch(/[^a-zA-Z0-9._-]/)
	})

	it('collects platform notification ids before restore', async () => {
		const store = createMemoryDiaryStore()
		await seedDatasetA(store)
		const ids = await collectPlatformNotificationIds(store)
		expect(ids).toContain('old-platform-id-123')
	})

	it('rejects invalid JSON shapes', () => {
		expect(validateDiaryBackup(null).ok).toBe(false)
		expect(validateDiaryBackup('{').ok).toBe(false)
	})
})

function buildMinimalBackup(overrides: Partial<DiaryBackup> = {}): DiaryBackup {
	return {
		format: BACKUP_FORMAT_ID,
		backupVersion: BACKUP_FORMAT_VERSION,
		schemaVersion: 3,
		appVersion: '1.0.0',
		createdAt: '2026-09-01T00:00:00.000Z',
		profiles: [
			{
				id: 'p1',
				name: 'Я',
				isDefault: true,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			},
		],
		measurements: [],
		healthMetrics: [],
		profileMetricSettings: [],
		medications: [],
		medicationIntakes: [],
		reminders: [],
		settings: {
			activeProfileId: 'p1',
			locale: 'ru',
			hasCompletedFirstMeasurement: false,
		},
		...overrides,
	}
}

describe('Phase 8 backup validation edge cases', () => {
	it('rejects unsupported backupVersion', () => {
		const result = validateDiaryBackup({
			...buildMinimalBackup(),
			backupVersion: 99,
		})
		expect(result.ok).toBe(false)
	})

	it('rejects invalid measurement systolic/diastolic', () => {
		const result = validateDiaryBackup(
			buildMinimalBackup({
				measurements: [
					{
						id: 'm1',
						profileId: 'p1',
						systolic: 80,
						diastolic: 120,
						pulse: 70,
						measuredAt: '2026-08-26T08:00:00.000Z',
						periodOfDay: 'morning',
						wellbeing: null,
						tags: [],
						note: null,
						createdAt: '2026-08-26T08:00:00.000Z',
						updatedAt: '2026-08-26T08:00:00.000Z',
					},
				],
			}),
		)
		expect(result.ok).toBe(false)
	})

	it('rejects empty medication name', () => {
		const result = validateDiaryBackup(
			buildMinimalBackup({
				medications: [
					{
						id: 'med1',
						profileId: 'p1',
						name: '   ',
						dosageText: '50 мг',
						schedule: [{ hour: 8, minute: 0 }],
						isActive: true,
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z',
					},
				],
			}),
		)
		expect(result.ok).toBe(false)
	})
})
