/**
 * Regional consent requirements for an international Google Play release.
 *
 * This module encodes policy *intent* for architecture and tests. It does not
 * replace a Google-certified IAB TCF CMP, legal counsel, or geo-IP detection.
 *
 * Distribution strategy (owner-confirmed): worldwide, including EEA, UK,
 * Switzerland, USA, Canada, Asia, and Latin America.
 */

/** High-level privacy jurisdiction buckets used by the consent layer. */
export type PrivacyJurisdiction =
	| 'eea_uk_ch'
	| 'us_state_privacy'
	| 'canada'
	| 'latam'
	| 'asia'
	| 'rest_of_world'

export type RegionalConsentNeeds = {
	/** First-party opt-in before optional AppMetrica / Yandex Ads network use. */
	requiresFirstPartySdkGate: boolean
	/**
	 * Google-certified IAB TCF CMP required when serving personalized ads via
	 * Google publisher products (AdMob / Ad Manager / AdSense) in this region.
	 * Not automatically required for a Yandex-only ad stack, but required before
	 * enabling AdMob (including via Yandex mediation) for these users.
	 */
	requiresGoogleCertifiedCmpForGoogleAds: boolean
	/** Yandex Mobile Ads setUserConsent / TCF SharedPreferences path. */
	requiresYandexGdprSignal: boolean
	/**
	 * US state “sale/share” / targeted-ads opt-out style controls (CCPA/CPRA and
	 * similar). Binary EU-style accept is not a substitute.
	 */
	requiresUsPrivacySignals: boolean
	notes: string
}

/**
 * Static matrix used until a CMP (or legal geo service) supplies live region.
 * Production Google Play always applies the first-party SDK gate globally.
 */
export const REGIONAL_CONSENT_MATRIX: Record<
	PrivacyJurisdiction,
	RegionalConsentNeeds
> = {
	eea_uk_ch: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: true,
		requiresYandexGdprSignal: true,
		requiresUsPrivacySignals: false,
		notes:
			'GDPR / UK GDPR / ePrivacy + Google EU User Consent Policy for Google ads; Yandex GDPR setUserConsent + optional IAB TCF.',
	},
	us_state_privacy: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: false,
		requiresYandexGdprSignal: false,
		requiresUsPrivacySignals: true,
		notes:
			'State privacy laws (e.g. CCPA/CPRA) emphasize notice + opt-out of sale/share / targeted ads — not a single GDPR dialog.',
	},
	canada: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: false,
		requiresYandexGdprSignal: false,
		requiresUsPrivacySignals: false,
		notes: 'CASL / PIPEDA-oriented transparency; first-party gate kept for optional SDKs.',
	},
	latam: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: false,
		requiresYandexGdprSignal: false,
		requiresUsPrivacySignals: false,
		notes: 'Country-specific privacy laws vary; keep optional SDKs behind explicit choice.',
	},
	asia: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: false,
		requiresYandexGdprSignal: false,
		requiresUsPrivacySignals: false,
		notes: 'Jurisdiction-specific (PDPA and others); keep optional SDKs behind explicit choice.',
	},
	rest_of_world: {
		requiresFirstPartySdkGate: true,
		requiresGoogleCertifiedCmpForGoogleAds: false,
		requiresYandexGdprSignal: false,
		requiresUsPrivacySignals: false,
		notes: 'Conservative first-party gate for worldwide Google Play listing.',
	},
}

/**
 * Priority locales shipped today vs recommended expansion order for worldwide Play.
 * Does not imply CMP language packs — those come from the CMP vendor.
 */
export const LOCALE_EXPANSION_PRIORITY = [
	{ code: 'ru', status: 'shipped' as const, reason: 'Primary product language' },
	{ code: 'en', status: 'shipped' as const, reason: 'Global / UK / US baseline' },
	{ code: 'es', status: 'shipped' as const, reason: 'Spain + LATAM' },
	{ code: 'de', status: 'shipped' as const, reason: 'DACH / EEA' },
	{ code: 'fr', status: 'next' as const, reason: 'EEA / Canada FR' },
	{ code: 'pt-BR', status: 'next' as const, reason: 'Brazil LATAM scale' },
	{ code: 'it', status: 'next' as const, reason: 'EEA' },
	{ code: 'pl', status: 'later' as const, reason: 'EEA Central Europe' },
	{ code: 'tr', status: 'later' as const, reason: 'Regional growth' },
	{ code: 'id', status: 'later' as const, reason: 'SEA growth' },
	{ code: 'hi', status: 'later' as const, reason: 'India growth' },
	{ code: 'ja', status: 'later' as const, reason: 'Japan' },
	{ code: 'ko', status: 'later' as const, reason: 'Korea' },
	{ code: 'zh-Hans', status: 'later' as const, reason: 'Only if store strategy includes CN/HK/TW carefully' },
]

/** True when Google AdMob (direct or mediated) would trigger Google CMP rules. */
export function googleAdsCmpRequiredForJurisdiction(
	jurisdiction: PrivacyJurisdiction,
): boolean {
	return REGIONAL_CONSENT_MATRIX[jurisdiction]
		.requiresGoogleCertifiedCmpForGoogleAds
}
