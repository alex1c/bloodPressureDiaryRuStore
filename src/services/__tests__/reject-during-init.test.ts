/**
 * Accept → delayed ads initialize → Reject → analytics event blocked immediately.
 */

import AppMetrica from '@appmetrica/react-native-analytics'
import { MobileAds } from 'yandex-mobile-ads'
import {
	createYandexAdService,
	getAdsAllowedForTests,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'
import {
	createAppMetricaAnalyticsService,
	getAnalyticsAllowedForTests,
	resetAppMetricaInitializationForTests,
} from '@/analytics/appmetrica-service'
import { setAdService } from '@/ads'
import { setAnalyticsBackend } from '@/analytics/backend'
import {
	resetAppServicesInitializationForTests,
	syncOptionalSdks,
} from '@/services'

describe('Reject during delayed initialization', () => {
	beforeEach(() => {
		resetAppServicesInitializationForTests()
		resetYandexAdServiceForTests()
		resetAppMetricaInitializationForTests()
		jest.clearAllMocks()

		const ads = createYandexAdService()
		setAdService(ads)
		setAnalyticsBackend(createAppMetricaAnalyticsService())
	})

	it('blocks analytics and ads immediately on Reject while initialize awaits', async () => {
		let resolveInit: () => void = () => {}
		;(MobileAds.initialize as jest.Mock).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveInit = resolve
				}),
		)

		const acceptPromise = syncOptionalSdks({
			analyticsAllowed: true,
			adsAllowed: true,
		})

		// Allow Accept start to schedule initialize.
		await Promise.resolve()
		await Promise.resolve()

		// Reject must not wait for initialize to finish.
		const rejectPromise = syncOptionalSdks({
			analyticsAllowed: false,
			adsAllowed: false,
		})
		await rejectPromise

		expect(getAnalyticsAllowedForTests()).toBe(false)
		expect(getAdsAllowedForTests()).toBe(false)

		jest.clearAllMocks()
		const backend = createAppMetricaAnalyticsService()
		// Same singleton flags — Reject already applied.
		backend.report('app_open')
		expect(AppMetrica.reportEvent).not.toHaveBeenCalled()

		resolveInit()
		await acceptPromise.catch(() => undefined)

		// Still blocked after late initialize completion.
		expect(getAdsAllowedForTests()).toBe(false)
		backend.report('app_open')
		expect(AppMetrica.reportEvent).not.toHaveBeenCalled()
	})
})
