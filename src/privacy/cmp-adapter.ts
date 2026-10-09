/**
 * Consent Management Platform (CMP) adapter boundary.
 *
 * Current release: first-party purpose gate only (not a Google-certified CMP).
 * Presence of an IAB TC string alone must NEVER be treated as user consent —
 * Reject / denied purposes always win for personalized ads.
 */

import type { PurposeDecision } from './consent-persistence'
import type { PrivacyJurisdiction } from './consent-regions'

export type ConsentPurpose =
	| 'analytics_appmetrica'
	| 'ads_yandex'
	| 'ads_personalized'

export type ConsentRuntimeSnapshot = {
	provider: 'first_party_gate' | 'google_certified_cmp' | 'none'
	purposes: Partial<Record<ConsentPurpose, boolean>>
	/**
	 * Google AdMob / other Google demand must stay off until a certified CMP
	 * is integrated AND purposes allow ads.
	 */
	blocksGoogleDemandUntilCmp: boolean
	jurisdictionHint: PrivacyJurisdiction | 'unknown'
}

/**
 * Resolves runtime permissions from first-party purposes and optional CMP signals.
 *
 * Rules:
 * - Denied ads → personalized ads always false (even if a TC string exists).
 * - TC string without purpose grants does not enable ads or analytics.
 * - Google demand stays blocked until an explicit certified-CMP integration flag.
 */
export function resolveConsentRuntimeSnapshot(input: {
	analytics: PurposeDecision | null
	ads: PurposeDecision | null
	/** Future: true only after a certified CMP integration is wired + verified. */
	hasGoogleCertifiedCmpIntegration?: boolean
	/**
	 * Future: purpose/vendor bits already validated by the CMP SDK — never inferred
	 * from TC string presence alone.
	 */
	cmpAllowsPersonalizedAds?: boolean
	cmpAllowsAnalytics?: boolean
	jurisdictionHint?: PrivacyJurisdiction | 'unknown'
}): ConsentRuntimeSnapshot {
	const jurisdictionHint = input.jurisdictionHint ?? 'unknown'
	const hasCmp = input.hasGoogleCertifiedCmpIntegration === true
	const adsGranted = input.ads === 'granted'
	const analyticsGranted = input.analytics === 'granted'
	const adsDenied = input.ads === 'denied'

	// Reject always wins over any CMP/TC artifact for personalized ads.
	const personalized =
		!adsDenied &&
		adsGranted &&
		(hasCmp ? input.cmpAllowsPersonalizedAds === true : true)

	const analytics =
		analyticsGranted &&
		(hasCmp ? input.cmpAllowsAnalytics !== false : true)

	return {
		provider: hasCmp ? 'google_certified_cmp' : 'first_party_gate',
		purposes: {
			analytics_appmetrica: analytics,
			ads_yandex: adsGranted && !adsDenied,
			ads_personalized: personalized,
		},
		blocksGoogleDemandUntilCmp: !hasCmp,
		jurisdictionHint,
	}
}

/** Mediation partners that must not be shipped until owner + CMP approval. */
export const BLOCKED_MEDIATION_PARTNERS_UNTIL_APPROVAL = [
	'admob',
	'mintegral',
	'applovin',
	'unity',
	'ironsource',
] as const
