/**
 * Reject via PrivacyConsentProvider must flip service gates before passive effects.
 */

import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import Constants from 'expo-constants'
import AppMetrica from '@appmetrica/react-native-analytics'
import { InterstitialAdLoader } from 'yandex-mobile-ads'
import {
	PrivacyConsentProvider,
	usePrivacyConsent,
} from '@/privacy/consent-context'
import { OptionalSdkBootstrap } from '@/privacy/optional-sdk-bootstrap'
import {
	createYandexAdService,
	getAdsAllowedForTests,
	resetYandexAdServiceForTests,
} from '@/ads/yandex-ad-service'
import { setAdService } from '@/ads'
import {
	createAppMetricaAnalyticsService,
	getAnalyticsAllowedForTests,
	resetAppMetricaInitializationForTests,
} from '@/analytics/appmetrica-service'
import { setAnalyticsBackend } from '@/analytics/backend'
import {
	getOptionalSdkPermissionsForTests,
	resetAppServicesInitializationForTests,
} from '@/services'
import { resetConsentWriteQueueForTests } from '@/privacy/consent-persistence'
import * as FileSystem from 'expo-file-system/legacy'

type ConsentApi = ReturnType<typeof usePrivacyConsent>

function ConsentCapture({
	onApi,
}: {
	onApi: (api: ConsentApi) => void
}) {
	const consentApi = usePrivacyConsent()
	useEffect(() => {
		onApi(consentApi)
	}, [consentApi, onApi])
	return null
}

describe('Provider immediate Reject (before passive effects)', () => {
	const files = new Map<string, string>()
	let root: ReactTestRenderer | null = null
	let api: ConsentApi | null = null

	beforeEach(() => {
		// Enable React 19 act environment for react-test-renderer.
		;(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true

		resetAppServicesInitializationForTests()
		resetYandexAdServiceForTests()
		resetAppMetricaInitializationForTests()
		resetConsentWriteQueueForTests()
		files.clear()
		api = null
		jest.clearAllMocks()

		// Force production consent gate (session model active).
		;(
			Constants as { expoConfig?: { extra?: Record<string, unknown> } }
		).expoConfig = {
			extra: { appVariant: 'production', storeId: 'googleplay' },
		}

		;(FileSystem.getInfoAsync as jest.Mock).mockImplementation(
			async (path: string) => ({ exists: files.has(path) }),
		)
		;(FileSystem.readAsStringAsync as jest.Mock).mockImplementation(
			async (path: string) => {
				const body = files.get(path)
				if (body === undefined) {
					throw new Error('missing')
				}
				return body
			},
		)
		;(FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
			async (path: string, body: string) => {
				files.set(path, body)
			},
		)
		;(FileSystem.deleteAsync as jest.Mock).mockImplementation(
			async (path: string) => {
				files.delete(path)
			},
		)

		setAdService(createYandexAdService())
		setAnalyticsBackend(createAppMetricaAnalyticsService())
	})

	afterEach(async () => {
		await act(async () => {
			root?.unmount()
			await Promise.resolve()
		})
		root = null
	})

	async function mountProvider() {
		await act(async () => {
			root = create(
				<PrivacyConsentProvider>
					<OptionalSdkBootstrap />
					<ConsentCapture
						onApi={(next) => {
							api = next
						}}
					/>
				</PrivacyConsentProvider>,
			)
		})
		// Flush persistence read → ready.
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		expect(api?.ready).toBe(true)
	}

	it('blocks reportEvent and loadAd after declineAll before effects run', async () => {
		await mountProvider()

		await act(async () => {
			await api!.acceptAll()
		})
		expect(getAnalyticsAllowedForTests()).toBe(true)
		expect(getAdsAllowedForTests()).toBe(true)

		jest.clearAllMocks()

		// Invoke Reject WITHOUT wrapping the call itself in act, so we can
		// assert gates before React flushes passive effects.
		const declinePromise = api!.declineAll()

		expect(getAnalyticsAllowedForTests()).toBe(false)
		expect(getAdsAllowedForTests()).toBe(false)
		expect(getOptionalSdkPermissionsForTests()).toEqual(
			expect.objectContaining({
				analyticsAllowed: false,
				adsAllowed: false,
			}),
		)

		const backend = createAppMetricaAnalyticsService()
		backend.report('app_open')
		expect(AppMetrica.reportEvent).not.toHaveBeenCalled()

		const ads = createYandexAdService()
		await ads.initialize()
		expect(getAdsAllowedForTests()).toBe(false)
		const createMock = InterstitialAdLoader.create as jest.Mock
		expect(createMock).not.toHaveBeenCalled()

		await act(async () => {
			await declinePromise
		})

		// Still blocked after effects / persist settle.
		backend.report('app_open')
		expect(AppMetrica.reportEvent).not.toHaveBeenCalled()
		expect(getAdsAllowedForTests()).toBe(false)
	})

	it('mixed deny analytics keeps ads gate independent and immediate', async () => {
		await mountProvider()
		await act(async () => {
			await api!.savePurposes({
				analytics: 'granted',
				ads: 'granted',
			})
		})

		const savePromise = api!.savePurposes({
			analytics: 'denied',
			ads: 'granted',
		})

		expect(getAnalyticsAllowedForTests()).toBe(false)
		expect(getAdsAllowedForTests()).toBe(true)

		await act(async () => {
			await savePromise
		})
	})
})
