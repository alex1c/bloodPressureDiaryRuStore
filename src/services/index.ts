/**
 * Optional SDK bootstrap.
 *
 * Reject applies setAnalyticsAllowed / setAdsAllowed synchronously before any
 * await so first-party gates flip immediately even while a prior initialize
 * Promise is still in flight.
 */

import Constants from 'expo-constants'
import {
	getAdService,
	installProductionAdService,
	markOpenedFromMedicationNotification,
} from '@/ads'
import type { YandexAdService } from '@/ads/yandex-ad-service'
import {
	analytics,
	initializeAnalytics,
	installProductionAnalyticsBackend,
	setAnalyticsAllowed,
} from '@/analytics'
import { resolveAdRuntimeVariant } from '@/config/ads'

export type OptionalSdkPhase = 'idle' | 'starting' | 'started' | 'failed'
export type SdkUnitPhase = 'idle' | 'starting' | 'started' | 'failed'

let initialized = false
let optionalSdkPhase: OptionalSdkPhase = 'idle'
let analyticsPhase: SdkUnitPhase = 'idle'
let adsPhase: SdkUnitPhase = 'idle'
let lastAnalyticsAllowed = false
let lastAdsAllowed = false
/**
 * Bumped on every synchronous permission write so an in-flight Accept start
 * cannot re-enable gates after a newer Reject.
 */
let permissionGeneration = 0
/** Serializes SDK *start* only — never blocks Reject application. */
let startInFlight: Promise<void> | null = null

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
		/* ignore */
	}
}

export function initializeAppServices(): void {
	if (initialized) {
		return
	}
	if (isProductionRuntime()) {
		installProductionAnalyticsBackend()
		installProductionAdService()
	}
	void detectMedicationNotificationOpen()
	initialized = true
}

function asYandexAds(): YandexAdService | null {
	const svc = getAdService() as YandexAdService
	if (typeof svc.setAdsAllowed === 'function') {
		return svc
	}
	return null
}

/** Synchronous permission apply — must run before any await. */
function applyPermissionsSync(input: {
	analyticsAllowed: boolean
	adsAllowed: boolean
}): void {
	lastAnalyticsAllowed = input.analyticsAllowed
	lastAdsAllowed = input.adsAllowed
	setAnalyticsAllowed(input.analyticsAllowed)
	asYandexAds()?.setAdsAllowed(input.adsAllowed)
	if (!input.analyticsAllowed) {
		analyticsPhase = analyticsPhase === 'failed' ? 'failed' : 'idle'
	}
	if (!input.adsAllowed) {
		adsPhase = adsPhase === 'failed' ? 'failed' : 'idle'
	}
	if (!input.analyticsAllowed && !input.adsAllowed) {
		optionalSdkPhase = 'idle'
	}
}

/**
 * Immediate first-party gate flip (Reject / mixed deny / Accept flags).
 * Call from PrivacyConsentProvider handlers — do not wait for useEffect.
 */
export function applyOptionalSdkPermissionsSync(input: {
	analyticsAllowed: boolean
	adsAllowed: boolean
}): number {
	permissionGeneration += 1
	applyPermissionsSync(input)
	return permissionGeneration
}

export function getOptionalSdkPermissionsForTests() {
	return {
		analyticsAllowed: lastAnalyticsAllowed,
		adsAllowed: lastAdsAllowed,
		permissionGeneration,
	}
}

function recomputeOptionalPhase(): void {
	if (!lastAnalyticsAllowed && !lastAdsAllowed) {
		optionalSdkPhase = 'idle'
		return
	}
	if (
		(lastAnalyticsAllowed && analyticsPhase === 'failed') ||
		(lastAdsAllowed && adsPhase === 'failed')
	) {
		optionalSdkPhase = 'failed'
		return
	}
	if (
		(lastAnalyticsAllowed && analyticsPhase === 'starting') ||
		(lastAdsAllowed && adsPhase === 'starting')
	) {
		optionalSdkPhase = 'starting'
		return
	}
	const analyticsOk = !lastAnalyticsAllowed || analyticsPhase === 'started'
	const adsOk = !lastAdsAllowed || adsPhase === 'started'
	optionalSdkPhase = analyticsOk && adsOk ? 'started' : 'idle'
}

async function startAllowedSdks(): Promise<void> {
	if (!lastAnalyticsAllowed && !lastAdsAllowed) {
		optionalSdkPhase = 'idle'
		return
	}

	optionalSdkPhase = 'starting'

	if (lastAnalyticsAllowed && analyticsPhase !== 'started') {
		analyticsPhase = 'starting'
		try {
			initializeAnalytics()
			if (!lastAnalyticsAllowed) {
				analyticsPhase = 'idle'
			} else {
				analytics.trackAppOpen()
				analytics.trackAppSessionStarted()
				analyticsPhase = 'started'
			}
		} catch {
			analyticsPhase = lastAnalyticsAllowed ? 'failed' : 'idle'
		}
	}

	if (lastAdsAllowed) {
		if (adsPhase !== 'started') {
			adsPhase = 'starting'
		}
		try {
			await getAdService().initialize()
			adsPhase = lastAdsAllowed ? 'started' : 'idle'
		} catch {
			adsPhase = lastAdsAllowed ? 'failed' : 'idle'
		}
	}

	recomputeOptionalPhase()
}

/**
 * Applies purpose flags. Reject is immediate (no await of prior start).
 * Start path may serialize behind startInFlight.
 */
export async function syncOptionalSdks(input: {
	analyticsAllowed: boolean
	adsAllowed: boolean
}): Promise<void> {
	const generation = applyOptionalSdkPermissionsSync(input)

	// Reject / both-off: do not wait for an in-flight Accept initialize.
	if (!input.analyticsAllowed && !input.adsAllowed) {
		return
	}

	if (!lastAnalyticsAllowed && !lastAdsAllowed) {
		return
	}

	if (startInFlight) {
		await startInFlight
		if (generation !== permissionGeneration) {
			return
		}
		if (!lastAnalyticsAllowed && !lastAdsAllowed) {
			return
		}
	}

	const snapshot = {
		analyticsAllowed: lastAnalyticsAllowed,
		adsAllowed: lastAdsAllowed,
	}
	startInFlight = startAllowedSdks().finally(() => {
		startInFlight = null
	})
	await startInFlight

	if (generation !== permissionGeneration) {
		return
	}

	if (
		lastAnalyticsAllowed !== snapshot.analyticsAllowed ||
		lastAdsAllowed !== snapshot.adsAllowed
	) {
		await syncOptionalSdks({
			analyticsAllowed: lastAnalyticsAllowed,
			adsAllowed: lastAdsAllowed,
		})
	}
}

/** @deprecated Prefer {@link syncOptionalSdks}. */
export function startOptionalSdksIfAllowed(allowed: boolean): void {
	void syncOptionalSdks({
		analyticsAllowed: allowed,
		adsAllowed: allowed,
	})
}

export async function retryOptionalSdksAfterFailure(): Promise<void> {
	if (optionalSdkPhase !== 'failed') {
		return
	}
	analyticsPhase = 'idle'
	adsPhase = 'idle'
	optionalSdkPhase = 'idle'
	await syncOptionalSdks({
		analyticsAllowed: lastAnalyticsAllowed,
		adsAllowed: lastAdsAllowed,
	})
}

export function getOptionalSdkPhase(): OptionalSdkPhase {
	return optionalSdkPhase
}

export function getSdkUnitPhasesForTests() {
	return { analyticsPhase, adsPhase, optionalSdkPhase }
}

export function resetAppServicesInitializationForTests(): void {
	initialized = false
	optionalSdkPhase = 'idle'
	analyticsPhase = 'idle'
	adsPhase = 'idle'
	lastAnalyticsAllowed = false
	lastAdsAllowed = false
	permissionGeneration = 0
	startInFlight = null
}

export function getRuntimeIntegrationVariant(): 'production' | 'development' {
	return resolveAdRuntimeVariant(
		Constants.expoConfig?.extra?.appVariant as string | undefined,
	)
}
