#!/usr/bin/env node
/**
 * Validates tracked release integration config before production builds.
 * Fails when AppMetrica key or Yandex block IDs are missing or demo placeholders.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

function read(file) {
	return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function fail(message) {
	console.error(`validate:release-config FAIL — ${message}`)
	process.exit(1)
}

function ok(message) {
	console.log(`  ✓ ${message}`)
}

const analyticsSrc = read('src/config/analytics.ts')
const adsSrc = read('src/config/ads.ts')
const appConfigSrc = read('app.config.ts')
const appConfigJs = read('src/config/app-config.ts')
const pluginExists = fs.existsSync(
	path.join(ROOT, 'plugins/with-worklets-packaging.js'),
)

const apiKeyMatch = analyticsSrc.match(
	/apiKey:\s*'([^']+)'/,
)
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

const remaining = []
if (!/supportEmail|support_email|support@/i.test(appConfigJs + appConfigSrc)) {
	remaining.push('support email URL')
}
if (!/privacyPolicy|privacy_url|privacy/i.test(appConfigJs + appConfigSrc)) {
	remaining.push('privacy policy URL')
}

console.log('validate:release-config PASS')
if (remaining.length > 0) {
	console.log(
		`Remaining release requirements (not validated here): ${remaining.join(', ')}`,
	)
}
