import { createNoopAdService } from './noop-ad-service'
import {
	createYandexAdService,
	type InterstitialShowGuard,
} from './yandex-ad-service'
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
	maybeShowGraphsInterstitial(input: InterstitialShowGuard): void
	/** Guard is mandatory for production ad service. */
	tryShowInterstitial(guard: InterstitialShowGuard): Promise<void>
	/** Live consent revoke — optional on noop. */
	setAdsAllowed?(allowed: boolean): void
	isAdsAllowed?(): boolean
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
	recordMeaningfulAdAction,
	resetAdSessionMemoryForTests,
	shouldTriggerGraphsInterstitial,
} from './ad-policy'
export {
	clearPersistedAdSessionStateForTests,
	readPersistedAdSessionState,
} from './ad-session-persistence'
export {
	createYandexAdService,
	resetYandexAdServiceForTests,
	getAdsAllowedForTests,
	getConsentEpochForTests,
} from './yandex-ad-service'
export type { InterstitialShowGuard } from './yandex-ad-service'
