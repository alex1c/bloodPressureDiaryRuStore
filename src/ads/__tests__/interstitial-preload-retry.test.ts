/**
 * When Graphs trigger would fire but inventory is missing, retry preload.
 * Do not relax meaningful-action / cooldown / consent gates.
 */

import { InterstitialAdLoader } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'
import {
	overrideAdSessionStateForTests,
	recordGraphsPeriodChange,
	resetAdSessionMemoryForTests,
} from '@/ads/ad-policy'

const refreshUiState = () => ({
	uiStateConfirmed: true as const,
	hasBlockingModal: false,
	hasKeyboardOrInputFlow: false,
	onSensitiveScreen: false,
})

async function initWithNoFillLoader() {
	const loadAd = jest.fn(async () => {
		throw new Error('nofill')
	})
	const createMock = InterstitialAdLoader.create as jest.Mock
	createMock.mockResolvedValueOnce({ loadAd })
	const service = createYandexAdService()
	service.setAdsAllowed(true)
	await service.initialize()
	expect(service.isInterstitialReady()).toBe(false)
	return { service, loadAd }
}

describe('interstitial preload retry on not_ready', () => {
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
		resetYandexAdServiceForTests()
	})

	it('retries preload when other gates pass but interstitial is not ready', async () => {
		const { service, loadAd } = await initWithNoFillLoader()
		const loadsBefore = loadAd.mock.calls.length
		expect(loadsBefore).toBe(1)

		recordGraphsPeriodChange()
		service.maybeShowGraphsInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			refreshUiState,
		})
		await new Promise((r) => setTimeout(r, 0))
		await new Promise((r) => setTimeout(r, 0))

		expect(loadAd.mock.calls.length).toBeGreaterThan(loadsBefore)
	})

	it('does not retry preload when meaningful_actions gate fails', async () => {
		overrideAdSessionStateForTests({
			meaningfulActionCount: 2,
			interstitialShownThisSession: false,
			lastInterstitialAt: null,
		})
		const { service, loadAd } = await initWithNoFillLoader()
		const loadsBefore = loadAd.mock.calls.length

		recordGraphsPeriodChange()
		service.maybeShowGraphsInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
			refreshUiState,
		})
		await new Promise((r) => setTimeout(r, 0))

		expect(loadAd.mock.calls.length).toBe(loadsBefore)
	})
})
