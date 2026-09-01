import type { DiaryBackup } from '@/domain/backup/validate-backup'
import { validateDiaryBackup } from '@/domain/backup/validate-backup'
import type { DiaryRepositories } from '@/storage/repositories/types'

export type RestoreDiaryBackupResult =
	| { ok: true }
	| { ok: false; message: string }

/**
 * Atomically replaces the local dataset with a validated backup snapshot.
 * Validation must pass before any DB mutation. Throws on storage errors
 * after rollback (SQLite) or snapshot restore (memory store).
 */
export async function restoreDiaryBackup(
	repos: DiaryRepositories,
	raw: unknown,
): Promise<RestoreDiaryBackupResult> {
	const validation = validateDiaryBackup(raw)
	if (!validation.ok) {
		return { ok: false, message: mapValidationMessage(validation.message) }
	}

	await repos.importBackupDataset(validation.backup)
	return { ok: true }
}

/** Collects platform notification ids before restore for post-commit cleanup. */
export async function collectPlatformNotificationIds(
	repos: DiaryRepositories,
): Promise<string[]> {
	const profiles = await repos.profiles.list()
	const reminders = (
		await Promise.all(profiles.map((p) => repos.reminders.listByProfile(p.id)))
	).flat()
	const ids: string[] = []
	for (const reminder of reminders) {
		if (reminder.platformNotificationId) {
			ids.push(reminder.platformNotificationId)
		}
	}
	return ids
}

export function mapValidationMessage(technical: string): string {
	if (technical.includes('Unsupported backupVersion')) {
		return 'Эта резервная копия создана более новой версией приложения.'
	}
	if (technical.includes('Unsupported backup format')) {
		return 'Выбранный файл не является резервной копией приложения.'
	}
	return 'Не удалось прочитать резервную копию. Проверьте файл и попробуйте снова.'
}

export type BackupPreviewSummary = {
	createdAt: string
	appVersion: string
	profileCount: number
	measurementCount: number
	medicationCount: number
	intakeCount: number
	healthMetricCount: number
}

/** Human-readable counts for the restore confirmation screen. */
export function buildBackupPreviewSummary(
	backup: DiaryBackup,
): BackupPreviewSummary {
	return {
		createdAt: backup.createdAt,
		appVersion: backup.appVersion,
		profileCount: backup.profiles.length,
		measurementCount: backup.measurements.length,
		medicationCount: backup.medications.length,
		intakeCount: backup.medicationIntakes.length,
		healthMetricCount: backup.healthMetrics.length,
	}
}
