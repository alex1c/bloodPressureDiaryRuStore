import { InterstitialAdLoader } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	getActiveShowAttemptIdForTests,
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

async function loadReadyAd(): Promise<{
	service: ReturnType<typeof createYandexAdService>
	ad: CallbackAd
}> {
	const service = createYandexAdService()
	service.setAdsAllowed(true)
	await service.initialize()
	const createMock = InterstitialAdLoader.create as jest.Mock
	const loaderInstance = await createMock.mock.results[0].value
	const ad = (await loaderInstance.loadAd.mock.results[0].value) as CallbackAd
	return { service, ad }
}

const safeGuard = {
	hasCompletedFirstMeasurement: true,
	hasBlockingModal: false,
	hasKeyboardOrInputFlow: false,
	onSensitiveScreen: false,
	uiStateConfirmed: true as const,
	refreshUiState: () => ({
		uiStateConfirmed: true,
		hasBlockingModal: false,
		hasKeyboardOrInputFlow: false,
		onSensitiveScreen: false,
	}),
}

describe('interstitial attempt ids', () => {
	beforeEach(() => {
		resetYandexAdServiceForTests()
		resetAdSessionMemoryForTests()
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			interstitialShownThisSession: false,
			lastInterstitialAt: null,
		})
		jest.clearAllMocks()
		jest.useFakeTimers()
	})

	afterEach(() => {
		resetYandexAdServiceForTests()
		jest.useRealTimers()
	})

	it('ignores late onAdShown from attempt A after attempt B started', async () => {
		const { service, ad: adA } = await loadReadyAd()
		await service.tryShowInterstitial(safeGuard)
		const attemptA = getActiveShowAttemptIdForTests()
		expect(attemptA).not.toBeNull()

		// Simulate dismiss finishing A without shown, then a new inventory load.
		adA._onAdFailedToShow?.()

		// Prepare B
		resetAdSessionMemoryForTests()
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			interstitialShownThisSession: false,
			lastInterstitialAt: null,
		})
		await service.preloadInterstitial()
		const createMock = InterstitialAdLoader.create as jest.Mock
		const loaderInstance = await createMock.mock.results[0].value
		const adB = (await loaderInstance.loadAd.mock.results[
			loaderInstance.loadAd.mock.results.length - 1
		].value) as CallbackAd

		await service.tryShowInterstitial(safeGuard)
		const attemptB = getActiveShowAttemptIdForTests()
		expect(attemptB).not.toBe(attemptA)

		// Late callback from A must not finish B or double-count incorrectly.
		adA._onAdShown?.()
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(false)

		adB._onAdShown?.()
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(true)
		adB._onAdDismissed?.()
	})

	it('records onAdShown after Reject (show already started) for cooldown', async () => {
		const { service, ad } = await loadReadyAd()
		await service.tryShowInterstitial(safeGuard)
		service.setAdsAllowed(false)
		ad._onAdShown?.()
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(true)
		ad._onAdDismissed?.()
	})

	it('watchdog consumes session slot when callbacks never arrive', async () => {
		const { service } = await loadReadyAd()
		await service.tryShowInterstitial(safeGuard)
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(false)
		jest.advanceTimersByTime(16_000)
		expect(getAdSessionMemoryState().interstitialShownThisSession).toBe(true)
	})

	it('blocks when refreshUiState reports unconfirmed', async () => {
		const { service } = await loadReadyAd()
		await service.tryShowInterstitial({
			...safeGuard,
			refreshUiState: () => ({
				uiStateConfirmed: false,
				hasBlockingModal: false,
				hasKeyboardOrInputFlow: false,
				onSensitiveScreen: false,
			}),
		})
		expect(getActiveShowAttemptIdForTests()).toBeNull()
	})
})
