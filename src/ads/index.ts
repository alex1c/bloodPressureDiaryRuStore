import { createNoopAdService } from './noop-ad-service'
import { createYandexAdService } from './yandex-ad-service'
import type { BannerPlacement } from '@/config/ads'
import type { InterstitialEligibilityInput } from './ad-policy'

export interface AdService {
	initialize(): Promise<void>
	preloadInterstitial(): Promise<void>
	canShowAds(context: { hasCompletedFirstMeasurement: boolean }): boolean
	getBannerAdUnitId(placement: BannerPlacement): string
	isInterstitialReady(): boolean
	evaluateInterstitial(
		input: Omit<InterstitialEligibilityInput, 'interstitialReady'>,
	): ReturnType<ReturnType<typeof createYandexAdService>['evaluateInterstitial']>
	maybeShowGraphsInterstitial(input: {
		hasCompletedFirstMeasurement: boolean
		hasBlockingModal?: boolean
		hasKeyboardOrInputFlow?: boolean
	}): void
	tryShowInterstitial(): Promise<void>
}

let adService: AdService = createNoopAdService()

export function getAdService(): AdService {
	return adService
}

export function setAdService(service: AdService): void {
	adService = service
}

/** Installs Yandex Mobile Ads adapter for release-like builds. */
export function installProductionAdService(): void {
	setAdService(createYandexAdService())
}

export {
	adPolicyConstants,
	evaluateInterstitialEligibility,
	getAdSessionMemoryState,
	markOpenedFromMedicationNotification,
	markInterstitialShown,
	overrideAdSessionStateForTests,
	recordGraphsFocus,
	recordGraphsPeriodChange,
	resetAdSessionMemoryForTests,
	shouldTriggerGraphsInterstitial,
} from './ad-policy'
export {
	clearPersistedAdSessionStateForTests,
	readPersistedAdSessionState,
} from './ad-session-persistence'
