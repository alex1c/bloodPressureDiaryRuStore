import AppMetrica from '@appmetrica/react-native-analytics'
import { appMetricaConfig } from '@/config/analytics'
import {
	sanitizeAnalyticsParams,
	type SafeAnalyticsParams,
} from './sanitize'

let initialized = false

/** Resets init guard for unit tests. */
export function resetAppMetricaInitializationForTests(): void {
	initialized = false
}

function dispatchEvent(event: string, params?: SafeAnalyticsParams): void {
	if (!initialized) {
		return
	}

	try {
		const safe = sanitizeAnalyticsParams(params)
		if (safe) {
			AppMetrica.reportEvent(event, safe)
		} else {
			AppMetrica.reportEvent(event)
		}
	} catch (error) {
		if (__DEV__) {
			console.warn('[analytics] AppMetrica report failed', error)
		}
	}
}

export function createAppMetricaAnalyticsService() {
	return {
		initialize() {
			if (initialized) {
				return
			}

			try {
				AppMetrica.activate({
					apiKey: appMetricaConfig.apiKey,
					sessionTimeout: appMetricaConfig.sessionTimeoutSec,
					logs: __DEV__,
					statisticsSending: true,
				})
				initialized = true
			} catch (error) {
				if (__DEV__) {
					console.warn('[analytics] AppMetrica activate failed', error)
				}
			}
		},
		report(event: string, params?: SafeAnalyticsParams) {
			dispatchEvent(event, params)
		},
	}
}

export type AppMetricaAnalyticsService = ReturnType<
	typeof createAppMetricaAnalyticsService
>
