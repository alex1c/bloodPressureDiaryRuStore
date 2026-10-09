import type { BannerPlacement } from '@/config/ads'
import type { InterstitialEligibilityInput } from './ad-policy'
import { evaluateInterstitialEligibility } from './ad-policy'
import type { InterstitialShowGuard } from './yandex-ad-service'

/** No-op ad service used in tests and before production wiring. */
export function createNoopAdService() {
	let allowed = true
	return {
		async initialize() {
			/* noop */
		},
		async preloadInterstitial() {
			/* noop */
		},
		canShowAds(context: { hasCompletedFirstMeasurement: boolean }) {
			return allowed && context.hasCompletedFirstMeasurement === true
		},
		getBannerAdUnitId(_placement: BannerPlacement) {
			return 'demo-banner-yandex'
		},
		isInterstitialReady() {
			return false
		},
		evaluateInterstitial(
			input: Omit<InterstitialEligibilityInput, 'interstitialReady'>,
		) {
			return evaluateInterstitialEligibility({
				...input,
				interstitialReady: false,
			})
		},
		maybeShowGraphsInterstitial(_input: InterstitialShowGuard) {
			/* noop */
		},
		async tryShowInterstitial(_guard: InterstitialShowGuard) {
			/* noop */
		},
		setAdsAllowed(next: boolean) {
			allowed = next
		},
		isAdsAllowed() {
			return allowed
		},
	}
}
