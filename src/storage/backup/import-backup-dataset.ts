import {
	DEFAULT_ENABLED_METRIC_KINDS,
	normalizeEnabledKinds,
} from '@/domain/health/metric-catalog'
import type { DiaryBackup } from '@/domain/backup/validate-backup'
import type { AppSettings, Profile } from '@/domain/types'
import type { SqlExecutor } from '../sql-executor'

/**
 * Replaces the entire user dataset inside an open SQLite transaction.
 * Caller must wrap this in repos.withTransaction. Platform notification IDs
 * are always cleared on import — reconciliation reschedules after commit.
 */
export async function importBackupDatasetSqlite(
	db: SqlExecutor,
	backup: DiaryBackup,
): Promise<void> {
	// Delete in FK-safe order (children first).
	await db.run('DELETE FROM medication_intakes')
	await db.run('DELETE FROM reminders')
	await db.run('DELETE FROM medications')
	await db.run('DELETE FROM health_metrics')
	await db.run('DELETE FROM profile_metric_settings')
	await db.run('DELETE FROM measurements')
	await db.run('DELETE FROM profiles')

	for (const profile of backup.profiles) {
		await db.run(
			`INSERT INTO profiles (id, name, is_default, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				profile.id,
				profile.name,
				profile.isDefault ? 1 : 0,
				profile.createdAt,
				profile.updatedAt,
			],
		)
	}

	const settingsByProfile = new Map(
		backup.profileMetricSettings.map((row) => [row.profileId, row]),
	)
	for (const profile of backup.profiles) {
		const row =
			settingsByProfile.get(profile.id) ??
			({
				profileId: profile.id,
				enabledKinds: [...DEFAULT_ENABLED_METRIC_KINDS],
				updatedAt: profile.updatedAt,
			} as const)
		const kinds = normalizeEnabledKinds(row.enabledKinds)
		await db.run(
			`INSERT INTO profile_metric_settings
				(profile_id, enabled_kinds_json, updated_at)
			 VALUES (?, ?, ?)`,
			[profile.id, JSON.stringify(kinds), row.updatedAt],
		)
	}

	for (const med of backup.medications) {
		await db.run(
			`INSERT INTO medications (
				id, profile_id, name, dosage_text, schedule_json, is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				med.id,
				med.profileId,
				med.name,
				med.dosageText,
				JSON.stringify(med.schedule),
				med.isActive ? 1 : 0,
				med.createdAt,
				med.updatedAt,
			],
		)
	}

	for (const m of backup.measurements) {
		await db.run(
			`INSERT INTO measurements (
				id, profile_id, systolic, diastolic, pulse, measured_at,
				period_of_day, wellbeing, tags_json, note, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				m.id,
				m.profileId,
				m.systolic,
				m.diastolic,
				m.pulse,
				m.measuredAt,
				m.periodOfDay,
				m.wellbeing,
				JSON.stringify(m.tags),
				m.note,
				m.createdAt,
				m.updatedAt,
			],
		)
	}

	for (const h of backup.healthMetrics) {
		await db.run(
			`INSERT INTO health_metrics (
				id, profile_id, kind, value, unit, measured_at, note, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				h.id,
				h.profileId,
				h.kind,
				h.value,
				h.unit,
				h.measuredAt,
				h.note,
				h.createdAt,
				h.updatedAt,
			],
		)
	}

	for (const intake of backup.medicationIntakes) {
		await db.run(
			`INSERT INTO medication_intakes (
				id, profile_id, medication_id, taken_at, taken, note,
				scheduled_hour, scheduled_minute, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				intake.id,
				intake.profileId,
				intake.medicationId,
				intake.takenAt,
				intake.taken ? 1 : 0,
				intake.note,
				intake.scheduledHour,
				intake.scheduledMinute,
				intake.createdAt,
				intake.updatedAt,
			],
		)
	}

	for (const reminder of backup.reminders) {
		await db.run(
			`INSERT INTO reminders (
				id, profile_id, medication_id, title, body, hour, minute,
				weekdays_json, enabled, platform_notification_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				reminder.id,
				reminder.profileId,
				reminder.medicationId,
				reminder.title,
				reminder.body,
				reminder.hour,
				reminder.minute,
				JSON.stringify(reminder.weekdays),
				reminder.enabled ? 1 : 0,
				null,
				reminder.createdAt,
				reminder.updatedAt,
			],
		)
	}

	const nextSettings = resolveActiveSettings(backup.settings, backup.profiles)
	await db.run(
		`UPDATE settings SET
			active_profile_id = ?, locale = ?, has_completed_first_measurement = ?
		 WHERE id = 1`,
		[
			nextSettings.activeProfileId,
			nextSettings.locale,
			nextSettings.hasCompletedFirstMeasurement ? 1 : 0,
		],
	)
}

/** Picks a valid active profile id after restore. */
export function resolveActiveSettings(
	settings: AppSettings,
	profiles: Profile[],
): AppSettings {
	const profileIds = new Set(profiles.map((p) => p.id))
	let activeProfileId = settings.activeProfileId
	if (activeProfileId === null || !profileIds.has(activeProfileId)) {
		const fallback =
			profiles.find((p) => p.isDefault) ?? profiles[0] ?? null
		activeProfileId = fallback?.id ?? null
	}
	return {
		...settings,
		activeProfileId,
	}
}
