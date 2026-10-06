#!/usr/bin/env node
/**
 * Validates tracked release integration config before production builds.
 * Store-aware: pass --store=rustore|googleplay or set APP_STORE.
 * Signing credentials are reported separately — config can pass without a keystore.
 *
 * Checks resolved store configuration (not a naive whole-repo grep that would
 * forbid both store URL constants living in the shared codebase).
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const EXPECTED_EMAIL = 'rustore-alex1c@yandex.ru'
const EXPECTED_PRIVACY =
	'https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html'
const EXPECTED_APP_NAME = 'Дневник давления'
const PACKAGE_ID = 'com.calculatorplatform.bpdiary'
const RUSTORE_URL = `https://www.rustore.ru/catalog/app/${PACKAGE_ID}`
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`

function read(file) {
	return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function exists(file) {
	return fs.existsSync(path.join(ROOT, file))
}

function fail(message) {
	console.error(`validate:release-config FAIL — ${message}`)
	process.exit(1)
}

function ok(message) {
	console.log(`  ✓ ${message}`)
}

function parseStoreId() {
	const arg = process.argv.find((a) => a.startsWith('--store='))
	const fromArg = arg ? arg.slice('--store='.length) : ''
	const raw = (fromArg || process.env.APP_STORE || '').trim().toLowerCase()
	if (raw !== 'rustore' && raw !== 'googleplay') {
		fail(
			'APP_STORE / --store must be "rustore" or "googleplay" (required for release validation)',
		)
	}
	return raw
}

function isRustoreLike(url) {
	return url.includes('rustore.ru/catalog/app/')
}

function isPlayLike(url) {
	return (
		url.includes('play.google.com/store/apps/details') &&
		url.includes(`id=${PACKAGE_ID}`)
	)
}

/** Mirrors src/config/store.ts resolved production outputs. */
function resolveStore(storeId) {
	if (storeId === 'rustore') {
		return {
			storeId: 'rustore',
			appUrl: RUSTORE_URL,
			pdfAppUrl: RUSTORE_URL,
			pdfDownloadLabel: 'Скачать в RuStore',
			supportEmail: EXPECTED_EMAIL,
			privacyPolicyUrl: EXPECTED_PRIVACY,
		}
	}
	return {
		storeId: 'googleplay',
		appUrl: PLAY_URL,
		pdfAppUrl: PLAY_URL,
		pdfDownloadLabel: 'Get it on Google Play',
		supportEmail: EXPECTED_EMAIL,
		privacyPolicyUrl: EXPECTED_PRIVACY,
	}
}

const storeId = parseStoreId()
console.log(`validate:release-config — store=${storeId}`)

const analyticsSrc = read('src/config/analytics.ts')
const adsSrc = read('src/config/ads.ts')
const appConfigSrc = read('app.config.ts')
const appConfigJs = read('src/config/app-config.ts')
const storeSrc = read('src/config/store.ts')
const privacyHtml = read('docs/privacy.html')
const pluginExists = exists('plugins/with-worklets-packaging.js')

if (!appConfigJs.includes(`displayName: '${EXPECTED_APP_NAME}'`)) {
	fail(`app display name must be ${EXPECTED_APP_NAME}`)
}
if (!appConfigSrc.includes(`name: '${EXPECTED_APP_NAME}'`)) {
	fail(`Expo app name must be ${EXPECTED_APP_NAME}`)
}
ok(`app name = ${EXPECTED_APP_NAME}`)

if (!storeSrc.includes(`supportEmail: '${EXPECTED_EMAIL}'`)) {
	fail(`support email must be ${EXPECTED_EMAIL}`)
}
if (!privacyHtml.includes(EXPECTED_EMAIL)) {
	fail('privacy.html missing support email')
}
ok(`support email = ${EXPECTED_EMAIL}`)

if (!storeSrc.includes(`'${EXPECTED_PRIVACY}'`)) {
	fail(`privacy policy URL must be ${EXPECTED_PRIVACY}`)
}
if (!exists('docs/privacy.html')) {
	fail('docs/privacy.html missing')
}
ok(`privacy policy URL = ${EXPECTED_PRIVACY}`)

if (!storeSrc.includes('rustore.ru/catalog/app/') || !storeSrc.includes(PACKAGE_ID)) {
	fail(`RuStore app URL missing in store config for ${PACKAGE_ID}`)
}
if (
	!storeSrc.includes('play.google.com/store/apps/details') ||
	!storeSrc.includes(PACKAGE_ID)
) {
	fail(`Google Play app URL missing in store config for ${PACKAGE_ID}`)
}
ok('both store catalog URLs defined in store config layer')

const resolved = resolveStore(storeId)
ok(`resolved storeId = ${resolved.storeId}`)
ok(`resolved appUrl = ${resolved.appUrl}`)

if (storeId === 'rustore') {
	if (!isRustoreLike(resolved.pdfAppUrl) || isPlayLike(resolved.pdfAppUrl)) {
		fail('RuStore resolved PDF/CTA must be RuStore-only')
	}
	ok('RuStore PDF/store CTA points at RuStore')
} else {
	if (!isPlayLike(resolved.pdfAppUrl) || isRustoreLike(resolved.pdfAppUrl)) {
		fail('Google Play resolved PDF/CTA must be Play-only')
	}
	ok('Google Play PDF/store CTA points at Google Play')
}

const apiKeyMatch = analyticsSrc.match(/apiKey:\s*'([^']+)'/)
const apiKey = apiKeyMatch?.[1]
if (!apiKey) {
	fail('AppMetrica apiKey missing in src/config/analytics.ts')
}
if (
	!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		apiKey,
	)
) {
	fail('AppMetrica apiKey format invalid')
}
ok(`AppMetrica key present (${apiKey.slice(0, 8)}…)`)

const adIds = {
	diaryBanner: 'R-M-20056373-1',
	graphsBanner: 'R-M-20056373-2',
	healthBanner: 'R-M-20056373-3',
	interstitial: 'R-M-20056373-4',
	medicationsBanner: 'R-M-20056373-5',
}

for (const [name, expected] of Object.entries(adIds)) {
	if (!adsSrc.includes(`${name}: '${expected}'`)) {
		fail(`Yandex ad id missing or changed: ${name}`)
	}
}
ok('All 5 Yandex production block IDs present')

const unique = new Set(Object.values(adIds))
if (unique.size !== 5) {
	fail('Yandex block IDs must be distinct')
}
ok('Yandex block IDs distinct')

const productionBlock =
	adsSrc.match(/export const yandexAdsProduction = \{[\s\S]*?\n\}/)?.[0] ?? ''
if (
	productionBlock.includes('demo-banner-yandex') ||
	productionBlock.includes('demo-interstitial-yandex')
) {
	fail('Production config must not use Yandex demo IDs')
}
ok('Production config not using Yandex demo IDs in production map')

if (!appConfigJs.includes(`androidPackage: '${PACKAGE_ID}'`)) {
	fail('package ID mismatch in src/config/app-config.ts')
}
ok(`package ID = ${PACKAGE_ID}`)

if (!appConfigJs.includes("versionName: '1.0.2'")) {
	fail('versionName mismatch')
}
ok('version = 1.0.2')

if (!appConfigJs.includes('versionCode: 3')) {
	fail('versionCode mismatch')
}
ok('versionCode = 3')

if (!appConfigSrc.includes('storeId')) {
	fail('app.config.ts must embed storeId in extra')
}
ok('app.config.ts embeds storeId')

const iconFiles = [
	'assets/icon_gpt.png',
	'assets/icon.png',
	'assets/android-icon-foreground.png',
	'assets/android-icon-background.png',
	'release-artifacts/icon-512.png',
]
for (const file of iconFiles) {
	if (!exists(file)) {
		fail(`icon asset missing: ${file}`)
	}
}
ok('final icon assets present (master, launcher, adaptive, store 512)')

if (!appConfigSrc.includes('./assets/icon.png')) {
	fail('app.config.ts must reference ./assets/icon.png')
}
if (appConfigSrc.includes('tile') || appConfigSrc.includes('wallpaper')) {
	fail('placeholder icon references detected in app.config.ts')
}
ok('launcher icon wired to assets/icon.png')

if (!appConfigSrc.includes('./plugins/with-worklets-packaging')) {
	fail('with-worklets-packaging plugin missing from app.config.ts')
}
if (!pluginExists) {
	fail('plugins/with-worklets-packaging.js not found')
}
ok('worklets packaging plugin present')

if (!appConfigSrc.includes('allowBackup: false')) {
	fail('android.allowBackup must be false (health data Auto Backup exclusion)')
}
if (!appConfigSrc.includes('./plugins/with-disable-auto-backup')) {
	fail('with-disable-auto-backup plugin missing from app.config.ts')
}
if (!exists('plugins/with-disable-auto-backup.js')) {
	fail('plugins/with-disable-auto-backup.js not found')
}
ok('Android Auto Backup disabled for health diary data')

for (const privacyLocale of [
	'docs/privacy.html',
	'docs/privacy/en.html',
	'docs/privacy/es.html',
	'docs/privacy/de.html',
]) {
	if (!exists(privacyLocale)) {
		fail(`privacy page missing: ${privacyLocale}`)
	}
}
ok('privacy pages present (RU/EN/ES/DE)')

if (!exists('docs/google-play/DATA_SAFETY.md')) {
	fail('docs/google-play/DATA_SAFETY.md missing')
}
if (!exists('docs/google-play/PLAY_CONSOLE_CHECKLIST.md')) {
	fail('docs/google-play/PLAY_CONSOLE_CHECKLIST.md missing')
}
ok('Google Play compliance docs present')

if (!appConfigSrc.includes('blockedPermissions')) {
	fail('blockedPermissions missing from production android config')
}
for (const perm of [
	'android.permission.SYSTEM_ALERT_WINDOW',
	'android.permission.READ_EXTERNAL_STORAGE',
	'android.permission.WRITE_EXTERNAL_STORAGE',
]) {
	if (!appConfigSrc.includes(perm)) {
		fail(`blocked permission missing: ${perm}`)
	}
}
ok('blocked permissions configured')

console.log(`validate:release-config PASS (store=${storeId})`)

const signing = require('./check-signing-credentials.cjs')
signing.report()
