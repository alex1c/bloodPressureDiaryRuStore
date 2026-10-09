/**
 * Consent policy for AppMetrica + Yandex Mobile Ads (international Play).
 *
 * Purposes are independent:
 * - analytics (AppMetrica technical events)
 * - ads (Yandex Mobile Ads)
 *
 * Yandex Mobile Ads SDK does not expose a guaranteed non-personalized-only
 * mode we can enforce. Therefore we do NOT offer a fake “ads without
 * personalization” toggle — granting ads means personalized ads may run;
 * denying ads blocks all Yandex ad load/show.
 */

import type { StoreId } from '@/config/store'
import type {
	PersistedPrivacyConsent,
	PurposeDecision,
} from './consent-persistence'
import { resolveConsentRuntimeSnapshot } from './cmp-adapter'

export type ConsentRequirement = {
	requiresExplicitConsent: boolean
	reason: string
	isFirstPartyGateOnly: boolean
	blocksGoogleDemandUntilCmp: boolean
	/**
	 * Personalization cannot be toggled independently of ads for the shipped
	 * Yandex SDK — disclosed in UI / privacy policy.
	 */
	adsPersonalizationSeparable: boolean
}

export function resolveConsentRequirement(input: {
	storeId: StoreId
	isProductionRuntime: boolean
}): ConsentRequirement {
	if (!input.isProductionRuntime) {
		return {
			requiresExplicitConsent: false,
			reason: 'development_runtime',
			isFirstPartyGateOnly: true,
			blocksGoogleDemandUntilCmp: true,
			adsPersonalizationSeparable: false,
		}
	}

	return {
		requiresExplicitConsent: true,
		reason: `production_${input.storeId}_worldwide_first_party_gate`,
		isFirstPartyGateOnly: true,
		blocksGoogleDemandUntilCmp: true,
		adsPersonalizationSeparable: false,
	}
}

/** True when the user has not answered a required prompt for either purpose. */
export function isConsentPending(
	state: Pick<PersistedPrivacyConsent, 'analytics' | 'ads'>,
	requirement: ConsentRequirement,
): boolean {
	if (!requirement.requiresExplicitConsent) {
		return false
	}
	return state.analytics === null || state.ads === null
}

export function canEnableAnalytics(
	analytics: PurposeDecision | null,
	requirement: ConsentRequirement,
): boolean {
	if (!requirement.requiresExplicitConsent) {
		return true
	}
	return analytics === 'granted'
}

export function canEnableAds(
	ads: PurposeDecision | null,
	requirement: ConsentRequirement,
): boolean {
	if (!requirement.requiresExplicitConsent) {
		return true
	}
	return ads === 'granted'
}

/** Optional SDKs may start when at least one purpose is granted. */
export function canEnableOptionalSdks(
	state: Pick<PersistedPrivacyConsent, 'analytics' | 'ads'>,
	requirement: ConsentRequirement,
): boolean {
	return (
		canEnableAnalytics(state.analytics, requirement) ||
		canEnableAds(state.ads, requirement)
	)
}

/** Builds a runtime snapshot for adapters / UI. */
export function snapshotFromPurposes(
	state: Pick<PersistedPrivacyConsent, 'analytics' | 'ads'>,
) {
	return resolveConsentRuntimeSnapshot({
		analytics: state.analytics,
		ads: state.ads,
		hasGoogleCertifiedCmpIntegration: false,
	})
}
