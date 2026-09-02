import { FORBIDDEN_ANALYTICS_KEYS } from './forbidden-keys'

export type SafeAnalyticsPrimitive = string | number | boolean

export type SafeAnalyticsParams = Record<string, SafeAnalyticsPrimitive>

/**
 * Strips forbidden keys and non-primitive values before SDK dispatch.
 * Throws in tests when a forbidden key is detected to catch regressions early.
 */
export function sanitizeAnalyticsParams(
	params: SafeAnalyticsParams | undefined,
	options?: { strict?: boolean },
): SafeAnalyticsParams | undefined {
	if (!params) {
		return undefined
	}

	const forbidden = new Set<string>(
		FORBIDDEN_ANALYTICS_KEYS.map((k) => k.toLowerCase()),
	)
	const output: SafeAnalyticsParams = {}

	for (const [rawKey, rawValue] of Object.entries(params)) {
		const key = rawKey.trim()
		const lower = key.toLowerCase()

		if (forbidden.has(lower)) {
			if (options?.strict) {
				throw new Error(`Forbidden analytics key: ${key}`)
			}
			continue
		}

		if (
			typeof rawValue !== 'string' &&
			typeof rawValue !== 'number' &&
			typeof rawValue !== 'boolean'
		) {
			if (options?.strict) {
				throw new Error(`Non-primitive analytics value for key: ${key}`)
			}
			continue
		}

		output[key] = rawValue
	}

	return Object.keys(output).length > 0 ? output : undefined
}
