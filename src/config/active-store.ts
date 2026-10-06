/**
 * Runtime accessor for the active store configuration.
 * Build-time APP_STORE is embedded into Expo `extra.storeId`.
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

function isProductionVariant(): boolean {
	const extra = Constants.expoConfig?.extra as
		| { appVariant?: string }
		| undefined
	if (extra?.appVariant === 'production') {
		return true
	}
	if (typeof process !== 'undefined' && process.env.APP_VARIANT === 'production') {
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
		requireExplicit: isProductionVariant(),
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
		requireExplicit: isProductionVariant(),
		developmentDefault: 'rustore',
	})
}
