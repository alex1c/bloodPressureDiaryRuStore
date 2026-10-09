/**
 * Production release metadata shared by Settings, validation, and docs.
 * Store-specific URLs come from `getActiveStoreConfig()` / STORE_CONFIGS.
 */
import { getActiveStoreConfig } from './active-store'

/** Static identity shared across stores (display name, icon paths). */
export const releaseIdentity = {
	/** In-app / storefront display name for v1.x */
	appDisplayName: 'Дневник давления',
	/** Master artwork used for launcher + store icon derivatives. */
	iconMasterAsset: 'assets/icon_gpt.png',
	standardIconAsset: 'assets/icon.png',
	storeIconPath: 'release-artifacts/icon-512.png',
	effectivePrivacyDate: '2026-10-08',
} as const

/**
 * Live release metadata — support/privacy/store URLs follow the active store.
 * Kept as a getter object so tests can override the active store.
 */
export const releaseConfig = {
	get appDisplayName() {
		return releaseIdentity.appDisplayName
	},
	get supportEmail() {
		return getActiveStoreConfig().supportEmail
	},
	get privacyPolicyUrl() {
		return getActiveStoreConfig().privacyPolicyUrl
	},
	get iconMasterAsset() {
		return releaseIdentity.iconMasterAsset
	},
	get standardIconAsset() {
		return releaseIdentity.standardIconAsset
	},
	get storeIconPath() {
		return releaseIdentity.storeIconPath
	},
	get effectivePrivacyDate() {
		return releaseIdentity.effectivePrivacyDate
	},
	get appUrl() {
		return getActiveStoreConfig().appUrl
	},
	get pdfAppUrl() {
		return getActiveStoreConfig().pdfAppUrl
	},
	get storeId() {
		return getActiveStoreConfig().storeId
	},
	get storeName() {
		return getActiveStoreConfig().storeName
	},
} as const

/** Opens developer contact in the system mail client. */
export function buildSupportMailtoUrl(subject?: string): string {
	const base = `mailto:${releaseConfig.supportEmail}`
	if (!subject) {
		return base
	}
	return `${base}?subject=${encodeURIComponent(subject)}`
}
