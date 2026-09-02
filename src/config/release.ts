/**
 * Production release metadata shared by Settings, validation, and docs.
 * Privacy URL assumes GitHub Pages for this repository (see docs/DECISIONS.md).
 */
export const releaseConfig = {
	/** RuStore / in-app display name for v1.0.0 */
	appDisplayName: 'Дневник давления',
	supportEmail: 'rustore-alex1c@yandex.ru',
	/**
	 * GitHub Pages privacy page (`docs/privacy.html`).
	 * Repository remote was not configured at Phase 10 prep — URL matches repo folder.
	 */
	privacyPolicyUrl:
		'https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html',
	/** Master artwork used for launcher + store icon derivatives. */
	iconMasterAsset: 'assets/icon_gpt.png',
	standardIconAsset: 'assets/icon.png',
	storeIconPath: 'release-artifacts/icon-512.png',
	effectivePrivacyDate: '2026-09-02',
} as const

/** Opens developer contact in the system mail client. */
export function buildSupportMailtoUrl(subject?: string): string {
	const base = `mailto:${releaseConfig.supportEmail}`
	if (!subject) {
		return base
	}
	return `${base}?subject=${encodeURIComponent(subject)}`
}
