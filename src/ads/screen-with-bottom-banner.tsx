import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BannerPlacement } from '@/config/ads'
import { colors, spacing } from '@/theme'
import { AdBanner } from './ad-banner'

export { BANNER_SLOT_HEIGHT, scrollBottomInsetForBanner } from './banner-layout'

type ScreenWithBottomBannerProps = {
	/** Main scrollable / flex content. */
	children: React.ReactNode
	placement: BannerPlacement
	/** When false, banner slot collapses (no empty spacer). */
	visible?: boolean
	/**
	 * Extra bottom inset when the screen already sits above a tab bar
	 * (typically 0 — tab navigator owns the home-indicator inset).
	 */
	includeSafeAreaBottom?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
	bannerStyle?: StyleProp<ViewStyle>
}

/**
 * Pins the ad banner to the bottom of the usable screen area.
 *
 * Layout contract (ForestMusic ads playbook):
 *   CONTENT → BANNER → optional safe-area padding → tab bar / system nav
 *
 * Banner does not float mid-scroll; scroll content gets padding for the slot.
 */
export function ScreenWithBottomBanner({
	children,
	placement,
	visible = true,
	includeSafeAreaBottom = false,
	style,
	contentStyle,
	bannerStyle,
}: ScreenWithBottomBannerProps) {
	const insets = useSafeAreaInsets()
	const showBanner = visible
	const bottomPad = includeSafeAreaBottom
		? Math.max(insets.bottom, spacing.sm)
		: spacing.sm

	return (
		<View style={[styles.root, style]}>
			<View style={[styles.content, contentStyle]}>{children}</View>
			{showBanner ? (
				<View
					style={[
						styles.bannerSlot,
						{ paddingBottom: bottomPad },
						bannerStyle,
					]}
					testID="bottom-banner-slot"
				>
					<AdBanner placement={placement} visible />
				</View>
			) : null}
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
	bannerSlot: {
		width: '100%',
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		backgroundColor: colors.background,
		paddingTop: spacing.xs,
		/** Keep banner visually attached to the bottom edge of the content column. */
		justifyContent: 'flex-end',
	},
})
