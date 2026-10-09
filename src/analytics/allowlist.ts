/**
 * Strict analytics allowlist — only these events/params may leave the device.
 * Unknown events or params are dropped (never forwarded to AppMetrica).
 */

import type { SafeAnalyticsParams, SafeAnalyticsPrimitive } from './sanitize'

/** Allowed event names and optional parameter schemas. */
export const ANALYTICS_EVENT_ALLOWLIST = {
	app_open: {},
	app_session_started: {},
	graphs_opened: {},
	graph_period_changed: {
		period: ['7', '30', '90', 'all'] as const,
	},
	reminder_enabled: {},
	reminder_permission_denied: {},
	profile_created: {},
	profile_switched: {},
	doctor_report_opened: {},
	doctor_report_pdf_created: {},
	doctor_report_shared: {},
	backup_created: {},
	backup_restore_started: {},
	backup_restore_success: {},
	backup_restore_failed: {},
	locale_changed: {
		locale: ['ru', 'en', 'es', 'de'] as const,
		preference: ['system', 'ru', 'en', 'es', 'de'] as const,
	},
} as const

export type AllowedAnalyticsEvent = keyof typeof ANALYTICS_EVENT_ALLOWLIST

/**
 * Medical / diary mutation event names that must never be reported.
 * Kept for negative tests and regression guards.
 */
export const FORBIDDEN_ANALYTICS_EVENTS = [
	'measurement_created',
	'measurement_updated',
	'measurement_deleted',
	'health_metric_created',
	'health_metric_updated',
	'health_metric_deleted',
	'medication_created',
	'medication_updated',
	'medication_deactivated',
	'medication_intake_marked',
	'medication_intake_undone',
] as const

function isAllowedPrimitive(
	value: SafeAnalyticsPrimitive,
	allowed: readonly string[] | undefined,
): boolean {
	if (allowed) {
		return typeof value === 'string' && (allowed as readonly string[]).includes(value)
	}
	// Events with empty schema accept no params.
	return false
}

/**
 * Filters an event through the allowlist.
 * Returns null when the event is unknown or all params were stripped / invalid.
 */
function isOwnAllowlistedEvent(event: string): event is AllowedAnalyticsEvent {
	return Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_ALLOWLIST, event)
}

export function filterAllowedAnalyticsEvent(
	event: string,
	params?: SafeAnalyticsParams,
): { event: AllowedAnalyticsEvent; params?: SafeAnalyticsParams } | null {
	// Use hasOwnProperty — never `in`, which matches prototype keys
	// (toString, constructor, __proto__).
	if (!isOwnAllowlistedEvent(event)) {
		return null
	}

	const key = event
	const schema = ANALYTICS_EVENT_ALLOWLIST[key] as Record<
		string,
		readonly string[] | undefined
	>
	const schemaKeys = Object.keys(schema)

	if (schemaKeys.length === 0) {
		return { event: key }
	}

	if (!params) {
		return null
	}

	const output: SafeAnalyticsParams = {}
	for (const [paramKey, allowedValues] of Object.entries(schema)) {
		if (!(paramKey in params)) {
			continue
		}
		const value = params[paramKey]
		if (
			value !== undefined &&
			isAllowedPrimitive(value, allowedValues as readonly string[] | undefined)
		) {
			output[paramKey] = value
		}
	}

	if (Object.keys(output).length !== schemaKeys.length) {
		// Require all declared params to be present and valid.
		return null
	}

	return { event: key, params: output }
}
