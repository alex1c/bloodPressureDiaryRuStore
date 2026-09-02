import Constants from 'expo-constants'
import { MobileAds, InterstitialAdLoader } from 'yandex-mobile-ads'
import type { InterstitialAd } from 'yandex-mobile-ads'
import {
	resolveAdRuntimeVariant,
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
	type BannerPlacement,
} from '@/config/ads'
import {
	beginAdSessionOnce,
	evaluateInterstitialEligibility,
	markInterstitialShown,
	shouldTriggerGraphsInterstitial,
	type InterstitialEligibilityInput,
} from './ad-policy'

let initialized = false
let interstitialReady = false
let interstitialAd: InterstitialAd | null = null
let interstitialLoader: InterstitialAdLoader | null = null

function runtimeVariant() {
	return resolveAdRuntimeVariant(
		Constants.expoConfig?.extra?.appVariant as string | undefined,
	)
}

/** Resets Yandex ad service singleton state for tests. */
export function resetYandexAdServiceForTests(): void {
	initialized = false
	interstitialReady = false
	interstitialAd = null
	interstitialLoader = null
}

async function preloadInterstitialInternal(): Promise<void> {
	if (!initialized) {
		return
	}

	try {
		interstitialLoader ??= await InterstitialAdLoader.create()
		interstitialAd = await interstitialLoader.loadAd({
			adUnitId: resolveInterstitialAdUnitId(runtimeVariant()),
		})
		interstitialReady = Boolean(interstitialAd)
	} catch (error) {
		interstitialReady = false
		interstitialAd = null
		if (__DEV__) {
			console.warn('[ads] interstitial preload failed', error)
		}
	}
}

export function createYandexAdService() {
	return {
		async initialize() {
			if (initialized) {
				return
			}

			try {
				await MobileAds.initialize()
				initialized = true
				await beginAdSessionOnce()
				void preloadInterstitialInternal()
			} catch (error) {
				if (__DEV__) {
					console.warn('[ads] MobileAds.initialize failed', error)
				}
			}
		},

		async preloadInterstitial() {
			await preloadInterstitialInternal()
		},

		canShowAds(context: { hasCompletedFirstMeasurement: boolean }) {
			return context.hasCompletedFirstMeasurement === true
		},

		getBannerAdUnitId(placement: BannerPlacement) {
			return resolveBannerAdUnitId(placement, runtimeVariant())
		},

		isInterstitialReady() {
			return interstitialReady
		},

		evaluateInterstitial(input: Omit<InterstitialEligibilityInput, 'interstitialReady'>) {
			return evaluateInterstitialEligibility({
				...input,
				interstitialReady,
			})
		},

		/** Fire-and-forget graphs trigger after a meaningful period change. */
		maybeShowGraphsInterstitial(input: {
			hasCompletedFirstMeasurement: boolean
			hasBlockingModal?: boolean
			hasKeyboardOrInputFlow?: boolean
		}) {
			const policy = evaluateInterstitialEligibility({
				hasCompletedFirstMeasurement: input.hasCompletedFirstMeasurement,
				hasBlockingModal: input.hasBlockingModal ?? false,
				hasKeyboardOrInputFlow: input.hasKeyboardOrInputFlow ?? false,
				onSensitiveScreen: false,
				interstitialReady,
			})

			if (!shouldTriggerGraphsInterstitial(policy)) {
				return
			}

			void this.tryShowInterstitial()
		},

		async tryShowInterstitial() {
			if (!interstitialReady || !interstitialAd) {
				return
			}

			try {
				await interstitialAd.show()
				interstitialReady = false
				interstitialAd = null
				await markInterstitialShown()
				void preloadInterstitialInternal()
			} catch (error) {
				interstitialReady = false
				interstitialAd = null
				if (__DEV__) {
					console.warn('[ads] interstitial show failed', error)
				}
				void preloadInterstitialInternal()
			}
		},
	}
}

export type YandexAdService = ReturnType<typeof createYandexAdService>
