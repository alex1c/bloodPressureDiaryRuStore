import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePathname } from 'expo-router'
import { colors, spacing } from '@/theme'
import { useAdPolicy } from '@/hooks/use-ad-policy'
import { AdBanner } from './ad-banner'
import { resolveTabBannerPlacement } from './banner-layout'

export { resolveTabBannerPlacement } from './banner-layout'

type TabsBottomBannerProps = {
	/** When false, only the system safe-area spacer remains under the tab bar. */
	forceHidden?: boolean
}

/**
 * Yandex banner pinned UNDER the app tab bar and ABOVE Android system insets.
 *
 * Layout contract (owner Phase final RC):
 *   CONTENT → APP TAB BAR → BANNER → ANDROID SYSTEM SAFE AREA
 */
export function TabsBottomBanner({ forceHidden = false }: TabsBottomBannerProps) {
	const insets = useSafeAreaInsets()
	const pathname = usePathname()
	const placement = resolveTabBannerPlacement(pathname)
	const { canShowAds } = useAdPolicy()
	const showBanner =
		!forceHidden &&
		(placement === 'medicationsBanner' || canShowAds)
	const bottomPad = Math.max(insets.bottom, spacing.xs)

	if (!showBanner) {
		// Tab bar itself uses bottom inset 0 — keep system gesture/nav clearance.
		return <View style={{ height: insets.bottom }} testID="tabs-banner-safe-spacer" />
	}

	return (
		<View
			style={[styles.slot, { paddingBottom: bottomPad }]}
			testID="tabs-bottom-banner-slot"
		>
			<AdBanner placement={placement} visible />
		</View>
	)
}

const styles = StyleSheet.create({
	slot: {
		width: '100%',
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		backgroundColor: colors.background,
		paddingTop: spacing.xs,
		justifyContent: 'flex-end',
	},
})
