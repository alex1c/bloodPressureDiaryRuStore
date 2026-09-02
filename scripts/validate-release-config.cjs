#!/usr/bin/env node
/**
 * Validates tracked release integration config before production builds.
 * Signing credentials are reported separately — config can pass without a keystore.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const EXPECTED_EMAIL = 'rustore-alex1c@yandex.ru'
const EXPECTED_PRIVACY =
	'https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html'
const EXPECTED_APP_NAME = 'Дневник давления'

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

function warn(message) {
	console.log(`  ⚠ ${message}`)
}

const analyticsSrc = read('src/config/analytics.ts')
const adsSrc = read('src/config/ads.ts')
const appConfigSrc = read('app.config.ts')
const appConfigJs = read('src/config/app-config.ts')
const releaseSrc = read('src/config/release.ts')
const privacyHtml = read('docs/privacy.html')
const pluginExists = exists('plugins/with-worklets-packaging.js')

if (!appConfigJs.includes(`displayName: '${EXPECTED_APP_NAME}'`)) {
	fail(`app display name must be ${EXPECTED_APP_NAME}`)
}
if (!appConfigSrc.includes(`name: '${EXPECTED_APP_NAME}'`)) {
	fail(`Expo app name must be ${EXPECTED_APP_NAME}`)
}
ok(`app name = ${EXPECTED_APP_NAME}`)

if (!releaseSrc.includes(`supportEmail: '${EXPECTED_EMAIL}'`)) {
	fail(`support email must be ${EXPECTED_EMAIL}`)
}
if (!privacyHtml.includes(EXPECTED_EMAIL)) {
	fail('privacy.html missing support email')
}
ok(`support email = ${EXPECTED_EMAIL}`)

if (!releaseSrc.includes(`privacyPolicyUrl:\n\t\t'${EXPECTED_PRIVACY}'`)) {
	if (!releaseSrc.includes(`'${EXPECTED_PRIVACY}'`)) {
		fail(`privacy policy URL must be ${EXPECTED_PRIVACY}`)
	}
}
if (!exists('docs/privacy.html')) {
	fail('docs/privacy.html missing')
}
ok(`privacy policy URL = ${EXPECTED_PRIVACY}`)

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
ok(`AppMetrica key present (${apiKey})`)

const adIds = {
	diaryBanner: 'R-M-19857656-1',
	graphsBanner: 'R-M-19857656-2',
	healthBanner: 'R-M-19857656-3',
	interstitial: 'R-M-19857656-4',
}

for (const [name, expected] of Object.entries(adIds)) {
	if (!adsSrc.includes(`${name}: '${expected}'`)) {
		fail(`Yandex ad id missing or changed: ${name}`)
	}
}
ok('All 4 Yandex production block IDs present')

const unique = new Set(Object.values(adIds))
if (unique.size !== 4) {
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

if (!appConfigJs.includes("androidPackage: 'com.calculatorplatform.bpdiary'")) {
	fail('package ID mismatch in src/config/app-config.ts')
}
ok('package ID = com.calculatorplatform.bpdiary')

if (!appConfigJs.includes("versionName: '1.0.0'")) {
	fail('versionName mismatch')
}
ok('version = 1.0.0')

if (!appConfigJs.includes('versionCode: 1')) {
	fail('versionCode mismatch')
}
ok('versionCode = 1')

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

console.log('validate:release-config PASS (release config valid)')

const signing = require('./check-signing-credentials.cjs')
signing.report()
