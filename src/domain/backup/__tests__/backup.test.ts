import { derivePeriodOfDay } from '@/domain/catalog'
import {
	BACKUP_FORMAT_ID,
	BACKUP_FORMAT_VERSION,
	validateDiaryBackup,
} from '@/domain/backup/validate-backup'
import { buildDiaryBackup } from '@/domain/backup/build-backup'
import { createMemoryDiaryStore } from '@/storage/memory/create-memory-diary-store'

describe('derivePeriodOfDay', () => {
	it('maps morning day evening night boundaries', () => {
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 8, 0))).toBe('morning')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 14, 0))).toBe('day')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 20, 0))).toBe('evening')
		expect(derivePeriodOfDay(new Date(2026, 7, 26, 23, 30))).toBe('night')
	})
})

describe('backup validation contract', () => {
	it('accepts a valid backup built from the store', async () => {
		const store = createMemoryDiaryStore()
		const profile = await store.profiles.create({
			name: 'Я',
			isDefault: true,
		})
		await store.measurements.create({
			profileId: profile.id,
			systolic: 120,
			diastolic: 80,
			pulse: 70,
			measuredAt: '2026-08-26T08:00:00.000Z',
			periodOfDay: 'morning',
			tags: ['normal'],
			note: null,
		})

		const backup = await buildDiaryBackup(store)
		const result = validateDiaryBackup(backup)
		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.backup.format).toBe(BACKUP_FORMAT_ID)
			expect(result.backup.backupVersion).toBe(BACKUP_FORMAT_VERSION)
			expect(result.backup.measurements).toHaveLength(1)
		}
	})

	it('rejects unsupported backupVersion before any restore', () => {
		const result = validateDiaryBackup({
			backupVersion: 999,
			appVersion: '1.0.0',
			createdAt: '2026-08-26T00:00:00.000Z',
			profiles: [],
			measurements: [],
			healthMetrics: [],
			medications: [],
			medicationIntakes: [],
			reminders: [],
			settings: {
				activeProfileId: null,
				locale: 'ru',
				hasCompletedFirstMeasurement: false,
			},
		})
		expect(result).toEqual({
			ok: false,
			code: 'UNSUPPORTED_VERSION',
			message: 'Unsupported backupVersion 999',
		})
	})

	it('rejects orphan measurement profile references', () => {
		const result = validateDiaryBackup({
			backupVersion: 1,
			appVersion: '1.0.0',
			createdAt: '2026-08-26T00:00:00.000Z',
			profiles: [
				{
					id: 'p1',
					name: 'Я',
					isDefault: true,
					createdAt: '2026-08-26T00:00:00.000Z',
					updatedAt: '2026-08-26T00:00:00.000Z',
				},
			],
			measurements: [
				{
					id: 'm1',
					profileId: 'missing',
					systolic: 120,
					diastolic: 80,
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
			healthMetrics: [],
			medications: [],
			medicationIntakes: [],
			reminders: [],
			settings: {
				activeProfileId: 'p1',
				locale: 'ru',
				hasCompletedFirstMeasurement: false,
			},
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.code).toBe('PROFILE_ISOLATION')
		}
	})

	it('rejects non-object root', () => {
		expect(validateDiaryBackup(null).ok).toBe(false)
		expect(validateDiaryBackup('x').ok).toBe(false)
	})
})
