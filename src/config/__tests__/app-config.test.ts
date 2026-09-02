import { appConfig } from '@/config/app-config'
import { getAdService } from '@/ads'
import { resolveAdRuntimeVariant } from '@/config/ads'

describe('app identity', () => {
	it('locks production package id chosen in DECISIONS.md', () => {
		expect(appConfig.androidPackage).toBe('com.calculatorplatform.bpdiary')
		expect(appConfig.versionName).toBe('1.0.0')
		expect(appConfig.versionCode).toBe(1)
	})
})

describe('ad policy seam', () => {
	it('refuses ads before first measurement', () => {
		expect(
			getAdService().canShowAds({ hasCompletedFirstMeasurement: false }),
		).toBe(false)
		expect(
			getAdService().canShowAds({ hasCompletedFirstMeasurement: true }),
		).toBe(true)
	})
})

describe('ad runtime variant', () => {
	it('uses production IDs in release JS even without APP_VARIANT', () => {
		expect(resolveAdRuntimeVariant('development', false)).toBe('production')
	})

	it('uses demo IDs in dev when APP_VARIANT is not production', () => {
		expect(resolveAdRuntimeVariant('development', true)).toBe('development')
	})
})
