/**
 * Analytics seam for future AppMetrica (Phase 9).
 * No-op in Phase 0–2 — never blocks diary UX.
 */
export type AnalyticsEventName =
	| 'app_open'
	| 'measurement_saved'
	| 'measurement_deleted'
	| 'backup_exported'
	| 'backup_restored'

export interface AnalyticsService {
	initialize(): void
	track(event: AnalyticsEventName, params?: Record<string, string | number | boolean>): void
}

export function createNoopAnalyticsService(): AnalyticsService {
	return {
		initialize() {
			/* Phase 9 */
		},
		track() {
			/* Phase 9 */
		},
	}
}

let analyticsService: AnalyticsService = createNoopAnalyticsService()

export function getAnalyticsService(): AnalyticsService {
	return analyticsService
}

export function setAnalyticsService(service: AnalyticsService): void {
	analyticsService = service
}
