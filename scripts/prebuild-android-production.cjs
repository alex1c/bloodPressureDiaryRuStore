/**
 * Production Android CNG prebuild for RuStore release preparation.
 *
 * Patches package.json so Expo autolinking excludes expo-dev-* packages.
 * The exclude MUST remain in place through the subsequent Gradle release
 * build — Gradle re-resolves autolinking from package.json at configure time.
 *
 * Usage (PowerShell):
 *   $env:APP_VARIANT='production'
 *   node scripts/prebuild-android-production.cjs
 *   cd android && .\\gradlew.bat bundleRelease
 *   node scripts/restore-dev-autolinking.cjs   # optional; restores package.json
 *
 * Or set KEEP_PRODUCTION_AUTOLINKING=1 to skip auto-restore (recommended for
 * release builds on a short-path work copy such as D:\\r).
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const packageJsonPath = path.join(root, 'package.json')
const backupPath = path.join(root, '.package.json.pre-production-backup')
const DEV_CLIENT_PACKAGES = [
	'expo-dev-client',
	'expo-dev-launcher',
	'expo-dev-menu',
	'expo-dev-menu-interface',
]

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
}

function writePackageJson(pkg) {
	fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

function ensureProductionVariant() {
	if (process.env.APP_VARIANT !== 'production') {
		console.error('Set APP_VARIANT=production before running this script.')
		process.exit(1)
	}
}

function applyDevClientExclude() {
	const original = fs.readFileSync(packageJsonPath, 'utf8')
	fs.writeFileSync(backupPath, original, 'utf8')
	const pkg = readPackageJson()
	pkg.expo = pkg.expo ?? {}
	pkg.expo.autolinking = {
		...(pkg.expo.autolinking ?? {}),
		exclude: DEV_CLIENT_PACKAGES,
	}
	writePackageJson(pkg)
	console.log('Applied expo.autolinking.exclude for expo-dev-* (backup: .package.json.pre-production-backup)')
}

function restorePackageJson() {
	if (!fs.existsSync(backupPath)) {
		return
	}
	fs.writeFileSync(packageJsonPath, fs.readFileSync(backupPath, 'utf8'), 'utf8')
	fs.unlinkSync(backupPath)
	console.log('Restored package.json autolinking from backup.')
}

ensureProductionVariant()
applyDevClientExclude()

const result = spawnSync('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], {
	cwd: root,
	stdio: 'inherit',
	env: {
		...process.env,
		APP_VARIANT: 'production',
	},
	shell: true,
})

const keep = process.env.KEEP_PRODUCTION_AUTOLINKING === '1'
if (!keep) {
	// Default: restore so the main workspace stays usable for local dev.
	// For release Gradle builds, re-run with KEEP_PRODUCTION_AUTOLINKING=1
	// or call apply via the backup still present / restore script after Gradle.
	restorePackageJson()
} else {
	console.log('KEEP_PRODUCTION_AUTOLINKING=1 — leaving exclude in package.json for Gradle.')
}

if (result.status !== 0) {
	if (keep) {
		restorePackageJson()
	}
	process.exit(result.status ?? 1)
}

/**
 * If a local (gitignored) production keystore properties file exists, patch
 * the generated android/ Gradle project so bundleRelease is not debug-signed.
 * Never create or invent keystore credentials here.
 */
const keystorePropertiesPath = path.join(root, 'credentials', 'keystore.properties')
if (fs.existsSync(keystorePropertiesPath)) {
	const signing = spawnSync(process.execPath, [path.join(__dirname, 'apply-release-signing.cjs')], {
		cwd: root,
		stdio: 'inherit',
	})
	if (signing.status !== 0) {
		process.exit(signing.status ?? 1)
	}
} else {
	console.log(
		'No credentials/keystore.properties — release signing not applied. Gradle release will stay debug-signed until a production keystore is configured.',
	)
}

console.log('Production prebuild complete.')
