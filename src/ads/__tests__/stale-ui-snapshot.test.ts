/**
 * Fresh UI refresh is mandatory before native interstitial show().
 */

import { InterstitialAdLoader } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'
import {
	overrideAdSessionStateForTests,
	resetAdSessionMemoryForTests,
} from '@/ads/ad-policy'
import {
	getLiveInterstitialUiState,
	reportNavigationPathname,
	resetUiSafetyGateForTests,
	setGraphsScreenFocused,
	setKeyboardStateForTests,
} from '@/ads/ui-safety-gate'

type CallbackAd = {
	show: jest.Mock
}

const baseGuard = {
	hasCompletedFirstMeasurement: true,
	hasBlockingModal: false,
	hasKeyboardOrInputFlow: false,
	onSensitiveScreen: false,
	uiStateConfirmed: true as const,
}

async function loadReadyAd() {
	const service = createYandexAdService()
	service.setAdsAllowed(true)
	await service.initialize()
	const createMock = InterstitialAdLoader.create as jest.Mock
	const loaderInstance = await createMock.mock.results[0].value
	const ad = (await loaderInstance.loadAd.mock.results[0].value) as CallbackAd
	return { service, ad }
}

describe('mandatory fresh UI snapshot before interstitial show', () => {
	beforeEach(() => {
		resetYandexAdServiceForTests()
		resetAdSessionMemoryForTests()
		resetUiSafetyGateForTests()
		overrideAdSessionStateForTests({
			meaningfulActionCount: 5,
			interstitialShownThisSession: false,
			lastInterstitialAt: null,
		})
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Clear SHOW_WATCHDOG_MS timer left by tests that call show() without dismiss.
		resetYandexAdServiceForTests()
	})

	it('A: safe snapshot → route change → no refresh callback → show blocked', async () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		reportNavigationPathname('/graphs')
		const safe = getLiveInterstitialUiState('/graphs')
		expect(safe.uiStateConfirmed).toBe(true)

		const { service, ad } = await loadReadyAd()
		reportNavigationPathname('/settings')
		setGraphsScreenFocused(false)

		await service.tryShowInterstitial({
			...baseGuard,
			uiStateConfirmed: safe.uiStateConfirmed,
			// intentionally omit refreshUiState
		})

		expect(ad.show).not.toHaveBeenCalled()
	})

	it('B: safe snapshot → route change → refresh returns unsafe → show blocked', async () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		reportNavigationPathname('/graphs')
		const safe = getLiveInterstitialUiState('/graphs')
		expect(safe.uiStateConfirmed).toBe(true)

		const { service, ad } = await loadReadyAd()
		reportNavigationPathname('/settings')
		setGraphsScreenFocused(false)

		await service.tryShowInterstitial({
			...baseGuard,
			uiStateConfirmed: safe.uiStateConfirmed,
			refreshUiState: () => {
				const live = getLiveInterstitialUiState()
				return {
					uiStateConfirmed: live.uiStateConfirmed,
					hasBlockingModal: live.hasBlockingModal,
					hasKeyboardOrInputFlow: live.hasKeyboardOrInputFlow,
					onSensitiveScreen: live.onSensitiveScreen,
				}
			},
		})

		expect(ad.show).not.toHaveBeenCalled()
	})

	it('C: refresh callback throws → show blocked', async () => {
		const { service, ad } = await loadReadyAd()
		await service.tryShowInterstitial({
			...baseGuard,
			refreshUiState: () => {
				throw new Error('ui_probe_failed')
			},
		})
		expect(ad.show).not.toHaveBeenCalled()
	})

	it('D: focused Graphs + confirmed safe refresh → show allowed', async () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		reportNavigationPathname('/graphs')
		expect(getLiveInterstitialUiState().uiStateConfirmed).toBe(true)

		const { service, ad } = await loadReadyAd()
		await service.tryShowInterstitial({
			...baseGuard,
			refreshUiState: () => {
				const live = getLiveInterstitialUiState()
				return {
					uiStateConfirmed: live.uiStateConfirmed,
					hasBlockingModal: live.hasBlockingModal,
					hasKeyboardOrInputFlow: live.hasKeyboardOrInputFlow,
					onSensitiveScreen: live.onSensitiveScreen,
				}
			},
		})

		expect(ad.show).toHaveBeenCalled()
	})
})
