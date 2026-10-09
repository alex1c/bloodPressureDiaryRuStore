/**
 * Applies purpose consent to optional SDKs (offline-safe, idempotent).
 *
 * Yandex: setUserConsent before initialize / ad requests.
 * AppMetrica sending is gated separately in the analytics service.
 */

import { MobileAds } from 'yandex-mobile-ads'
import type { PurposeDecision } from './consent-persistence'

let lastAppliedAdsConsent: boolean | null = null

/** Resets bridge state for unit tests. */
export function resetSdkConsentBridgeForTests(): void {
	lastAppliedAdsConsent = null
}

/**
 * Pushes the GDPR-style userConsent flag into Yandex Mobile Ads.
 * Does not initialize the ads SDK.
 */
export function applyYandexUserConsent(ads: PurposeDecision | null): void {
	if (ads === null) {
		return
	}
	const enabled = ads === 'granted'
	if (lastAppliedAdsConsent === enabled) {
		return
	}
	try {
		MobileAds.setUserConsent(enabled)
		lastAppliedAdsConsent = enabled
	} catch {
		/* Native module may be unavailable in Jest / web */
	}
}

export function mayInitializeAds(
	ads: PurposeDecision | null,
	requiresGate: boolean,
): boolean {
	if (!requiresGate) {
		return true
	}
	return ads === 'granted'
}

export function mayInitializeAnalytics(
	analytics: PurposeDecision | null,
	requiresGate: boolean,
): boolean {
	if (!requiresGate) {
		return true
	}
	return analytics === 'granted'
}
