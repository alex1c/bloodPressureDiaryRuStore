import { isMeasurementTag, isPeriodOfDay } from '../catalog'
import type {
	AppSettings,
	HealthMetric,
	HealthMetricKind,
	Measurement,
	Medication,
	MedicationIntake,
	Profile,
	ProfileMetricSettings,
	Reminder,
} from '../types'
import { normalizeEnabledKinds } from '../health/metric-catalog'

/** Stable identifier for backup JSON documents. */
export const BACKUP_FORMAT_ID = 'bpdiary-backup'

/** Current backup document format version. */
export const BACKUP_FORMAT_VERSION = 1

export interface DiaryBackup {
	format: typeof BACKUP_FORMAT_ID
	backupVersion: number
	/** SQLite schema at export time — metadata only, not applied on restore. */
	schemaVersion: number
	appVersion: string
	createdAt: string
	profiles: Profile[]
	measurements: Measurement[]
	healthMetrics: HealthMetric[]
	/** Per-profile enabled metric kinds (Phase 6). Optional in older payloads. */
	profileMetricSettings: ProfileMetricSettings[]
	medications: Medication[]
	medicationIntakes: MedicationIntake[]
	reminders: Reminder[]
	settings: AppSettings
}

export type BackupValidationErrorCode =
	| 'NOT_OBJECT'
	| 'UNSUPPORTED_VERSION'
	| 'UNSUPPORTED_FORMAT'
	| 'MISSING_FIELD'
	| 'INVALID_FIELD'
	| 'DUPLICATE_ID'
	| 'PROFILE_ISOLATION'
	| 'ORPHAN_REFERENCE'

export type BackupValidationResult =
	| { ok: true; backup: DiaryBackup }
	| { ok: false; code: BackupValidationErrorCode; message: string }

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
	return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function isIsoTimestamp(value: unknown): value is string {
	return isString(value) && Number.isFinite(Date.parse(value))
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean'
}

const HEALTH_KINDS: HealthMetricKind[] = [
	'weight',
	'glucose',
	'spo2',
	'temperature',
]

/**
 * Validates a parsed backup document without mutating storage.
 * Callers must refuse restore when ok === false.
 */
export function validateDiaryBackup(raw: unknown): BackupValidationResult {
	if (!isObject(raw)) {
		return { ok: false, code: 'NOT_OBJECT', message: 'Backup root must be an object' }
	}

	if (!isNumber(raw.backupVersion)) {
		return {
			ok: false,
			code: 'MISSING_FIELD',
			message: 'backupVersion is required',
		}
	}

	if (raw.backupVersion !== BACKUP_FORMAT_VERSION) {
		return {
			ok: false,
			code: 'UNSUPPORTED_VERSION',
			message: `Unsupported backupVersion ${String(raw.backupVersion)}`,
		}
	}

	if (raw.format !== undefined && raw.format !== BACKUP_FORMAT_ID) {
		return {
			ok: false,
			code: 'UNSUPPORTED_FORMAT',
			message: `Unsupported backup format ${String(raw.format)}`,
		}
	}

	if (raw.schemaVersion !== undefined && !isNumber(raw.schemaVersion)) {
		return {
			ok: false,
			code: 'INVALID_FIELD',
			message: 'schemaVersion must be a number when present',
		}
	}

	if (!isString(raw.appVersion) || !isString(raw.createdAt)) {
		return {
			ok: false,
			code: 'MISSING_FIELD',
			message: 'appVersion and createdAt are required strings',
		}
	}

	if (
		!Array.isArray(raw.profiles) ||
		!Array.isArray(raw.measurements) ||
		!Array.isArray(raw.healthMetrics) ||
		!Array.isArray(raw.medications) ||
		!Array.isArray(raw.medicationIntakes) ||
		!Array.isArray(raw.reminders) ||
		!isObject(raw.settings)
	) {
		return {
			ok: false,
			code: 'MISSING_FIELD',
			message: 'Backup collections or settings missing',
		}
	}

	const profiles: Profile[] = []
	const profileIdSet = new Set<string>()
	for (const item of raw.profiles) {
		const profile = parseProfile(item)
		if (!profile) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid profile entry',
			}
		}
		if (profileIdSet.has(profile.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate profile id ${profile.id}`,
			}
		}
		profileIdSet.add(profile.id)
		profiles.push(profile)
	}

	if (profiles.length === 0) {
		return {
			ok: false,
			code: 'INVALID_FIELD',
			message: 'Backup must contain at least one profile',
		}
	}

	const profileIds = profileIdSet

	const measurements: Measurement[] = []
	const measurementIds = new Set<string>()
	for (const item of raw.measurements) {
		const m = parseMeasurement(item)
		if (!m) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid measurement entry',
			}
		}
		if (measurementIds.has(m.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate measurement id ${m.id}`,
			}
		}
		measurementIds.add(m.id)
		if (!profileIds.has(m.profileId)) {
			return {
				ok: false,
				code: 'PROFILE_ISOLATION',
				message: `Measurement ${m.id} references unknown profile`,
			}
		}
		measurements.push(m)
	}

	const healthMetrics: HealthMetric[] = []
	const healthMetricIds = new Set<string>()
	for (const item of raw.healthMetrics) {
		const h = parseHealthMetric(item)
		if (!h) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid healthMetric entry',
			}
		}
		if (healthMetricIds.has(h.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate healthMetric id ${h.id}`,
			}
		}
		healthMetricIds.add(h.id)
		if (!profileIds.has(h.profileId)) {
			return {
				ok: false,
				code: 'PROFILE_ISOLATION',
				message: `HealthMetric ${h.id} references unknown profile`,
			}
		}
		healthMetrics.push(h)
	}

	const medications: Medication[] = []
	const medicationIds = new Set<string>()
	for (const item of raw.medications) {
		const med = parseMedication(item)
		if (!med) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid medication entry',
			}
		}
		if (medicationIds.has(med.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate medication id ${med.id}`,
			}
		}
		medicationIds.add(med.id)
		if (!profileIds.has(med.profileId)) {
			return {
				ok: false,
				code: 'PROFILE_ISOLATION',
				message: `Medication ${med.id} references unknown profile`,
			}
		}
		medications.push(med)
	}

	const medicationIdSet = medicationIds

	const medicationIntakes: MedicationIntake[] = []
	const intakeIds = new Set<string>()
	for (const item of raw.medicationIntakes) {
		const intake = parseIntake(item)
		if (!intake) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid medicationIntake entry',
			}
		}
		if (intakeIds.has(intake.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate medicationIntake id ${intake.id}`,
			}
		}
		intakeIds.add(intake.id)
		if (!profileIds.has(intake.profileId)) {
			return {
				ok: false,
				code: 'PROFILE_ISOLATION',
				message: `Intake ${intake.id} references unknown profile`,
			}
		}
		if (!medicationIdSet.has(intake.medicationId)) {
			return {
				ok: false,
				code: 'ORPHAN_REFERENCE',
				message: `Intake ${intake.id} references unknown medication`,
			}
		}
		const intakeMedication = medications.find((m) => m.id === intake.medicationId)
		if (!intakeMedication || intakeMedication.profileId !== intake.profileId) {
			return { ok: false, code: 'PROFILE_ISOLATION', message: `Intake ${intake.id} crosses profile boundary` }
		}
		medicationIntakes.push(intake)
	}

	const reminders: Reminder[] = []
	const reminderIds = new Set<string>()
	for (const item of raw.reminders) {
		const reminder = parseReminder(item)
		if (!reminder) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'Invalid reminder entry',
			}
		}
		if (reminderIds.has(reminder.id)) {
			return {
				ok: false,
				code: 'DUPLICATE_ID',
				message: `Duplicate reminder id ${reminder.id}`,
			}
		}
		reminderIds.add(reminder.id)
		if (!profileIds.has(reminder.profileId)) {
			return {
				ok: false,
				code: 'PROFILE_ISOLATION',
				message: `Reminder ${reminder.id} references unknown profile`,
			}
		}
		if (
			reminder.medicationId !== null &&
			!medicationIdSet.has(reminder.medicationId)
		) {
			return {
				ok: false,
				code: 'ORPHAN_REFERENCE',
				message: `Reminder ${reminder.id} references unknown medication`,
			}
		}
		if (reminder.medicationId !== null) {
			const reminderMedication = medications.find((m) => m.id === reminder.medicationId)
			if (!reminderMedication || reminderMedication.profileId !== reminder.profileId) {
				return { ok: false, code: 'PROFILE_ISOLATION', message: `Reminder ${reminder.id} crosses profile boundary` }
			}
		}
		reminders.push(reminder)
	}

	// Older Phase 5 backups omit profileMetricSettings — treat as empty.
	const profileMetricSettings: ProfileMetricSettings[] = []
	if (raw.profileMetricSettings !== undefined) {
		if (!Array.isArray(raw.profileMetricSettings)) {
			return {
				ok: false,
				code: 'INVALID_FIELD',
				message: 'profileMetricSettings must be an array when present',
			}
		}
		const metricSettingsProfileIds = new Set<string>()
		for (const item of raw.profileMetricSettings) {
			const row = parseProfileMetricSettings(item)
			if (!row) {
				return {
					ok: false,
					code: 'INVALID_FIELD',
					message: 'Invalid profileMetricSettings entry',
				}
			}
			if (metricSettingsProfileIds.has(row.profileId)) {
				return {
					ok: false,
					code: 'DUPLICATE_ID',
					message: `Duplicate profileMetricSettings for profile ${row.profileId}`,
				}
			}
			metricSettingsProfileIds.add(row.profileId)
			if (!profileIds.has(row.profileId)) {
				return {
					ok: false,
					code: 'PROFILE_ISOLATION',
					message: `Metric settings reference unknown profile ${row.profileId}`,
				}
			}
			profileMetricSettings.push(row)
		}
	}

	const settings = parseSettings(raw.settings, profileIds)
	if (!settings) {
		return {
			ok: false,
			code: 'INVALID_FIELD',
			message: 'Invalid settings',
		}
	}

	return {
		ok: true,
		backup: {
			format: BACKUP_FORMAT_ID,
			backupVersion: BACKUP_FORMAT_VERSION,
			schemaVersion: isNumber(raw.schemaVersion) ? raw.schemaVersion : 0,
			appVersion: raw.appVersion,
			createdAt: raw.createdAt,
			profiles,
			measurements,
			healthMetrics,
			profileMetricSettings,
			medications,
			medicationIntakes,
			reminders,
			settings,
		},
	}
}

function parseProfileMetricSettings(
	item: unknown,
): ProfileMetricSettings | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.profileId) ||
		!Array.isArray(item.enabledKinds) ||
		!isString(item.updatedAt)
	) {
		return null
	}
	const kinds = item.enabledKinds.filter(
		(k): k is HealthMetricKind =>
			isString(k) && HEALTH_KINDS.includes(k as HealthMetricKind),
	)
	if (kinds.length !== item.enabledKinds.length) {
		return null
	}
	return {
		profileId: item.profileId,
		enabledKinds: normalizeEnabledKinds(kinds),
		updatedAt: item.updatedAt,
	}
}

function parseProfile(item: unknown): Profile | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.name) ||
		!isBoolean(item.isDefault) ||
		!isString(item.createdAt) ||
		!isString(item.updatedAt)
	) {
		return null
	}
	return {
		id: item.id,
		name: item.name,
		isDefault: item.isDefault,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseMeasurement(item: unknown): Measurement | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.profileId) ||
		!isNumber(item.systolic) ||
		!isNumber(item.diastolic) ||
		!isNumber(item.pulse) ||
		item.systolic <= item.diastolic ||
		item.systolic < 50 ||
		item.systolic > 300 ||
		item.diastolic < 30 ||
		item.diastolic > 200 ||
		item.pulse < 20 ||
		item.pulse > 250 ||
		!isIsoTimestamp(item.measuredAt) ||
		!isString(item.periodOfDay) ||
		!isPeriodOfDay(item.periodOfDay) ||
		!Array.isArray(item.tags) ||
		!isIsoTimestamp(item.createdAt) ||
		!isIsoTimestamp(item.updatedAt)
	) {
		return null
	}

	const tags = item.tags.filter(isString)
	if (tags.length !== item.tags.length || !tags.every(isMeasurementTag)) {
		return null
	}

	const wellbeing =
		item.wellbeing === null ||
		item.wellbeing === 'good' ||
		item.wellbeing === 'ok' ||
		item.wellbeing === 'bad'
			? item.wellbeing
			: undefined
	if (wellbeing === undefined) {
		return null
	}

	const note =
		item.note === null || isString(item.note) ? item.note : undefined
	if (note === undefined) {
		return null
	}

	return {
		id: item.id,
		profileId: item.profileId,
		systolic: item.systolic,
		diastolic: item.diastolic,
		pulse: item.pulse,
		measuredAt: item.measuredAt,
		periodOfDay: item.periodOfDay,
		wellbeing,
		tags,
		note,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseHealthMetric(item: unknown): HealthMetric | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.profileId) ||
		!isString(item.kind) ||
		!HEALTH_KINDS.includes(item.kind as HealthMetricKind) ||
		!isNumber(item.value) ||
		!isIsoTimestamp(item.measuredAt) ||
		!isIsoTimestamp(item.createdAt) ||
		!isIsoTimestamp(item.updatedAt)
	) {
		return null
	}
	const unit =
		item.unit === null || isString(item.unit) ? item.unit : undefined
	const note =
		item.note === null || isString(item.note) ? item.note : undefined
	if (unit === undefined || note === undefined) {
		return null
	}
	return {
		id: item.id,
		profileId: item.profileId,
		kind: item.kind as HealthMetricKind,
		value: item.value,
		unit,
		measuredAt: item.measuredAt,
		note,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseMedication(item: unknown): Medication | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.profileId) ||
		!isString(item.name) ||
		item.name.trim().length === 0 ||
		!isString(item.dosageText) ||
		!Array.isArray(item.schedule) ||
		!isBoolean(item.isActive) ||
		!isIsoTimestamp(item.createdAt) ||
		!isIsoTimestamp(item.updatedAt)
	) {
		return null
	}
	const schedule = []
	for (const slot of item.schedule) {
		if (!isObject(slot) || !isNumber(slot.hour) || !isNumber(slot.minute)) {
			return null
		}
		if (
			slot.hour < 0 ||
			slot.hour > 23 ||
			slot.minute < 0 ||
			slot.minute > 59
		) {
			return null
		}
		schedule.push({ hour: slot.hour, minute: slot.minute })
	}
	return {
		id: item.id,
		profileId: item.profileId,
		name: item.name,
		dosageText: item.dosageText,
		schedule,
		isActive: item.isActive,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseIntake(item: unknown): MedicationIntake | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.profileId) ||
		!isString(item.medicationId) ||
		!isIsoTimestamp(item.takenAt) ||
		!isBoolean(item.taken) ||
		!isIsoTimestamp(item.createdAt) ||
		!isIsoTimestamp(item.updatedAt)
	) {
		return null
	}
	const note =
		item.note === null || isString(item.note) ? item.note : undefined
	if (note === undefined) {
		return null
	}
	return {
		id: item.id,
		profileId: item.profileId,
		medicationId: item.medicationId,
		takenAt: item.takenAt,
		scheduledHour: isNumber(item.scheduledHour) ? item.scheduledHour : 0,
		scheduledMinute: isNumber(item.scheduledMinute)
			? item.scheduledMinute
			: 0,
		taken: item.taken,
		note,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseReminder(item: unknown): Reminder | null {
	if (!isObject(item)) {
		return null
	}
	if (
		!isString(item.id) ||
		!isString(item.profileId) ||
		!(item.medicationId === null || isString(item.medicationId)) ||
		!isString(item.title) ||
		!(item.body === null || isString(item.body)) ||
		!isNumber(item.hour) ||
		!isNumber(item.minute) ||
		!Array.isArray(item.weekdays) ||
		!isBoolean(item.enabled) ||
		!(
			item.platformNotificationId === null ||
			isString(item.platformNotificationId)
		) ||
		!isIsoTimestamp(item.createdAt) ||
		!isIsoTimestamp(item.updatedAt)
	) {
		return null
	}
	const weekdays = item.weekdays.filter(isNumber)
	if (weekdays.length !== item.weekdays.length) {
		return null
	}
	return {
		id: item.id,
		profileId: item.profileId,
		medicationId: item.medicationId,
		title: item.title,
		body: item.body,
		hour: item.hour,
		minute: item.minute,
		weekdays,
		enabled: item.enabled,
		platformNotificationId: item.platformNotificationId,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	}
}

function parseSettings(
	item: Record<string, unknown>,
	profileIds: Set<string>,
): AppSettings | null {
	if (
		!(item.activeProfileId === null || isString(item.activeProfileId)) ||
		(item.locale !== 'ru' && item.locale !== 'en') ||
		!isBoolean(item.hasCompletedFirstMeasurement)
	) {
		return null
	}
	if (
		item.activeProfileId !== null &&
		!profileIds.has(item.activeProfileId)
	) {
		return null
	}
	return {
		activeProfileId: item.activeProfileId,
		locale: item.locale,
		hasCompletedFirstMeasurement: item.hasCompletedFirstMeasurement,
	}
}
