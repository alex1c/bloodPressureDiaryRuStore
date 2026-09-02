/**
 * Analytics parameter keys that must never leave the device.
 * Health-related free text and identifiers are blocked centrally.
 */
export const FORBIDDEN_ANALYTICS_KEYS = [
	'systolic',
	'diastolic',
	'pulse',
	'weight',
	'glucose',
	'spo2',
	'temperature',
	'medication',
	'medicationName',
	'dosage',
	'note',
	'profile',
	'profileName',
	'name',
	'filename',
	'fileName',
	'path',
	'backup',
	'pdf',
	'html',
	'value',
	'measurement',
	'healthMetric',
	'medicationObject',
	'profileObject',
] as const

export type ForbiddenAnalyticsKey = (typeof FORBIDDEN_ANALYTICS_KEYS)[number]
