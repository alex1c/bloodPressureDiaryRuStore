/**
 * Production AppMetrica backend with live analytics-consent gating.
 * activate() failures leave the service uninitialized (failed → retryable).
 */

import AppMetrica from '@appmetrica/react-native-analytics'
import { appMetricaConfig } from '@/config/analytics'
import { filterAllowedAnalyticsEvent } from './allowlist'
import {
	sanitizeAnalyticsParams,
	type SafeAnalyticsParams,
} from './sanitize'

let initialized = false
let analyticsAllowed = false
let activateInFlight = false

export function resetAppMetricaInitializationForTests(): void {
	initialized = false
	analyticsAllowed = false
	activateInFlight = false
}

export function setAnalyticsAllowed(allowed: boolean): void {
	analyticsAllowed = allowed
	if (!initialized) {
		return
	}
	try {
		AppMetrica.setDataSendingEnabled(allowed)
		AppMetrica.setAdvIdentifiersTracking(allowed)
	} catch {
		/* SDK may be inactive */
	}
}

export function getAnalyticsAllowedForTests(): boolean {
	return analyticsAllowed
}

export function isAppMetricaInitializedForTests(): boolean {
	return initialized
}

function dispatchEvent(event: string, params?: SafeAnalyticsParams): void {
	if (!initialized || !analyticsAllowed) {
		return
	}

	const filtered = filterAllowedAnalyticsEvent(
		event,
		sanitizeAnalyticsParams(params),
	)
	if (!filtered) {
		return
	}

	try {
		if (filtered.params) {
			AppMetrica.reportEvent(filtered.event, filtered.params)
		} else {
			AppMetrica.reportEvent(filtered.event)
		}
	} catch (error) {
		if (__DEV__) {
			console.warn('[analytics] AppMetrica report failed', error)
		}
	}
}

export function createAppMetricaAnalyticsService() {
	return {
		/**
		 * Activates AppMetrica when analytics is allowed.
		 * Throws on activate failure so bootstrap can enter `failed` + retry.
		 */
		initialize() {
			if (!analyticsAllowed) {
				return
			}
			if (initialized) {
				return
			}
			if (activateInFlight) {
				return
			}

			activateInFlight = true
			try {
				AppMetrica.activate({
					apiKey: appMetricaConfig.apiKey,
					sessionTimeout: appMetricaConfig.sessionTimeoutSec,
					logs: __DEV__,
					statisticsSending: true,
					locationTracking: false,
					advIdentifiersTracking: true,
					appOpenTrackingEnabled: false,
				})
				AppMetrica.setLocationTracking(false)
				if (!analyticsAllowed) {
					// Reject won during activate — disable sending immediately.
					try {
						AppMetrica.setDataSendingEnabled(false)
						AppMetrica.setAdvIdentifiersTracking(false)
					} catch {
						/* ignore */
					}
				}
				initialized = true
			} catch (error) {
				initialized = false
				if (__DEV__) {
					console.warn('[analytics] AppMetrica activate failed', error)
				}
				throw error instanceof Error
					? error
					: new Error('appmetrica_activate_failed')
			} finally {
				activateInFlight = false
			}
		},
		report(event: string, params?: SafeAnalyticsParams) {
			dispatchEvent(event, params)
		},
		setDataSendingEnabled(enabled: boolean) {
			setAnalyticsAllowed(enabled)
		},
	}
}

export type AppMetricaAnalyticsService = ReturnType<
	typeof createAppMetricaAnalyticsService
>
