/**
 * Production AppMetrica configuration.
 * Health values must never be sent as event parameters — see analytics wrapper.
 */
export const appMetricaConfig = {
	/** Production API key for «Дневник давления». */
	apiKey: '233587e7-4552-4959-a6f4-5f06eb451319',
	sessionTimeoutSec: 120,
} as const

/** UUID v4-ish shape used by release validation. */
export const APPMETRICA_KEY_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
