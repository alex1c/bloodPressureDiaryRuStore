/**
 * Domain entity types for the blood-pressure diary.
 * Optional fields use `null` when absent — never rely on falsy checks alone.
 */

/** Stable id strings (UUID v4 or equivalent). */
export type EntityId = string

/** ISO-8601 timestamps stored as strings. */
export type IsoDateTime = string

/** Time-of-day bucket derived automatically from measuredAt (local clock). */
export type PeriodOfDay = 'morning' | 'day' | 'evening' | 'night'

/** Preset context tags for a measurement. */
export type MeasurementTag =
	| 'normal'
	| 'headache'
	| 'lack_of_sleep'
	| 'stress'
	| 'coffee'
	| 'physical_activity'

/** Optional wellbeing label (free vocabulary kept short for V1). */
export type WellbeingLevel = 'good' | 'ok' | 'bad' | null

export interface Profile {
	id: EntityId
	/** Display name, e.g. «Я», «Мама». */
	name: string
	/** True for the default profile created on first launch. */
	isDefault: boolean
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

/**
 * Blood pressure + pulse reading.
 * Optional context fields are null when the user skipped them.
 */
export interface Measurement {
	id: EntityId
	profileId: EntityId
	systolic: number
	diastolic: number
	pulse: number
	measuredAt: IsoDateTime
	periodOfDay: PeriodOfDay
	wellbeing: WellbeingLevel
	tags: MeasurementTag[]
	/** Free-text note; empty string means user cleared text, null means unused. */
	note: string | null
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

export type HealthMetricKind = 'weight' | 'glucose' | 'spo2' | 'temperature'

/**
 * Standalone health metric with its own measurement time.
 * Value semantics depend on kind (kg, mmol/L or mg/dL later, %, °C).
 */
export interface HealthMetric {
	id: EntityId
	profileId: EntityId
	kind: HealthMetricKind
	value: number
	/** Optional unit label stored with the row for future display flexibility. */
	unit: string | null
	measuredAt: IsoDateTime
	note: string | null
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

/** One scheduled clock time, local HH:mm (24h). */
export interface MedicationScheduleTime {
	hour: number
	minute: number
}

/**
 * Medication plan for a profile.
 * Schedule describes intent; intakes record facts separately.
 */
export interface Medication {
	id: EntityId
	profileId: EntityId
	name: string
	/** Free-text dosage, e.g. «5 мг» — not parsed medically. */
	dosageText: string
	schedule: MedicationScheduleTime[]
	isActive: boolean
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

/** Fact that a dose was taken (or skipped) at a point in time. */
export interface MedicationIntake {
	id: EntityId
	profileId: EntityId
	medicationId: EntityId
	takenAt: IsoDateTime
	/**
	 * Planned local wall-clock slot this intake fulfills (not UTC).
	 * Together with the local calendar day of takenAt, identifies the dose.
	 */
	scheduledHour: number
	scheduledMinute: number
	/** true = taken; false = explicitly marked skipped. */
	taken: boolean
	note: string | null
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

/**
 * Reminder definition ready for future Android local notifications.
 * Does not embed delivery state in V1 schema beyond enabled flag.
 */
export interface Reminder {
	id: EntityId
	profileId: EntityId
	/** Optional link to a medication; null = generic reminder. */
	medicationId: EntityId | null
	title: string
	body: string | null
	/** Local time of day to fire. */
	hour: number
	minute: number
	/** Bitmask-friendly weekday list: 0=Sun … 6=Sat (JS getDay). */
	weekdays: number[]
	enabled: boolean
	/** Opaque platform notification id once scheduled; null until wired. */
	platformNotificationId: string | null
	createdAt: IsoDateTime
	updatedAt: IsoDateTime
}

export interface AppSettings {
	activeProfileId: EntityId | null
	/** Locale preference; default ru. */
	locale: 'ru' | 'en'
	/** First measurement completed — gates later ad policy. */
	hasCompletedFirstMeasurement: boolean
}

export interface CreateMeasurementInput {
	profileId: EntityId
	systolic: number
	diastolic: number
	pulse: number
	measuredAt: IsoDateTime
	periodOfDay: PeriodOfDay
	wellbeing?: WellbeingLevel
	tags?: MeasurementTag[]
	note?: string | null
}

export interface UpdateMeasurementInput {
	systolic?: number
	diastolic?: number
	pulse?: number
	measuredAt?: IsoDateTime
	periodOfDay?: PeriodOfDay
	wellbeing?: WellbeingLevel
	tags?: MeasurementTag[]
	note?: string | null
}
