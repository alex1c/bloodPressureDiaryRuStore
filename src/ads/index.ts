/**
 * Ads seam for future Yandex Mobile Ads (Phase 9).
 * Policy hooks: never show before first measurement / during entry.
 */
export interface AdService {
	initialize(): Promise<void>
	preloadBanner(): Promise<void>
	/** Interstitial intentionally unused for measurement flows. */
	preloadInterstitial(): Promise<void>
	canShowAds(context: { hasCompletedFirstMeasurement: boolean }): boolean
}

export function createNoopAdService(): AdService {
	return {
		async initialize() {
			/* Phase 9 */
		},
		async preloadBanner() {
			/* Phase 9 */
		},
		async preloadInterstitial() {
			/* Phase 9 */
		},
		canShowAds(context) {
			return context.hasCompletedFirstMeasurement === true
		},
	}
}

let adService: AdService = createNoopAdService()

export function getAdService(): AdService {
	return adService
}

export function setAdService(service: AdService): void {
	adService = service
}
