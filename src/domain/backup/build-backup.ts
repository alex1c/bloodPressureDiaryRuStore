import {
	BACKUP_FORMAT_ID,
	BACKUP_FORMAT_VERSION,
	type DiaryBackup,
	validateDiaryBackup,
} from '@/domain/backup/validate-backup'
import { appConfig } from '@/config/app-config'
import { nowIso } from '@/domain/ids'
import type { DiaryRepositories } from '@/storage/repositories/types'

/**
 * Builds a versioned backup document from the local store.
 * Strips platform notification ids — they are device-specific.
 */
export async function buildDiaryBackup(
	repos: DiaryRepositories,
): Promise<DiaryBackup> {
	const profiles = await repos.profiles.list()
	const settings = await repos.settings.get()

	const measurements = (
		await Promise.all(
			profiles.map((p) => repos.measurements.listByProfile(p.id)),
		)
	).flat()

	const healthMetrics = (
		await Promise.all(
			profiles.map((p) => repos.healthMetrics.listByProfile(p.id)),
		)
	).flat()

	const profileMetricSettings = await Promise.all(
		profiles.map((p) => repos.profileMetricSettings.get(p.id)),
	)

	const medications = (
		await Promise.all(
			profiles.map((p) => repos.medications.listByProfile(p.id)),
		)
	).flat()

	const medicationIntakes = (
		await Promise.all(
			profiles.map((p) => repos.medicationIntakes.listByProfile(p.id)),
		)
	).flat()

	const reminders = (
		await Promise.all(
			profiles.map((p) => repos.reminders.listByProfile(p.id)),
		)
	).flat().map((reminder) => ({
		...reminder,
		platformNotificationId: null,
	}))

	const backup: DiaryBackup = {
		format: BACKUP_FORMAT_ID,
		backupVersion: BACKUP_FORMAT_VERSION,
		schemaVersion: await repos.getSchemaVersion(),
		appVersion: appConfig.versionName,
		createdAt: nowIso(),
		profiles,
		measurements,
		healthMetrics,
		profileMetricSettings,
		medications,
		medicationIntakes,
		reminders,
		settings,
	}

	const validation = validateDiaryBackup(backup)
	if (!validation.ok) {
		throw new Error(`Backup validation failed: ${validation.message}`)
	}

	return backup
}
