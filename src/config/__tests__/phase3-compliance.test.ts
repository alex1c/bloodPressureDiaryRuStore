/**
 * Phase 3 compliance invariants — store isolation, privacy HTTPS,
 * disclaimer presence, Auto Backup config, listing medical-claim guards.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
	getStoreConfig,
	isGooglePlayAppUrl,
	isRustoreAppUrl,
} from '@/config/store'
import { releaseConfig, releaseIdentity } from '@/config/release'
import { translate } from '@/i18n/translate'
import type { AppLocale } from '@/i18n/locale'
import { renderDoctorReportHtml } from '@/domain/report/render-doctor-report-html'
import type { DoctorReportData } from '@/domain/report/build-doctor-report'
import {
	BANNER_SLOT_HEIGHT,
	scrollBottomInsetForBanner,
} from '@/ads/banner-layout'
import {
	yandexAdsGooglePlayProduction,
	yandexAdsProduction,
	yandexAdsRustoreProduction,
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
} from '@/config/ads'

const ROOT = path.resolve(__dirname, '../../..')

function readRepo(rel: string): string {
	return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

const emptyReport: DoctorReportData = {
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

describe('Phase 3 privacy & store compliance', () => {
	it('keeps canonical privacy URL as public HTTPS', () => {
		expect(releaseConfig.privacyPolicyUrl).toMatch(/^https:\/\//)
		expect(releaseConfig.privacyPolicyUrl).toContain(
			'bloodPressureDiaryRuStore/privacy.html',
		)
		expect(releaseIdentity.effectivePrivacyDate).toBe('2026-10-08')
	})

	it('ships localized privacy HTML pages', () => {
		for (const rel of [
			'docs/privacy.html',
			'docs/privacy/en.html',
			'docs/privacy/es.html',
			'docs/privacy/de.html',
		]) {
			const html = readRepo(rel)
			expect(html.toLowerCase()).toMatch(/appmetrica/)
			expect(html.toLowerCase()).toMatch(/yandex|рекламн|publicidad|werbung/)
			expect(html.toLowerCase()).toMatch(/auto backup|автоматическ|desactivad|deaktiviert/)
			// International gate disclosure — must not claim Google-certified CMP.
			expect(html.toLowerCase()).toMatch(
				/first-party|sdk gate|cmp|tcf|сертифицированн|certificad/,
			)
			expect(html).toContain('rustore-alex1c@yandex.ru')
		}
	})

	it('documents international CMP owner checkpoint', () => {
		const doc = readRepo('docs/google-play/INTERNATIONAL_CONSENT.md')
		expect(doc).toMatch(/OWNER CHECKPOINT/)
		expect(doc).toMatch(/Google-certified/)
		expect(doc).toMatch(/AdMob/)
		expect(doc).toMatch(/Do Not Sell/)
	})

	it('disables Yandex automatic SDK initialization via Expo plugin', () => {
		const plugin = readRepo('plugins/with-yandex-ads-manual-init.js')
		expect(plugin).toContain('AUTOMATIC_SDK_INITIALIZATION')
		expect(plugin).toContain('APPMETRICA_EASY_INTEGRATION_ENABLED')
		expect(readRepo('app.config.ts')).toContain(
			'./plugins/with-yandex-ads-manual-init',
		)
		expect(readRepo('android/app/src/main/AndroidManifest.xml')).toContain(
			'com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION',
		)
	})

	it('does not declare local SQLite health as collected in Data Safety', () => {
		const doc = readRepo('docs/google-play/DATA_SAFETY.md')
		expect(doc).toMatch(/Local SQLite ≠ collected|not declare as collected solely/i)
		expect(doc).toMatch(/In-app deletion \/ uninstall only|server-side deletion/i)
	})

	it('disables Android Auto Backup in Expo config', () => {
		const cfg = readRepo('app.config.ts')
		expect(cfg).toMatch(/allowBackup:\s*false/)
		expect(cfg).toContain('./plugins/with-disable-auto-backup')
		expect(
			fs.existsSync(path.join(ROOT, 'plugins/with-disable-auto-backup.js')),
		).toBe(true)
	})

	it('isolates resolved store CTA URLs', () => {
		const rustore = getStoreConfig('rustore')
		const play = getStoreConfig('googleplay')
		expect(isRustoreAppUrl(rustore.pdfAppUrl)).toBe(true)
		expect(rustore.pdfAppUrl.includes('play.google.com')).toBe(false)
		expect(isGooglePlayAppUrl(play.pdfAppUrl)).toBe(true)
		expect(isRustoreAppUrl(play.pdfAppUrl)).toBe(false)
		expect(play.pdfAppUrl).toContain('id=com.calculatorplatform.bpdiary')
	})

	it('renders Google Play PDF footer without RuStore CTA', () => {
		const html = renderDoctorReportHtml(emptyReport, {
			locale: 'en',
			storeId: 'googleplay',
		})
		expect(html).toContain('play.google.com')
		expect(html).not.toMatch(/rustore\.ru/i)
		expect(html).toMatch(/Get it on Google Play/i)
	})

	it('renders RuStore PDF footer without Play CTA', () => {
		const html = renderDoctorReportHtml(emptyReport, {
			locale: 'ru',
			storeId: 'rustore',
		})
		expect(html).toContain('rustore.ru')
		expect(html).not.toMatch(/play\.google\.com/i)
		expect(html).toMatch(/RuStore/i)
	})

	it('keeps disclaimer meaning across locales', () => {
		const locales: AppLocale[] = ['ru', 'en', 'es', 'de']
		for (const locale of locales) {
			const text = translate(locale, 'report.disclaimer')
			expect(text.length).toBeGreaterThan(40)
			expect(
				/медицинск|medical device|dispositivo médico|Medizinprodukt/i.test(
					text,
				),
			).toBe(true)
			expect(/врач|doctor|médico|Arzt/i.test(text)).toBe(true)
		}
	})

	it('avoids forbidden medical marketing claims in Play listing drafts', () => {
		const bannedClaims = [
			'clinically proven',
			'вылечить гипертонию',
			'cure hypertension',
			'diagnose hypertension',
			'prevent disease',
			'prevenir enfermedades',
			'Krankheit vorbeugen',
		]
		for (const rel of [
			'docs/google-play/listing/ru.md',
			'docs/google-play/listing/en.md',
			'docs/google-play/listing/es.md',
			'docs/google-play/listing/de.md',
		]) {
			const body = readRepo(rel).toLowerCase()
			expect(body).toMatch(
				/not a medical device|не является медицинским|no es un dispositivo médico|kein medizinprodukt/,
			)
			for (const claim of bannedClaims) {
				expect(body).not.toContain(claim.toLowerCase())
			}
		}
	})

	it('preserves RuStore and Google Play production Yandex ad IDs', () => {
		expect(yandexAdsRustoreProduction).toEqual(yandexAdsProduction)
		expect(yandexAdsProduction.diaryBanner).toBe('R-M-20056373-1')
		expect(yandexAdsProduction.graphsBanner).toBe('R-M-20056373-2')
		expect(yandexAdsProduction.healthBanner).toBe('R-M-20056373-3')
		expect(yandexAdsProduction.interstitial).toBe('R-M-20056373-4')
		expect(yandexAdsProduction.medicationsBanner).toBe('R-M-20056373-5')
		expect(yandexAdsGooglePlayProduction.diaryBanner).toBe('R-M-20201011-1')
		expect(yandexAdsGooglePlayProduction.graphsBanner).toBe('R-M-20201011-2')
		expect(yandexAdsGooglePlayProduction.healthBanner).toBe('R-M-20201011-3')
		expect(yandexAdsGooglePlayProduction.medicationsBanner).toBe(
			'R-M-20201011-4',
		)
		expect(yandexAdsGooglePlayProduction.interstitial).toBe('R-M-20201011-5')
		expect(
			resolveBannerAdUnitId('medicationsBanner', 'production', 'googleplay'),
		).toBe('R-M-20201011-4')
		expect(resolveInterstitialAdUnitId('production', 'googleplay')).toBe(
			'R-M-20201011-5',
		)
		expect(BANNER_SLOT_HEIGHT).toBe(60)
		// Tab-bar owns the banner slot — scroll inset must NOT re-add 60dp.
		expect(
			scrollBottomInsetForBanner({
				bannerVisible: true,
				safeAreaBottom: 0,
			}),
		).toBeLessThan(BANNER_SLOT_HEIGHT)
	})

	it('keeps ScreenWithBottomBanner on monetized tabs', () => {
		for (const rel of [
			'src/features/diary/diary-screen.tsx',
			'src/features/graphs/graphs-screen.tsx',
			'src/features/health/health-screen.tsx',
			'src/features/medications/medications-screen.tsx',
		]) {
			const src = readRepo(rel)
			expect(src).toContain('ScreenWithBottomBanner')
			expect(src).toContain('scrollBottomInsetForBanner')
		}
	})

	it('pins Yandex banner under the app tab bar', () => {
		const tabs = readRepo('src/app/(tabs)/_layout.tsx')
		expect(tabs).toContain('TabsBottomBanner')
		expect(tabs).toContain('TabBarWithBanner')
		expect(tabs).toContain('bottom: 0')
		const banner = readRepo('src/ads/tabs-bottom-banner.tsx')
		expect(banner).toContain('CONTENT → APP TAB BAR → BANNER')
		expect(banner).toContain('AdBanner')
		const screen = readRepo('src/ads/screen-with-bottom-banner.tsx')
		expect(screen).not.toContain('<AdBanner')
	})
})
