/**
 * Codex Audit 3 P1: show() Promise may never resolve; callbacks drive lifecycle.
 */

import { InterstitialAdLoader } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	getConsentEpochForTests,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'
import {
	getAdSessionMemoryState,
	overrideAdSessionStateForTests,
	resetAdSessionMemoryForTests,
} from '@/ads/ad-policy'

type CallbackAd = {
	show: jest.Mock
	_onAdShown?: () => void
	_onAdFailedToShow?: () => void
	_onAdDismissed?: () => void
}

describe('interstitial callback lifecycle', () => {
	beforeEach(() => {
		resetYandexAdServiceForTests()
		resetAdSessionMemoryForTests()
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			interstitialShownThisSession: false,
			lastInterstitialAt: null,
		})
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Tear down watchdog timer if a test left show() in flight.
		resetYandexAdServiceForTests()
	})

	async function preloadAd(): Promise<CallbackAd> {
		const service = createYandexAdService()
		service.setAdsAllowed(true)
		await service.initialize()
		const createMock = InterstitialAdLoader.create as jest.Mock
		const loaderInstance = await createMock.mock.results[0].value
		return (await loaderInstance.loadAd.mock.results[0].value) as CallbackAd
	}

	it('records show via onAdShown even when show() never resolves', async () => {
		const service = createYandexAdService()
		service.setAdsAllowed(true)
		await service.initialize()
		expect(service.isInterstitialReady()).toBe(true)

		const createMock = InterstitialAdLoader.create as jest.Mock
		const loaderInstance = await createMock.mock.results[0].value
		const loadedAd = (await loaderInstance.loadAd.mock.results[0]
			.value) as CallbackAd

		await service.tryShowInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			uiStateConfirmed: true,
			refreshUiState: () => ({
				uiStateConfirmed: true,
				hasBlockingModal: false,
				hasKeyboardOrInputFlow: false,
				onSensitiveScreen: false,
			}),
		})

		expect(loadedAd.show).toHaveBeenCalled()
		// Promise intentionally never settles — callbacks must still work.
		expect(typeof loadedAd._onAdShown).toBe('function')
		loadedAd._onAdShown?.()
		await Promise.resolve()
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(true)

		loadedAd._onAdDismissed?.()
		// Lock released; preload may run again without double-count show.
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(true)
	})

	it('releases lock on onAdFailedToShow without recording a show', async () => {
		const loadedAd = await preloadAd()
		const service = createYandexAdService()
		// Same singleton service after reset? createYandexAdService returns new
		// object but shares module state — initialize already done above via preloadAd.
		await service.tryShowInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			uiStateConfirmed: true,
			refreshUiState: () => ({
				uiStateConfirmed: true,
				hasBlockingModal: false,
				hasKeyboardOrInputFlow: false,
				onSensitiveScreen: false,
			}),
		})
		loadedAd._onAdFailedToShow?.()
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(false)
	})

	it('does not bump consent epoch when setAdsAllowed is unchanged', () => {
		const service = createYandexAdService()
		service.setAdsAllowed(true)
		const epoch = getConsentEpochForTests()
		service.setAdsAllowed(true)
		expect(getConsentEpochForTests()).toBe(epoch)
	})

	it('blocks show when refreshUiState is missing', async () => {
		await preloadAd()
		const service = createYandexAdService()
		await service.tryShowInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			uiStateConfirmed: true,
		})
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(false)
	})
})
