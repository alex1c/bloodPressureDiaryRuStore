/**
 * Yandex Mobile Ads production block IDs for «Дневник давления».
 * Dev/debug builds resolve to official Yandex demo units — never production impressions.
 */
export const yandexAdsProduction = {
	diaryBanner: 'R-M-20056373-1',
	graphsBanner: 'R-M-20056373-2',
	healthBanner: 'R-M-20056373-3',
	interstitial: 'R-M-20056373-4',
	/** Main Medications tab — shown even before first BP measurement. */
	medicationsBanner: 'R-M-20056373-5',
} as const

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
	typeof yandexAdsProduction,
	'diaryBanner' | 'graphsBanner' | 'healthBanner' | 'medicationsBanner'
>

export type AdRuntimeVariant = 'production' | 'development'

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

/** Maps symbolic banner placement to the configured block id for the runtime variant. */
export function resolveBannerAdUnitId(
	placement: BannerPlacement,
	variant: AdRuntimeVariant,
): string {
	if (variant === 'development') {
		return yandexAdsTest.banner
	}
	return yandexAdsProduction[placement]
}

/** Resolves interstitial block id for the runtime variant. */
export function resolveInterstitialAdUnitId(variant: AdRuntimeVariant): string {
	if (variant === 'development') {
		return yandexAdsTest.interstitial
	}
	return yandexAdsProduction.interstitial
}
