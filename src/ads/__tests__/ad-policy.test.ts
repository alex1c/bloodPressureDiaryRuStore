import {
	adPolicyConstants,
	evaluateInterstitialEligibility,
	getAdSessionMemoryState,
	markOpenedFromMedicationNotification,
	overrideAdSessionStateForTests,
	recordGraphsFocus,
	recordGraphsPeriodChange,
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

	it('blocks interstitial before session 4', () => {
		overrideAdSessionStateForTests({ sessionCount: 3 })
		const result = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		expect(result.eligible).toBe(false)
		expect(result.reason).toBe('session_count')
	})

	it('allows interstitial when session gate and cooldown pass', () => {
		overrideAdSessionStateForTests({
			sessionCount: adPolicyConstants.MIN_SESSIONS_FOR_INTERSTITIAL,
			lastInterstitialAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
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
			sessionCount: 5,
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

	it('blocks interstitial within 24h cooldown', () => {
		overrideAdSessionStateForTests({
			sessionCount: 5,
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
		overrideAdSessionStateForTests({ sessionCount: 5 })
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

	it('requires repeated graphs focus before period-change trigger', () => {
		overrideAdSessionStateForTests({ sessionCount: 5 })
		const policy = evaluateInterstitialEligibility({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			interstitialReady: true,
		})
		recordGraphsFocus()
		recordGraphsPeriodChange()
		expect(shouldTriggerGraphsInterstitial(policy)).toBe(false)

		recordGraphsFocus()
		expect(shouldTriggerGraphsInterstitial(policy)).toBe(true)
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
		expect(resolveInterstitialAdUnitId('production')).toBe(
			yandexAdsProduction.interstitial,
		)
	})

	it('uses demo ids in development runtime', () => {
		expect(resolveBannerAdUnitId('diaryBanner', 'development')).toBe(
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
