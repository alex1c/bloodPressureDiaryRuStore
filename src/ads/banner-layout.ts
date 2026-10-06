/** Reserved banner slot height to avoid layout jumps while loading. */
export const BANNER_SLOT_HEIGHT = 60

/**
 * Bottom padding for a ScrollView that sits above a sticky banner slot.
 * Pure helper — safe for Jest without React Native.
 */
export function scrollBottomInsetForBanner(options: {
	bannerVisible: boolean
	safeAreaBottom?: number
	extra?: number
}): number {
	const safe = options.safeAreaBottom ?? 0
	const extra = options.extra ?? 24
	if (!options.bannerVisible) {
		return safe + extra
	}
	return safe + extra + BANNER_SLOT_HEIGHT
}
