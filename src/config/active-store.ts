/**
 * Runtime accessor for the active store configuration.
 * Build-time APP_STORE is embedded into Expo `extra.storeId`.
 *
 * Release / production runtimes MUST have an explicit storeId — never fall
 * back to RuStore when `__DEV__ === false` or APP_VARIANT=production.
 */

import Constants from 'expo-constants'
import {
	getStoreConfig,
	resolveStoreConfig,
	resolveStoreId,
	type StoreConfig,
	type StoreId,
} from './store'

let testOverride: StoreId | null = null

/** Test-only override so Jest can pin a store without Expo Constants. */
export function setActiveStoreIdForTests(storeId: StoreId | null): void {
	testOverride = storeId
}

function readEmbeddedStoreId(): string | undefined {
	const extra = Constants.expoConfig?.extra as
		| { storeId?: string; appVariant?: string }
		| undefined
	return extra?.storeId
}

function readEmbeddedAppVariant(): string | undefined {
	const extra = Constants.expoConfig?.extra as
		| { storeId?: string; appVariant?: string }
		| undefined
	return extra?.appVariant
}

/**
 * True when the JS runtime must fail closed without an explicit APP_STORE.
 * Covers production prebuild AND any release bundle where `__DEV__ === false`,
 * even if `extra.appVariant` was omitted.
 */
export function requiresExplicitStoreId(
	appVariant: string | undefined = readEmbeddedAppVariant(),
	isDev: boolean = typeof __DEV__ === 'boolean' ? __DEV__ : true,
): boolean {
	if (appVariant === 'production') {
		return true
	}
	if (typeof process !== 'undefined' && process.env.APP_VARIANT === 'production') {
		return true
	}
	if (isDev === false) {
		return true
	}
	return false
}

/** Resolves the active store for the running JS bundle. */
export function getActiveStoreId(): StoreId {
	if (testOverride) {
		return testOverride
	}
	const embedded = readEmbeddedStoreId()
	const env =
		typeof process !== 'undefined' ? process.env.APP_STORE : undefined
	return resolveStoreId(embedded ?? env, {
		requireExplicit: requiresExplicitStoreId(),
		developmentDefault: 'rustore',
	})
}

/** Full store config for the active build. */
export function getActiveStoreConfig(): StoreConfig {
	if (testOverride) {
		return getStoreConfig(testOverride)
	}
	const embedded = readEmbeddedStoreId()
	const env =
		typeof process !== 'undefined' ? process.env.APP_STORE : undefined
	return resolveStoreConfig(embedded ?? env, {
		requireExplicit: requiresExplicitStoreId(),
		developmentDefault: 'rustore',
	})
}
