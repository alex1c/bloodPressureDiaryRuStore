import type { AnalyticsBackend } from './backend'
import type { SafeAnalyticsParams } from './sanitize'

export function createNoopAnalyticsBackend(): AnalyticsBackend {
	return {
		initialize() {
			/* noop */
		},
		report(_event: string, _params?: SafeAnalyticsParams) {
			/* noop */
		},
	}
}
