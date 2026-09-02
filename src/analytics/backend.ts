import { createAppMetricaAnalyticsService } from './appmetrica-service'
import { createNoopAnalyticsBackend } from './noop-backend'
import type { SafeAnalyticsParams } from './sanitize'

export interface AnalyticsBackend {
	initialize(): void
	report(event: string, params?: SafeAnalyticsParams): void
}

let backend: AnalyticsBackend = createNoopAnalyticsBackend()

export function getAnalyticsBackend(): AnalyticsBackend {
	return backend
}

export function setAnalyticsBackend(next: AnalyticsBackend): void {
	backend = next
}

/** Wires AppMetrica in release-like runs; noop remains default in tests. */
export function installProductionAnalyticsBackend(): void {
	setAnalyticsBackend(createAppMetricaAnalyticsService())
}

export function initializeAnalytics(): void {
	backend.initialize()
}

/** @deprecated Prefer typed helpers from `@/analytics/events`. */
export function trackLegacyEvent(
	event: string,
	params?: SafeAnalyticsParams,
): void {
	backend.report(event, params)
}
