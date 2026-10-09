/**
 * Yandex Mobile Ads block IDs for «Дневник давления».
 *
 * RuStore and Google Play use SEPARATE Yandex app placements.
 * Never cross-wire store IDs. Dev/debug builds resolve to official Yandex
 * demo units — never production impressions.
 */

import type { StoreId } from './store'

/** RuStore placement 20056373 — keep unchanged. */
export const yandexAdsRustoreProduction = {
	diaryBanner: 'R-M-20056373-1',
	graphsBanner: 'R-M-20056373-2',
	healthBanner: 'R-M-20056373-3',
	/** Interstitial is block №4 on RuStore. */
	interstitial: 'R-M-20056373-4',
	/** Main Medications tab — shown even before first BP measurement. */
	medicationsBanner: 'R-M-20056373-5',
} as const

/**
 * Google Play placement 20201011 («Дневник давления Google play»).
 * Note: Medications is block №4; interstitial is block №5 (unlike RuStore).
 */
export const yandexAdsGooglePlayProduction = {
	diaryBanner: 'R-M-20201011-1',
	graphsBanner: 'R-M-20201011-2',
	healthBanner: 'R-M-20201011-3',
	medicationsBanner: 'R-M-20201011-4',
	interstitial: 'R-M-20201011-5',
} as const

export type YandexProductionAdUnits =
	| typeof yandexAdsRustoreProduction
	| typeof yandexAdsGooglePlayProduction

/**
 * @deprecated Prefer {@link yandexAdsRustoreProduction} or
 * {@link resolveProductionAdUnits}. Kept as RuStore alias for older tests.
 */
export const yandexAdsProduction = yandexAdsRustoreProduction

/** Official Yandex demo ad units for development and automated smoke. */
export const yandexAdsTest = {
	banner: 'demo-banner-yandex',
	interstitial: 'demo-interstitial-yandex',
} as const

/** Yandex demo / placeholder IDs that must never ship in production builds. */
export const YANDEX_DEMO_AD_ID_MARKERS = [
	'demo-banner-yandex',
	'demo-interstitial-yandex',
	'R-M-DEMO',
] as const

export type BannerPlacement = keyof Pick<
	typeof yandexAdsRustoreProduction,
	'diaryBanner' | 'graphsBanner' | 'healthBanner' | 'medicationsBanner'
>

export type AdRuntimeVariant = 'production' | 'development'

/** Production ad unit map for the given store channel (exhaustive). */
export function resolveProductionAdUnits(
	storeId: StoreId,
): YandexProductionAdUnits {
	switch (storeId) {
		case 'googleplay':
			return yandexAdsGooglePlayProduction
		case 'rustore':
			return yandexAdsRustoreProduction
		default: {
			const _exhaustive: never = storeId
			throw new Error(`Unknown storeId for ads: ${String(_exhaustive)}`)
		}
	}
}

/**
 * Resolves whether release-like ad IDs should be used.
 * Production prebuild sets APP_VARIANT=production; release JS bundles also treat
 * `!__DEV__` as production so demo units never ship in release APKs.
 */
export function resolveAdRuntimeVariant(
	appVariant: string | undefined,
	isDev: boolean = __DEV__,
): AdRuntimeVariant {
	if (appVariant === 'production' || !isDev) {
		return 'production'
	}
	return 'development'
}

/**
 * Maps symbolic banner placement to the configured block id for the runtime.
 * Production requires an explicit storeId — never defaults to RuStore.
 */
export function resolveBannerAdUnitId(
	placement: BannerPlacement,
	variant: AdRuntimeVariant,
	storeId?: StoreId,
): string {
	if (variant === 'development') {
		return yandexAdsTest.banner
	}
	if (!storeId) {
		throw new Error(
			'resolveBannerAdUnitId requires an explicit storeId in production',
		)
	}
	return resolveProductionAdUnits(storeId)[placement]
}

/**
 * Resolves interstitial block id for the runtime variant + store.
 * Production requires an explicit storeId — never defaults to RuStore.
 */
export function resolveInterstitialAdUnitId(
	variant: AdRuntimeVariant,
	storeId?: StoreId,
): string {
	if (variant === 'development') {
		return yandexAdsTest.interstitial
	}
	if (!storeId) {
		throw new Error(
			'resolveInterstitialAdUnitId requires an explicit storeId in production',
		)
	}
	return resolveProductionAdUnits(storeId).interstitial
}
