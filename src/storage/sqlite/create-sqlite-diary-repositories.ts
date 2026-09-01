import {
	applyMeasurementUpdate,
	buildMeasurement,
} from '@/domain/measurement/build-measurement'
import { createEntityId, nowIso } from '@/domain/ids'
import type {
	AppSettings,
	CreateMeasurementInput,
	HealthMetric,
	HealthMetricKind,
	Measurement,
	MeasurementTag,
	Medication,
	MedicationIntake,
	MedicationScheduleTime,
	PeriodOfDay,
	Profile,
	Reminder,
	UpdateMeasurementInput,
	ProfileMetricSettings,
	WellbeingLevel,
} from '@/domain/types'
import {
	DEFAULT_ENABLED_METRIC_KINDS,
	normalizeEnabledKinds,
} from '@/domain/health/metric-catalog'
import { applyMigrations } from '../migrate'
import { importBackupDatasetSqlite } from '../backup/import-backup-dataset'
import { CURRENT_SCHEMA_VERSION } from '../schema-version'
import type { DiaryRepositories } from '../repositories/types'
import type { SqlExecutor } from '../sql-executor'

type MeasurementRow = {
	id: string
	profile_id: string
	systolic: number
	diastolic: number
	pulse: number
	measured_at: string
	period_of_day: string
	wellbeing: string | null
	tags_json: string
	note: string | null
	created_at: string
	updated_at: string
}

/**
 * SQLite-backed diary repositories used at runtime on device.
 */
export function createSqliteDiaryRepositories(
	db: SqlExecutor,
): DiaryRepositories {
	return {
		getSchemaVersion: async () => {
			const row = await db.getFirst<{ value: string }>(
				'SELECT value FROM meta WHERE key = ?',
				['schemaVersion'],
			)
			return row ? Number(row.value) : 0
		},
		withTransaction: (fn) => db.withTransaction(fn),
		importBackupDataset: async (backup) => {
			await db.withTransaction(async () => {
				await importBackupDatasetSqlite(db, backup)
			})
		},
		profiles: {
			async list() {
				const rows = await db.getAll<{
					id: string
					name: string
					is_default: number
					created_at: string
					updated_at: string
				}>('SELECT * FROM profiles ORDER BY created_at ASC')
				return rows.map(mapProfile)
			},
			async getById(id) {
				const row = await db.getFirst<{
					id: string
					name: string
					is_default: number
					created_at: string
					updated_at: string
				}>('SELECT * FROM profiles WHERE id = ?', [id])
				return row ? mapProfile(row) : null
			},
			async update(id, patch) {
				const existing = await this.getById(id)
				if (!existing) {
					throw new Error(`Profile not found: ${id}`)
				}
				const next: Profile = {
					...existing,
					name: patch.name ?? existing.name,
					isDefault:
						patch.isDefault === undefined
							? existing.isDefault
							: patch.isDefault,
					updatedAt: nowIso(),
				}
				await db.run(
					`UPDATE profiles SET name = ?, is_default = ?, updated_at = ? WHERE id = ?`,
					[next.name, next.isDefault ? 1 : 0, next.updatedAt, id],
				)
				return next
			},
			async create(input) {
				const timestamp = nowIso()
				const profile: Profile = {
					id: createEntityId(),
					name: input.name,
					isDefault: input.isDefault ?? false,
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				await db.withTransaction(async () => {
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
					await db.run(
						`INSERT OR IGNORE INTO profile_metric_settings
							(profile_id, enabled_kinds_json, updated_at)
						 VALUES (?, ?, ?)`,
						[
							profile.id,
							JSON.stringify([...DEFAULT_ENABLED_METRIC_KINDS]),
							timestamp,
						],
					)
					const settings = await getSettings(db)
					if (settings.activeProfileId === null) {
						await db.run(
							`UPDATE settings SET active_profile_id = ? WHERE id = 1`,
							[profile.id],
						)
					}
				})
				return profile
			},
			async delete(id) {
				const all = await this.list()
				const remaining = all.filter((p) => p.id !== id)
				if (remaining.length === 0) {
					throw new Error('Cannot delete the last profile')
				}
				const fallback =
					remaining.find((p) => p.isDefault) ?? remaining[0]!
				await db.withTransaction(async () => {
					await db.run(
						'DELETE FROM medication_intakes WHERE profile_id = ?',
						[id],
					)
					await db.run('DELETE FROM reminders WHERE profile_id = ?', [id])
					await db.run('DELETE FROM medications WHERE profile_id = ?', [id])
					await db.run(
						'DELETE FROM health_metrics WHERE profile_id = ?',
						[id],
					)
					await db.run(
						'DELETE FROM profile_metric_settings WHERE profile_id = ?',
						[id],
					)
					await db.run(
						'DELETE FROM measurements WHERE profile_id = ?',
						[id],
					)
					await db.run('DELETE FROM profiles WHERE id = ?', [id])
					const settings = await getSettings(db)
					if (settings.activeProfileId === id) {
						await db.run(
							`UPDATE settings SET active_profile_id = ? WHERE id = 1`,
							[fallback.id],
						)
					}
				})
			},
		},
		measurements: {
			async listByProfile(profileId) {
				const rows = await db.getAll<MeasurementRow>(
					`SELECT * FROM measurements
					 WHERE profile_id = ?
					 ORDER BY measured_at DESC`,
					[profileId],
				)
				return rows.map(mapMeasurement)
			},
			async listByProfileOnDay(profileId, dayIsoDate) {
				const rows = await db.getAll<MeasurementRow>(
					`SELECT * FROM measurements
					 WHERE profile_id = ?
					   AND substr(measured_at, 1, 10) = ?
					 ORDER BY measured_at DESC`,
					[profileId, dayIsoDate],
				)
				return rows.map(mapMeasurement)
			},
			async listByProfileInRange(profileId, fromIso, toIso) {
				const rows = await db.getAll<MeasurementRow>(
					`SELECT * FROM measurements
					 WHERE profile_id = ?
					   AND measured_at >= ?
					   AND measured_at <= ?
					 ORDER BY measured_at DESC`,
					[profileId, fromIso, toIso],
				)
				return rows.map(mapMeasurement)
			},
			async getById(id) {
				const row = await db.getFirst<MeasurementRow>(
					'SELECT * FROM measurements WHERE id = ?',
					[id],
				)
				return row ? mapMeasurement(row) : null
			},
			async create(input: CreateMeasurementInput) {
				const measurement = buildMeasurement(input)
				await db.run(
					`INSERT INTO measurements (
						id, profile_id, systolic, diastolic, pulse, measured_at,
						period_of_day, wellbeing, tags_json, note, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						measurement.id,
						measurement.profileId,
						measurement.systolic,
						measurement.diastolic,
						measurement.pulse,
						measurement.measuredAt,
						measurement.periodOfDay,
						measurement.wellbeing,
						JSON.stringify(measurement.tags),
						measurement.note,
						measurement.createdAt,
						measurement.updatedAt,
					],
				)
				await db.run(
					`UPDATE settings SET has_completed_first_measurement = 1 WHERE id = 1`,
				)
				return measurement
			},
			async update(id, patch: UpdateMeasurementInput) {
				const existing = await this.getById(id)
				if (!existing) {
					throw new Error(`Measurement not found: ${id}`)
				}
				const next = applyMeasurementUpdate(existing, patch)
				await db.run(
					`UPDATE measurements SET
						systolic = ?, diastolic = ?, pulse = ?, measured_at = ?,
						period_of_day = ?, wellbeing = ?, tags_json = ?, note = ?,
						updated_at = ?
					 WHERE id = ?`,
					[
						next.systolic,
						next.diastolic,
						next.pulse,
						next.measuredAt,
						next.periodOfDay,
						next.wellbeing,
						JSON.stringify(next.tags),
						next.note,
						next.updatedAt,
						id,
					],
				)
				return next
			},
			async delete(id) {
				await db.run('DELETE FROM measurements WHERE id = ?', [id])
			},
		},
		healthMetrics: {
			async listByProfile(profileId) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					kind: string
					value: number
					unit: string | null
					measured_at: string
					note: string | null
					created_at: string
					updated_at: string
				}>(
					`SELECT * FROM health_metrics
					 WHERE profile_id = ?
					 ORDER BY measured_at DESC`,
					[profileId],
				)
				return rows.map(mapHealthMetric)
			},
			async listByProfileAndKind(profileId, kind) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					kind: string
					value: number
					unit: string | null
					measured_at: string
					note: string | null
					created_at: string
					updated_at: string
				}>(
					`SELECT * FROM health_metrics
					 WHERE profile_id = ? AND kind = ?
					 ORDER BY measured_at DESC`,
					[profileId, kind],
				)
				return rows.map(mapHealthMetric)
			},
			async getById(id) {
				const row = await db.getFirst<{
					id: string
					profile_id: string
					kind: string
					value: number
					unit: string | null
					measured_at: string
					note: string | null
					created_at: string
					updated_at: string
				}>('SELECT * FROM health_metrics WHERE id = ?', [id])
				return row ? mapHealthMetric(row) : null
			},
			async create(input) {
				const timestamp = nowIso()
				const row: HealthMetric = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				await db.run(
					`INSERT INTO health_metrics (
						id, profile_id, kind, value, unit, measured_at, note, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.id,
						row.profileId,
						row.kind,
						row.value,
						row.unit,
						row.measuredAt,
						row.note,
						row.createdAt,
						row.updatedAt,
					],
				)
				return row
			},
			async update(id, patch) {
				const existing = await this.getById(id)
				if (!existing) {
					throw new Error(`Health metric not found: ${id}`)
				}
				const next: HealthMetric = {
					...existing,
					value: patch.value ?? existing.value,
					unit: patch.unit === undefined ? existing.unit : patch.unit,
					measuredAt: patch.measuredAt ?? existing.measuredAt,
					note: patch.note === undefined ? existing.note : patch.note,
					kind: patch.kind ?? existing.kind,
					updatedAt: nowIso(),
				}
				await db.run(
					`UPDATE health_metrics SET
						kind = ?, value = ?, unit = ?, measured_at = ?, note = ?, updated_at = ?
					 WHERE id = ?`,
					[
						next.kind,
						next.value,
						next.unit,
						next.measuredAt,
						next.note,
						next.updatedAt,
						id,
					],
				)
				return next
			},
			async delete(id) {
				await db.run('DELETE FROM health_metrics WHERE id = ?', [id])
			},
		},
		profileMetricSettings: {
			async get(profileId) {
				const row = await db.getFirst<{
					profile_id: string
					enabled_kinds_json: string
					updated_at: string
				}>(
					'SELECT * FROM profile_metric_settings WHERE profile_id = ?',
					[profileId],
				)
				if (!row) {
					const timestamp = nowIso()
					const settings: ProfileMetricSettings = {
						profileId,
						enabledKinds: [...DEFAULT_ENABLED_METRIC_KINDS],
						updatedAt: timestamp,
					}
					await db.run(
						`INSERT INTO profile_metric_settings
							(profile_id, enabled_kinds_json, updated_at)
						 VALUES (?, ?, ?)`,
						[
							profileId,
							JSON.stringify(settings.enabledKinds),
							timestamp,
						],
					)
					return settings
				}
				return mapProfileMetricSettings(row)
			},
			async setEnabledKinds(profileId, enabledKinds) {
				const timestamp = nowIso()
				const kinds = normalizeEnabledKinds(enabledKinds)
				const settings: ProfileMetricSettings = {
					profileId,
					enabledKinds: kinds,
					updatedAt: timestamp,
				}
				await db.run(
					`INSERT INTO profile_metric_settings
						(profile_id, enabled_kinds_json, updated_at)
					 VALUES (?, ?, ?)
					 ON CONFLICT(profile_id) DO UPDATE SET
						enabled_kinds_json = excluded.enabled_kinds_json,
						updated_at = excluded.updated_at`,
					[profileId, JSON.stringify(kinds), timestamp],
				)
				return settings
			},
		},
		medications: {
			async listByProfile(profileId) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					name: string
					dosage_text: string
					schedule_json: string
					is_active: number
					created_at: string
					updated_at: string
				}>('SELECT * FROM medications WHERE profile_id = ?', [profileId])
				return rows.map(mapMedication)
			},
			async create(input) {
				const timestamp = nowIso()
				const row: Medication = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				await db.run(
					`INSERT INTO medications (
						id, profile_id, name, dosage_text, schedule_json, is_active, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.id,
						row.profileId,
						row.name,
						row.dosageText,
						JSON.stringify(row.schedule),
						row.isActive ? 1 : 0,
						row.createdAt,
						row.updatedAt,
					],
				)
				return row
			},
			async update(id, patch) {
				const list = await db.getAll<{
					id: string
					profile_id: string
					name: string
					dosage_text: string
					schedule_json: string
					is_active: number
					created_at: string
					updated_at: string
				}>('SELECT * FROM medications WHERE id = ?', [id])
				const existingRow = list[0]
				if (!existingRow) {
					throw new Error(`Medication not found: ${id}`)
				}
				const existing = mapMedication(existingRow)
				const next: Medication = {
					...existing,
					...patch,
					id: existing.id,
					profileId: existing.profileId,
					createdAt: existing.createdAt,
					updatedAt: nowIso(),
				}
				await db.run(
					`UPDATE medications SET
						name = ?, dosage_text = ?, schedule_json = ?, is_active = ?, updated_at = ?
					 WHERE id = ?`,
					[
						next.name,
						next.dosageText,
						JSON.stringify(next.schedule),
						next.isActive ? 1 : 0,
						next.updatedAt,
						id,
					],
				)
				return next
			},
			async delete(id) {
				await db.withTransaction(async () => {
					await db.run(
						'DELETE FROM medication_intakes WHERE medication_id = ?',
						[id],
					)
					await db.run(
						'DELETE FROM reminders WHERE medication_id = ?',
						[id],
					)
					await db.run('DELETE FROM medications WHERE id = ?', [id])
				})
			},
		},
		medicationIntakes: {
			async listByProfile(profileId) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					medication_id: string
					taken_at: string
					taken: number
					note: string | null
					scheduled_hour: number
					scheduled_minute: number
					created_at: string
					updated_at: string
				}>(
					`SELECT * FROM medication_intakes
					 WHERE profile_id = ?
					 ORDER BY taken_at DESC`,
					[profileId],
				)
				return rows.map(mapIntake)
			},
			async listByMedication(medicationId) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					medication_id: string
					taken_at: string
					taken: number
					note: string | null
					scheduled_hour: number
					scheduled_minute: number
					created_at: string
					updated_at: string
				}>(
					`SELECT * FROM medication_intakes
					 WHERE medication_id = ?
					 ORDER BY taken_at DESC`,
					[medicationId],
				)
				return rows.map(mapIntake)
			},
			async create(input) {
				const medication = await db.getFirst<{ profile_id: string }>(
					'SELECT profile_id FROM medications WHERE id = ?',
					[input.medicationId],
				)
				if (!medication) throw new Error(`Medication not found: ${input.medicationId}`)
				if (medication.profile_id !== input.profileId) throw new Error('Medication intake profile mismatch')
				const timestamp = nowIso()
				const row: MedicationIntake = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				await db.run(
					`INSERT INTO medication_intakes (
						id, profile_id, medication_id, taken_at, taken, note,
						scheduled_hour, scheduled_minute, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.id,
						row.profileId,
						row.medicationId,
						row.takenAt,
						row.taken ? 1 : 0,
						row.note,
						row.scheduledHour,
						row.scheduledMinute,
						row.createdAt,
						row.updatedAt,
					],
				)
				return row
			},
			async delete(id) {
				await db.run('DELETE FROM medication_intakes WHERE id = ?', [id])
			},
		},
		reminders: {
			async listByProfile(profileId) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					medication_id: string | null
					title: string
					body: string | null
					hour: number
					minute: number
					weekdays_json: string
					enabled: number
					platform_notification_id: string | null
					created_at: string
					updated_at: string
				}>('SELECT * FROM reminders WHERE profile_id = ?', [profileId])
				return rows.map(mapReminder)
			},
			async create(input) {
				if (input.medicationId !== null) {
					const medication = await db.getFirst<{ profile_id: string }>(
						'SELECT profile_id FROM medications WHERE id = ?',
						[input.medicationId],
					)
					if (!medication) throw new Error(`Medication not found: ${input.medicationId}`)
					if (medication.profile_id !== input.profileId) throw new Error('Reminder profile mismatch')
				}
				const timestamp = nowIso()
				const row: Reminder = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				await db.run(
					`INSERT INTO reminders (
						id, profile_id, medication_id, title, body, hour, minute,
						weekdays_json, enabled, platform_notification_id, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.id,
						row.profileId,
						row.medicationId,
						row.title,
						row.body,
						row.hour,
						row.minute,
						JSON.stringify(row.weekdays),
						row.enabled ? 1 : 0,
						row.platformNotificationId,
						row.createdAt,
						row.updatedAt,
					],
				)
				return row
			},
			async update(id, patch) {
				const rows = await db.getAll<{
					id: string
					profile_id: string
					medication_id: string | null
					title: string
					body: string | null
					hour: number
					minute: number
					weekdays_json: string
					enabled: number
					platform_notification_id: string | null
					created_at: string
					updated_at: string
				}>('SELECT * FROM reminders WHERE id = ?', [id])
				const existingRow = rows[0]
				if (!existingRow) {
					throw new Error(`Reminder not found: ${id}`)
				}
				const existing = mapReminder(existingRow)
				const next: Reminder = {
					...existing,
					...patch,
					id: existing.id,
					profileId: existing.profileId,
					createdAt: existing.createdAt,
					updatedAt: nowIso(),
				}
				await db.run(
					`UPDATE reminders SET
						medication_id = ?, title = ?, body = ?, hour = ?, minute = ?,
						weekdays_json = ?, enabled = ?, platform_notification_id = ?, updated_at = ?
					 WHERE id = ?`,
					[
						next.medicationId,
						next.title,
						next.body,
						next.hour,
						next.minute,
						JSON.stringify(next.weekdays),
						next.enabled ? 1 : 0,
						next.platformNotificationId,
						next.updatedAt,
						id,
					],
				)
				return next
			},
			async delete(id) {
				await db.run('DELETE FROM reminders WHERE id = ?', [id])
			},
		},
		settings: {
			async get() {
				return getSettings(db)
			},
			async update(patch) {
				const current = await getSettings(db)
				const next: AppSettings = { ...current, ...patch }
				await db.run(
					`UPDATE settings SET
						active_profile_id = ?, locale = ?, has_completed_first_measurement = ?
					 WHERE id = 1`,
					[
						next.activeProfileId,
						next.locale,
						next.hasCompletedFirstMeasurement ? 1 : 0,
					],
				)
				return next
			},
		},
	}
}

async function getSettings(db: SqlExecutor): Promise<AppSettings> {
	const row = await db.getFirst<{
		active_profile_id: string | null
		locale: string
		has_completed_first_measurement: number
	}>('SELECT * FROM settings WHERE id = 1')

	if (!row) {
		return {
			activeProfileId: null,
			locale: 'ru',
			hasCompletedFirstMeasurement: false,
		}
	}

	return {
		activeProfileId: row.active_profile_id,
		locale: row.locale === 'en' ? 'en' : 'ru',
		hasCompletedFirstMeasurement: row.has_completed_first_measurement === 1,
	}
}

function mapProfile(row: {
	id: string
	name: string
	is_default: number
	created_at: string
	updated_at: string
}): Profile {
	return {
		id: row.id,
		name: row.name,
		isDefault: row.is_default === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapMeasurement(row: MeasurementRow): Measurement {
	return {
		id: row.id,
		profileId: row.profile_id,
		systolic: row.systolic,
		diastolic: row.diastolic,
		pulse: row.pulse,
		measuredAt: row.measured_at,
		periodOfDay: row.period_of_day as PeriodOfDay,
		wellbeing: row.wellbeing as WellbeingLevel,
		tags: JSON.parse(row.tags_json) as MeasurementTag[],
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapHealthMetric(row: {
	id: string
	profile_id: string
	kind: string
	value: number
	unit: string | null
	measured_at: string
	note: string | null
	created_at: string
	updated_at: string
}): HealthMetric {
	return {
		id: row.id,
		profileId: row.profile_id,
		kind: row.kind as HealthMetricKind,
		value: row.value,
		unit: row.unit,
		measuredAt: row.measured_at,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapProfileMetricSettings(row: {
	profile_id: string
	enabled_kinds_json: string
	updated_at: string
}): ProfileMetricSettings {
	const parsed = JSON.parse(row.enabled_kinds_json) as HealthMetricKind[]
	return {
		profileId: row.profile_id,
		enabledKinds: normalizeEnabledKinds(parsed),
		updatedAt: row.updated_at,
	}
}

function mapMedication(row: {
	id: string
	profile_id: string
	name: string
	dosage_text: string
	schedule_json: string
	is_active: number
	created_at: string
	updated_at: string
}): Medication {
	return {
		id: row.id,
		profileId: row.profile_id,
		name: row.name,
		dosageText: row.dosage_text,
		schedule: JSON.parse(row.schedule_json) as MedicationScheduleTime[],
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapIntake(row: {
	id: string
	profile_id: string
	medication_id: string
	taken_at: string
	taken: number
	note: string | null
	scheduled_hour?: number | null
	scheduled_minute?: number | null
	created_at: string
	updated_at: string
}): MedicationIntake {
	return {
		id: row.id,
		profileId: row.profile_id,
		medicationId: row.medication_id,
		takenAt: row.taken_at,
		scheduledHour: row.scheduled_hour ?? 0,
		scheduledMinute: row.scheduled_minute ?? 0,
		taken: row.taken === 1,
		note: row.note,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

function mapReminder(row: {
	id: string
	profile_id: string
	medication_id: string | null
	title: string
	body: string | null
	hour: number
	minute: number
	weekdays_json: string
	enabled: number
	platform_notification_id: string | null
	created_at: string
	updated_at: string
}): Reminder {
	return {
		id: row.id,
		profileId: row.profile_id,
		medicationId: row.medication_id,
		title: row.title,
		body: row.body,
		hour: row.hour,
		minute: row.minute,
		weekdays: JSON.parse(row.weekdays_json) as number[],
		enabled: row.enabled === 1,
		platformNotificationId: row.platform_notification_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

/**
 * Ensures settings singleton row exists after migrations.
 */
export async function ensureDefaultSettings(db: SqlExecutor): Promise<void> {
	const row = await db.getFirst<{ id: number }>(
		'SELECT id FROM settings WHERE id = 1',
	)
	if (!row) {
		await db.run(
			`INSERT INTO settings (id, active_profile_id, locale, has_completed_first_measurement)
			 VALUES (1, NULL, 'ru', 0)`,
		)
	}
}

/**
 * Opens migrations + default settings. Caller supplies an already-opened executor.
 */
export async function bootstrapSqliteSchema(db: SqlExecutor): Promise<number> {
	const version = await applyMigrations(db)
	await ensureDefaultSettings(db)
	if (version !== CURRENT_SCHEMA_VERSION) {
		throw new Error(`Unexpected schema version ${version}`)
	}
	return version
}
