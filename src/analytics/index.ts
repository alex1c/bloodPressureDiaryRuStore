export { analytics } from './events'
export {
	getAnalyticsBackend,
	initializeAnalytics,
	installProductionAnalyticsBackend,
	setAnalyticsBackend,
	trackLegacyEvent,
} from './backend'
export { sanitizeAnalyticsParams } from './sanitize'
export { FORBIDDEN_ANALYTICS_KEYS } from './forbidden-keys'
export {
	createAppMetricaAnalyticsService,
	resetAppMetricaInitializationForTests,
} from './appmetrica-service'

/** @deprecated Use typed `analytics` helpers from `@/analytics/events`. */
export type AnalyticsEventName =
	| 'app_open'
	| 'measurement_saved'
	| 'measurement_deleted'
	| 'backup_exported'
	| 'backup_restored'

/** @deprecated Use `getAnalyticsBackend()` or typed `analytics` helpers. */
export { getAnalyticsBackend as getAnalyticsService } from './backend'

/** @deprecated Use `setAnalyticsBackend()`. */
export { setAnalyticsBackend as setAnalyticsService } from './backend'

/** @deprecated */
export { createNoopAnalyticsBackend as createNoopAnalyticsService } from './noop-backend'
