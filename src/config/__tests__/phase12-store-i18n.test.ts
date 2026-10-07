import {
	mapSystemLanguageTag,
	normalizeLocalePreference,
	resolveAppLocale,
} from '@/i18n/locale'
import { assertCatalogCompleteness } from '@/i18n/dictionaries'
import { translate } from '@/i18n/translate'
import {
	getStoreConfig,
	isGooglePlayAppUrl,
	isRustoreAppUrl,
	resolveStoreId,
	STORE_CONFIGS,
} from '@/config/store'
import { renderDoctorReportHtml } from '@/domain/report/render-doctor-report-html'
import type { DoctorReportData } from '@/domain/report/build-doctor-report'
import { scrollBottomInsetForBanner } from '@/ads/banner-layout'
import { FORBIDDEN_ANALYTICS_KEYS } from '@/analytics/forbidden-keys'
import { sanitizeAnalyticsParams } from '@/analytics/sanitize'

describe('store config', () => {
	it('resolves rustore and googleplay URLs for the package', () => {
		expect(resolveStoreId('rustore', { requireExplicit: true })).toBe(
			'rustore',
		)
		expect(resolveStoreId('googleplay', { requireExplicit: true })).toBe(
			'googleplay',
		)
		expect(STORE_CONFIGS.rustore.appUrl).toContain(
			'com.calculatorplatform.bpdiary',
		)
		expect(STORE_CONFIGS.googleplay.appUrl).toContain(
			'id=com.calculatorplatform.bpdiary',
		)
		expect(isRustoreAppUrl(getStoreConfig('rustore').pdfAppUrl)).toBe(true)
		expect(isGooglePlayAppUrl(getStoreConfig('googleplay').pdfAppUrl)).toBe(
			true,
		)
	})

	it('fails fast in production when APP_STORE is missing', () => {
		expect(() =>
			resolveStoreId(undefined, { requireExplicit: true }),
		).toThrow(/APP_STORE/)
	})

	it('uses documented development default when unset', () => {
		expect(
			resolveStoreId(undefined, {
				requireExplicit: false,
				developmentDefault: 'rustore',
			}),
		).toBe('rustore')
	})
})

describe('locale resolution', () => {
	it('maps system language tags', () => {
		expect(mapSystemLanguageTag('ru-RU')).toBe('ru')
		expect(mapSystemLanguageTag('en-US')).toBe('en')
		expect(mapSystemLanguageTag('es-MX')).toBe('es')
		expect(mapSystemLanguageTag('de-DE')).toBe('de')
		expect(mapSystemLanguageTag('fr-FR')).toBe('en')
		expect(mapSystemLanguageTag(undefined)).toBe('en')
	})

	it('lets explicit preference override system', () => {
		expect(resolveAppLocale('de', 'ru-RU')).toBe('de')
		expect(resolveAppLocale('system', 'es-ES')).toBe('es')
		expect(resolveAppLocale('system', 'ja-JP')).toBe('en')
	})

	it('normalizes legacy locale values', () => {
		expect(normalizeLocalePreference('ru')).toBe('ru')
		expect(normalizeLocalePreference('en')).toBe('en')
		expect(normalizeLocalePreference('system')).toBe('system')
		expect(normalizeLocalePreference('es')).toBe('es')
		expect(normalizeLocalePreference('weird')).toBe('system')
	})
})

describe('translation catalogs', () => {
	it('has complete keys across all locales', () => {
		const result = assertCatalogCompleteness()
		expect(result.ok).toBe(true)
		expect(result.missing).toEqual({})
	})

	it('translates with placeholders', () => {
		expect(
			translate('en', 'diary.medSummaryCount', { taken: 1, total: 3 }),
		).toBe('1 of 3 marked')
	})
})

describe('PDF locale × store', () => {
	const base: DoctorReportData = {
		profileId: 'p1',
		profileName: 'Alex',
		periodLabel: '1–7 January 2026',
		fromDayKey: '2026-01-01',
		toDayKey: '2026-01-07',
		range: {
			from: '2026-01-01T00:00:00.000Z',
			to: '2026-01-07T23:59:59.999Z',
		},
		hasAnyData: false,
		bp: {
			count: 0,
			avgSystolic: null,
			avgDiastolic: null,
			avgPulse: null,
			minSystolic: null,
			maxSystolic: null,
			minDiastolic: null,
			maxDiastolic: null,
			morning: null,
			evening: null,
		},
		chartPoints: [],
		measurements: [],
		tagStats: [],
		medications: [],
		health: [],
		generatedAtIso: '2026-01-08T00:00:00.000Z',
	}

	it('uses RuStore CTA for rustore store + ru locale', () => {
		const html = renderDoctorReportHtml(base, {
			locale: 'ru',
			storeId: 'rustore',
		})
		expect(html).toContain('lang="ru"')
		expect(html).toContain('rustore.ru/catalog/app/')
		expect(html).toContain('Скачать в RuStore')
		expect(html).not.toContain('play.google.com')
	})

	it('uses Google Play CTA for googleplay store + en locale', () => {
		const html = renderDoctorReportHtml(base, {
			locale: 'en',
			storeId: 'googleplay',
		})
		expect(html).toContain('lang="en"')
		expect(html).toContain('play.google.com/store/apps/details')
		expect(html).toContain('Get it on Google Play')
		expect(html).not.toContain('rustore.ru')
	})
})

describe('banner layout helper', () => {
	it('does not double-reserve banner height under tab-bar layout', () => {
		// Banner sits below the tab bar; scroll content must not add 60dp again.
		expect(
			scrollBottomInsetForBanner({ bannerVisible: false, extra: 10 }),
		).toBe(10)
		expect(
			scrollBottomInsetForBanner({ bannerVisible: true, extra: 10 }),
		).toBe(10)
	})
})

describe('analytics forbidden keys', () => {
	it('strips health-related keys', () => {
		const sanitized = sanitizeAnalyticsParams(
			{
				systolic: 120,
				locale: 'en',
				preference: 'system',
			},
			{ strict: false },
		)
		expect(sanitized).toEqual({ locale: 'en', preference: 'system' })
		expect(FORBIDDEN_ANALYTICS_KEYS).toContain('systolic')
		expect(FORBIDDEN_ANALYTICS_KEYS).toContain('pulse')
	})
})
