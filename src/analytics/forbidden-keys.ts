/**
 * Analytics parameter keys that must never leave the device.
 * Health-related free text, identifiers, and medical value fields are blocked
 * centrally before any AppMetrica dispatch.
 */
export const FORBIDDEN_ANALYTICS_KEYS = [
	// Blood pressure / pulse values
	'systolic',
	'diastolic',
	'pulse',
	'bp',
	'blood_pressure',
	'bloodPressure',
	// Extra health metric values / kinds
	'weight',
	'glucose',
	'spo2',
	'temperature',
	'metric_type',
	'metricType',
	'metric',
	'kind',
	'health_metric',
	'healthMetric',
	'value',
	'unit',
	// Medications / intake
	'medication',
	'medicationName',
	'medication_name',
	'dosage',
	'dose',
	'schedule',
	'intake',
	'taken',
	'missed',
	'medicationObject',
	// Free text / identity
	'note',
	'notes',
	'tag',
	'tags',
	'profile',
	'profileName',
	'profile_name',
	'name',
	'email',
	// Files / payloads
	'filename',
	'fileName',
	'path',
	'backup',
	'pdf',
	'html',
	'measurement',
	'profileObject',
] as const

export type ForbiddenAnalyticsKey = (typeof FORBIDDEN_ANALYTICS_KEYS)[number]
