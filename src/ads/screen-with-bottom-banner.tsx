import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { BannerPlacement } from '@/config/ads'
import { colors } from '@/theme'

export { BANNER_SLOT_HEIGHT, scrollBottomInsetForBanner } from './banner-layout'

type ScreenWithBottomBannerProps = {
	/** Main scrollable / flex content. */
	children: React.ReactNode
	/**
	 * Placement is resolved by the tabs-level banner under the tab bar.
	 * Kept on the API so call sites stay stable; not rendered here.
	 */
	placement: BannerPlacement
	/** Reserved for call-site clarity; tabs layout owns visibility. */
	visible?: boolean
	/** Unused: system safe area is applied under the tabs banner. */
	includeSafeAreaBottom?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
	bannerStyle?: StyleProp<ViewStyle>
}

/**
 * Content column for monetized tab screens.
 *
 * Banner geometry lives under the app tab bar (`TabsBottomBanner`):
 *   CONTENT → APP TAB BAR → BANNER → ANDROID SYSTEM SAFE AREA
 *
 * This wrapper no longer mounts an in-screen banner slot (avoids double ads
 * and obsolete mid-column spacers).
 */
export function ScreenWithBottomBanner({
	children,
	placement: _placement,
	visible: _visible = true,
	includeSafeAreaBottom: _includeSafeAreaBottom = false,
	style,
	contentStyle,
	bannerStyle: _bannerStyle,
}: ScreenWithBottomBannerProps) {
	return (
		<View style={[styles.root, style]}>
			<View style={[styles.content, contentStyle]}>{children}</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	content: {
		flex: 1,
		minHeight: 0,
	},
})
