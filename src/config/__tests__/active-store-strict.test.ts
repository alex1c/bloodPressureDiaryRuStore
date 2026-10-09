import {
	requiresExplicitStoreId,
	setActiveStoreIdForTests,
} from '@/config/active-store'
import {
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
	resolveProductionAdUnits,
	yandexAdsGooglePlayProduction,
	yandexAdsRustoreProduction,
} from '@/config/ads'
import { resolveStoreId } from '@/config/store'

describe('strict APP_STORE resolution', () => {
	afterEach(() => {
		setActiveStoreIdForTests(null)
	})

	it('requires explicit store for production appVariant', () => {
		expect(requiresExplicitStoreId('production', true)).toBe(true)
	})

	it('requires explicit store when __DEV__ is false even without appVariant', () => {
		expect(requiresExplicitStoreId(undefined, false)).toBe(true)
	})

	it('allows development default when not production', () => {
		expect(requiresExplicitStoreId(undefined, true)).toBe(false)
		expect(
			resolveStoreId(undefined, {
				requireExplicit: false,
				developmentDefault: 'rustore',
			}),
		).toBe('rustore')
	})

	it('accepts production + googleplay / rustore', () => {
		expect(
			resolveStoreId('googleplay', { requireExplicit: true }),
		).toBe('googleplay')
		expect(resolveStoreId('rustore', { requireExplicit: true })).toBe(
			'rustore',
		)
	})

	it('fails release without APP_STORE', () => {
		expect(() =>
			resolveStoreId(undefined, { requireExplicit: true }),
		).toThrow(/APP_STORE must be/)
		expect(() => resolveStoreId('', { requireExplicit: true })).toThrow(
			/APP_STORE must be/,
		)
	})

	it('fails unknown APP_STORE', () => {
		expect(() =>
			resolveStoreId('amazon', { requireExplicit: true }),
		).toThrow(/APP_STORE must be/)
		expect(() =>
			resolveStoreId('amazon', { requireExplicit: false }),
		).toThrow(/Invalid APP_STORE/)
	})

	it('does not mix store ad IDs', () => {
		expect(resolveProductionAdUnits('rustore')).toEqual(
			yandexAdsRustoreProduction,
		)
		expect(resolveProductionAdUnits('googleplay')).toEqual(
			yandexAdsGooglePlayProduction,
		)
		expect(
			resolveBannerAdUnitId('medicationsBanner', 'production', 'rustore'),
		).toBe('R-M-20056373-5')
		expect(
			resolveBannerAdUnitId('medicationsBanner', 'production', 'googleplay'),
		).toBe('R-M-20201011-4')
		expect(resolveInterstitialAdUnitId('production', 'rustore')).toBe(
			'R-M-20056373-4',
		)
		expect(resolveInterstitialAdUnitId('production', 'googleplay')).toBe(
			'R-M-20201011-5',
		)
		expect(yandexAdsRustoreProduction.interstitial).not.toBe(
			yandexAdsGooglePlayProduction.interstitial,
		)
	})
})
