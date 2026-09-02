/**
 * Reports whether production signing credentials are available locally.
 * Never prints passwords or keystore paths from env when sensitive.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PROPERTIES = path.join(ROOT, 'credentials', 'keystore.properties')

function parseProperties(filePath) {
	const text = fs.readFileSync(filePath, 'utf8')
	/** @type {Record<string, string>} */
	const values = {}
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim()
		if (!line || line.startsWith('#') || !line.includes('=')) {
			continue
		}
		const eq = line.indexOf('=')
		values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
	}
	return values
}

function resolveFromEnv() {
	const storeFile = process.env.BP_DIARY_KEYSTORE_PATH
	const storePassword = process.env.BP_DIARY_KEYSTORE_PASSWORD
	const keyAlias = process.env.BP_DIARY_KEY_ALIAS
	const keyPassword = process.env.BP_DIARY_KEY_PASSWORD
	if (!storeFile || !storePassword || !keyAlias || !keyPassword) {
		return null
	}
	return { storeFile, storePassword, keyAlias, keyPassword }
}

function isComplete(props) {
	for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
		const value = props[key]
		if (!value || value.includes('REPLACE_ME') || value.includes('YOUR_USER')) {
			return false
		}
	}
	return fs.existsSync(props.storeFile)
}

function report() {
	const envProps = resolveFromEnv()
	if (envProps && isComplete(envProps)) {
		console.log('signing credentials: AVAILABLE (environment variables)')
		return { available: true, source: 'env' }
	}

	if (fs.existsSync(PROPERTIES)) {
		const props = parseProperties(PROPERTIES)
		if (isComplete(props)) {
			console.log('signing credentials: AVAILABLE (credentials/keystore.properties)')
			return { available: true, source: 'properties' }
		}
	}

	console.log('signing credentials: MISSING — PRODUCTION KEYSTORE REQUIRED')
	console.log(
		'  Create keystore (see credentials/README.md), then set credentials/keystore.properties',
	)
	console.log(
		'  or env: BP_DIARY_KEYSTORE_PATH, BP_DIARY_KEYSTORE_PASSWORD, BP_DIARY_KEY_ALIAS, BP_DIARY_KEY_PASSWORD',
	)
	return { available: false, source: null }
}

module.exports = { report, resolveFromEnv, isComplete, PROPERTIES }
