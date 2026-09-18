import {
	adPolicyConstants,
	evaluateInterstitialEligibility,
	getAdSessionMemoryState,
	markOpenedFromMedicationNotification,
	overrideAdSessionStateForTests,
	recordGraphsFocus,
	recordGraphsPeriodChange,
	recordMeaningfulAdAction,
	resetAdSessionMemoryForTests,
	shouldTriggerGraphsInterstitial,
} from '@/ads/ad-policy'
import {
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
	yandexAdsProduction,
} from '@/config/ads'

describe('ad policy', () => {
	beforeEach(() => {
		resetAdSessionMemoryForTests()
	})

	it('blocks interstitial before enough meaningful actions', () => {
		overrideAdSessionStateForTests({ meaningfulActionCount: 4 })
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		expect(result.eligible).toBe(false)
		expect(result.reason).toBe('meaningful_actions')
	})

	it('allows interstitial when action gate and cooldown pass', () => {
		overrideAdSessionStateForTests({
			meaningfulActionCount: adPolicyConstants.MIN_MEANINGFUL_ACTIONS,
			lastInterstitialAt: new Date(
				Date.now() - adPolicyConstants.INTERSTITIAL_COOLDOWN_MS - 1_000,
			).toISOString(),
		})
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		expect(result.eligible).toBe(true)
	})

	it('blocks second interstitial in the same session', () => {
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			interstitialShownThisSession: true,
		})
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		expect(result.reason).toBe('already_shown_session')
	})

	it('blocks interstitial within 5 minute cooldown', () => {
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			lastInterstitialAt: new Date().toISOString(),
		})
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
			now: new Date(),
		})
		expect(result.reason).toBe('cooldown')
	})

	it('blocks interstitial after medication notification open', () => {
		overrideAdSessionStateForTests({ meaningfulActionCount: 5 })
		markOpenedFromMedicationNotification()
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		expect(result.reason).toBe('notification_open')
	})

	it('requires a period change before graphs interstitial trigger', () => {
		overrideAdSessionStateForTests({ meaningfulActionCount: 5 })
		const policy = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		recordGraphsFocus()
		expect(shouldTriggerGraphsInterstitial(policy)).toBe(false)

		recordGraphsPeriodChange()
		expect(shouldTriggerGraphsInterstitial(policy)).toBe(true)
	})

	it('counts recordMeaningfulAdAction toward the gate', () => {
		for (let i = 0; i < adPolicyConstants.MIN_MEANINGFUL_ACTIONS; i += 1) {
			recordMeaningfulAdAction()
		}
		expect(getAdSessionMemoryState().meaningfulActionCount).toBe(
			adPolicyConstants.MIN_MEANINGFUL_ACTIONS,
		)
	})

	it('maps banner placements to production ids in production runtime', () => {
		expect(resolveBannerAdUnitId('diaryBanner', 'production')).toBe(
			yandexAdsProduction.diaryBanner,
		)
		expect(resolveBannerAdUnitId('graphsBanner', 'production')).toBe(
			yandexAdsProduction.graphsBanner,
		)
		expect(resolveBannerAdUnitId('healthBanner', 'production')).toBe(
			yandexAdsProduction.healthBanner,
		)
		expect(resolveBannerAdUnitId('medicationsBanner', 'production')).toBe(
			yandexAdsProduction.medicationsBanner,
		)
		expect(resolveInterstitialAdUnitId('production')).toBe(
			yandexAdsProduction.interstitial,
		)
		expect(yandexAdsProduction.diaryBanner).toBe('R-M-20056373-1')
		expect(yandexAdsProduction.graphsBanner).toBe('R-M-20056373-2')
		expect(yandexAdsProduction.healthBanner).toBe('R-M-20056373-3')
		expect(yandexAdsProduction.interstitial).toBe('R-M-20056373-4')
		expect(yandexAdsProduction.medicationsBanner).toBe('R-M-20056373-5')
	})

	it('uses demo ids in development runtime', () => {
		expect(resolveBannerAdUnitId('diaryBanner', 'development')).toBe(
			'demo-banner-yandex',
		)
		expect(resolveBannerAdUnitId('medicationsBanner', 'development')).toBe(
			'demo-banner-yandex',
		)
		expect(resolveInterstitialAdUnitId('development')).toBe(
			'demo-interstitial-yandex',
		)
	})
})

describe('ad session memory', () => {
	beforeEach(() => {
		resetAdSessionMemoryForTests()
	})

	it('starts with interstitial not shown in session', () => {
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(false)
	})
})
