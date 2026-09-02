import type { BannerPlacement } from '@/config/ads'
import type { InterstitialEligibilityInput } from './ad-policy'
import { evaluateInterstitialEligibility } from './ad-policy'

/** No-op ad service used in tests and before production wiring. */
export function createNoopAdService() {
	return {
		async initialize() {
			/* noop */
		},
		async preloadInterstitial() {
			/* noop */
		},
		canShowAds(context: { hasCompletedFirstMeasurement: boolean }) {
			return context.hasCompletedFirstMeasurement === true
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
		maybeShowGraphsInterstitial(_input: {
			hasCompletedFirstMeasurement: boolean
		}) {
			/* noop */
		},
		async tryShowInterstitial() {
			/* noop */
		},
	}
}
