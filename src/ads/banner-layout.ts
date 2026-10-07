import type { BannerPlacement } from '@/config/ads'

/** Reserved sticky banner height (Yandex sticky ~50–60dp). */
export const BANNER_SLOT_HEIGHT = 60

/**
 * Maps the active tabs route to a Yandex banner placement.
 * Medications always monetize; other tabs respect the first-measurement gate.
 */
export function resolveTabBannerPlacement(pathname: string): BannerPlacement {
	if (pathname.includes('medications')) {
		return 'medicationsBanner'
	}
	if (pathname.includes('graphs')) {
		return 'graphsBanner'
	}
	if (pathname.includes('health')) {
		return 'healthBanner'
	}
	return 'diaryBanner'
}

/**
 * Bottom padding for a ScrollView inside a tab screen.
 *
 * After the owner layout change, the banner sits BELOW the app tab bar, so
 * tab screen scroll content must NOT reserve `BANNER_SLOT_HEIGHT` again
 * (that would create a large empty spacer above the tab bar).
 *
 * `bannerVisible` is retained for call-site compatibility and tests; it no
 * longer adds banner height for tab screens.
 */
export function scrollBottomInsetForBanner(options: {
	bannerVisible: boolean
	safeAreaBottom?: number
	extra?: number
}): number {
	void options.bannerVisible
	const safe = options.safeAreaBottom ?? 0
	const extra = options.extra ?? 24
	return safe + extra
}
