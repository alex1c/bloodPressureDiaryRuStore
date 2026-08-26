import { getAdService } from '@/ads'
import { getAnalyticsService } from '@/analytics'

let initialized = false

/**
 * Bootstraps cross-cutting services once at app entry.
 * Analytics and ads stay noop until Phase 9.
 */
export function initializeAppServices(): void {
	if (initialized) {
		return
	}

	const analytics = getAnalyticsService()
	analytics.initialize()
	analytics.track('app_open')

	void getAdService().initialize()

	initialized = true
}

export function resetAppServicesInitializationForTests(): void {
	initialized = false
}
