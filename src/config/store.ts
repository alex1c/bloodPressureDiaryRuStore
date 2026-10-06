/**
 * Multi-store configuration for RuStore and Google Play builds.
 *
 * Resolved once from APP_STORE (build-time). UI must consume this module
 * instead of scattering store === '…' checks.
 */

export type StoreId = 'rustore' | 'googleplay'

export type StoreConfig = {
	storeId: StoreId
	storeName: string
	/** Public catalog / listing URL for the published package. */
	appUrl: string
	/** Same as appUrl for PDF footer CTA (kept explicit for future divergence). */
	pdfAppUrl: string
	/** Localized-neutral fallback label; UI/PDF may override via i18n. */
	pdfDownloadLabel: string
	/** Developer / “other apps” page when used. */
	developerUrl: string | null
	otherAppsUrl: string | null
	/** In-store rate/review deep link when used. */
	rateUrl: string | null
	supportEmail: string
	privacyPolicyUrl: string
}

export const ANDROID_PACKAGE_ID = 'com.calculatorplatform.bpdiary'

const RUSTORE_APP_URL =
	`https://www.rustore.ru/catalog/app/${ANDROID_PACKAGE_ID}` as const

const GOOGLE_PLAY_APP_URL =
	`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}` as const

const SHARED_SUPPORT = {
	supportEmail: 'rustore-alex1c@yandex.ru',
	privacyPolicyUrl:
		'https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html',
} as const

/** Canonical store configs — single source of truth for URLs and metadata. */
export const STORE_CONFIGS: Record<StoreId, StoreConfig> = {
	rustore: {
		storeId: 'rustore',
		storeName: 'RuStore',
		appUrl: RUSTORE_APP_URL,
		pdfAppUrl: RUSTORE_APP_URL,
		pdfDownloadLabel: 'Скачать в RuStore',
		developerUrl: null,
		otherAppsUrl: null,
		rateUrl: null,
		...SHARED_SUPPORT,
	},
	googleplay: {
		storeId: 'googleplay',
		storeName: 'Google Play',
		appUrl: GOOGLE_PLAY_APP_URL,
		pdfAppUrl: GOOGLE_PLAY_APP_URL,
		pdfDownloadLabel: 'Get it on Google Play',
		developerUrl: null,
		otherAppsUrl: null,
		rateUrl: GOOGLE_PLAY_APP_URL,
		...SHARED_SUPPORT,
	},
}

export type ResolveStoreIdOptions = {
	/**
	 * When true (production release), missing/invalid APP_STORE fails loudly.
	 * Development may fall back to the documented default.
	 */
	requireExplicit?: boolean
	/** Documented development default when APP_STORE is unset. */
	developmentDefault?: StoreId
}

/**
 * Resolves APP_STORE into a StoreId.
 * Production releases must set APP_STORE=rustore|googleplay explicitly.
 */
export function resolveStoreId(
	raw: string | undefined,
	options: ResolveStoreIdOptions = {},
): StoreId {
	const requireExplicit = options.requireExplicit === true
	const developmentDefault = options.developmentDefault ?? 'rustore'
	const trimmed = raw?.trim().toLowerCase()

	if (trimmed === 'rustore' || trimmed === 'googleplay') {
		return trimmed
	}

	if (requireExplicit) {
		throw new Error(
			`APP_STORE must be "rustore" or "googleplay" for production (got: ${JSON.stringify(raw ?? '')})`,
		)
	}

	if (trimmed === undefined || trimmed === '') {
		return developmentDefault
	}

	throw new Error(
		`Invalid APP_STORE value: ${JSON.stringify(raw)}. Expected "rustore" or "googleplay".`,
	)
}

/** Returns the full store config for a StoreId. */
export function getStoreConfig(storeId: StoreId): StoreConfig {
	return STORE_CONFIGS[storeId]
}

/**
 * Resolves store config from an env-like APP_STORE value.
 * Use requireExplicit=true for production release validation/builds.
 */
export function resolveStoreConfig(
	raw: string | undefined,
	options?: ResolveStoreIdOptions,
): StoreConfig {
	return getStoreConfig(resolveStoreId(raw, options))
}

/** True when the URL belongs to the RuStore catalog host. */
export function isRustoreAppUrl(url: string): boolean {
	return url.includes('rustore.ru/catalog/app/')
}

/** True when the URL is a Google Play listing for our package. */
export function isGooglePlayAppUrl(url: string): boolean {
	return (
		url.includes('play.google.com/store/apps/details') &&
		url.includes(`id=${ANDROID_PACKAGE_ID}`)
	)
}
