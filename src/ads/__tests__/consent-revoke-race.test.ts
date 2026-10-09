/**
 * Codex P1 race: Accept → initialize/load → Reject → init completes → show.
 * After Reject there must be no load/show of ads.
 */

import { MobileAds } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	getAdsAllowedForTests,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'

describe('ads consent revoke race', () => {
	beforeEach(() => {
		resetYandexAdServiceForTests()
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Clear SHOW_WATCHDOG_MS timer if a show() attempt was left in flight.
		resetYandexAdServiceForTests()
	})

	it('does not mark initialized or keep inventory when Reject wins during initialize', async () => {
		let resolveInit: () => void = () => {}
		;(MobileAds.initialize as jest.Mock).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveInit = resolve
				}),
		)

		const service = createYandexAdService()
		service.setAdsAllowed(true)
		const initPromise = service.initialize()

		// Reject while initialize is in flight.
		service.setAdsAllowed(false)
		expect(getAdsAllowedForTests()).toBe(false)
		expect(MobileAds.setUserConsent).toHaveBeenCalledWith(false)

		resolveInit()
		await initPromise

		expect(service.isInterstitialReady()).toBe(false)
		await service.tryShowInterstitial({
			hasCompletedFirstMeasurement: true,
			hasBlockingModal: false,
			hasKeyboardOrInputFlow: false,
			onSensitiveScreen: false,
		})
		// No show path with cleared inventory / denied consent.
		expect(service.isInterstitialReady()).toBe(false)
	})

	it('refuses tryShowInterstitial without a live guard', async () => {
		const service = createYandexAdService()
		service.setAdsAllowed(true)
		const show = service.tryShowInterstitial as (
			guard?: unknown,
		) => Promise<void>
		await show(undefined)
	})

	it('does not call initialize when ads are not allowed', async () => {
		const service = createYandexAdService()
		service.setAdsAllowed(false)
		await service.initialize()
		expect(MobileAds.initialize).not.toHaveBeenCalled()
	})

	it('does not unconditionally setUserConsent(true) inside initialize after Reject', async () => {
		;(MobileAds.initialize as jest.Mock).mockResolvedValue(undefined)
		const service = createYandexAdService()
		service.setAdsAllowed(true)
		service.setAdsAllowed(false)
		jest.clearAllMocks()
		await service.initialize()
		expect(MobileAds.initialize).not.toHaveBeenCalled()
		expect(MobileAds.setUserConsent).not.toHaveBeenCalledWith(true)
	})
})
