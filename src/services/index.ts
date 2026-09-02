import Constants from 'expo-constants'
import {
	getAdService,
	installProductionAdService,
	markOpenedFromMedicationNotification,
} from '@/ads'
import {
	analytics,
	initializeAnalytics,
	installProductionAnalyticsBackend,
} from '@/analytics'
import { resolveAdRuntimeVariant } from '@/config/ads'

let initialized = false

function isProductionRuntime(): boolean {
	const variant = Constants.expoConfig?.extra?.appVariant
	if (variant === 'production') {
		return true
	}
	return !__DEV__
}

async function detectMedicationNotificationOpen(): Promise<void> {
	try {
		const Notifications = await import('expo-notifications')
		const last = await Notifications.getLastNotificationResponseAsync()
		const data = last?.notification.request.content.data
		if (data && typeof data === 'object' && 'medicationId' in data) {
			markOpenedFromMedicationNotification()
		}
	} catch {
		/* ignore — ads must never block boot */
	}
}

/**
 * Bootstraps cross-cutting services once at app entry.
 * Production analytics/ads activate only in release-like runtime.
 */
export function initializeAppServices(): void {
	if (initialized) {
		return
	}

	if (isProductionRuntime()) {
		installProductionAnalyticsBackend()
		installProductionAdService()
	}

	initializeAnalytics()
	analytics.trackAppOpen()
	analytics.trackAppSessionStarted()

	void getAdService().initialize()
	void detectMedicationNotificationOpen()

	initialized = true
}

/** @internal test helper */
export function resetAppServicesInitializationForTests(): void {
	initialized = false
}

/** Exposed for release validation tooling. */
export function getRuntimeIntegrationVariant(): 'production' | 'development' {
	return resolveAdRuntimeVariant(
		Constants.expoConfig?.extra?.appVariant as string | undefined,
	)
}
