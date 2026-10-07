/**
 * Layout contract: CONTENT → APP TAB BAR → BANNER → ANDROID SYSTEM SAFE AREA
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	BANNER_SLOT_HEIGHT,
	resolveTabBannerPlacement,
	scrollBottomInsetForBanner,
} from '@/ads/banner-layout'

const root = join(__dirname, '../..')

function readRel(rel: string): string {
	return readFileSync(join(root, rel), 'utf8')
}

/**
 * Extracts the JSX return of TabBarWithBanner so import lines cannot
 * accidentally satisfy BottomTabBar-before-banner ordering.
 */
function extractTabBarWithBannerJsx(src: string): string {
	const fnStart = src.indexOf('function TabBarWithBanner')
	expect(fnStart).toBeGreaterThanOrEqual(0)
	const afterFn = src.slice(fnStart)
	const returnMatch = afterFn.match(
		/return\s*\(\s*([\s\S]*?)\s*\)\s*\n\s*\}/,
	)
	expect(returnMatch).not.toBeNull()
	return returnMatch![1]!
}

describe('banner under tab bar layout contract', () => {
	it('maps tab routes to production placement keys', () => {
		expect(resolveTabBannerPlacement('/(tabs)')).toBe('diaryBanner')
		expect(resolveTabBannerPlacement('/(tabs)/graphs')).toBe('graphsBanner')
		expect(resolveTabBannerPlacement('/(tabs)/health')).toBe('healthBanner')
		expect(resolveTabBannerPlacement('/(tabs)/medications')).toBe(
			'medicationsBanner',
		)
	})

	it('does not reserve banner slot height in tab scroll insets', () => {
		expect(
			scrollBottomInsetForBanner({
				bannerVisible: true,
				safeAreaBottom: 0,
				extra: 24,
			}),
		).toBe(24)
		expect(
			scrollBottomInsetForBanner({
				bannerVisible: false,
				safeAreaBottom: 12,
				extra: 24,
			}),
		).toBe(36)
		expect(BANNER_SLOT_HEIGHT).toBe(60)
	})

	it('TabBarWithBanner JSX mounts BottomTabBar above TabsBottomBanner', () => {
		const tabs = readRel('app/(tabs)/_layout.tsx')
		const jsx = extractTabBarWithBannerJsx(tabs)

		const tabBarOpen = jsx.indexOf('<BottomTabBar')
		const bannerOpen = jsx.indexOf('<TabsBottomBanner')
		expect(tabBarOpen).toBeGreaterThanOrEqual(0)
		expect(bannerOpen).toBeGreaterThanOrEqual(0)
		// Real hierarchy: tab bar first, then banner under it.
		expect(tabBarOpen).toBeLessThan(bannerOpen)
		expect(jsx).toContain('bottom: 0')
		// Must fail if banner is restored above the tab bar in this component.
		expect(bannerOpen).toBeGreaterThan(tabBarOpen)
		expect(jsx.indexOf('<AdBanner')).toBe(-1)
	})

	it('rejects banner-above-tab-bar JSX inside TabBarWithBanner', () => {
		const inverted = `
			function TabBarWithBanner(props) {
				return (
					<View>
						<TabsBottomBanner />
						<BottomTabBar {...props} />
					</View>
				)
			}
		`
		const jsx = extractTabBarWithBannerJsx(inverted)
		expect(jsx.indexOf('<TabsBottomBanner')).toBeLessThan(
			jsx.indexOf('<BottomTabBar'),
		)
		// Production file must NOT match the inverted order.
		const production = extractTabBarWithBannerJsx(
			readRel('app/(tabs)/_layout.tsx'),
		)
		expect(production.indexOf('<BottomTabBar')).toBeLessThan(
			production.indexOf('<TabsBottomBanner'),
		)
	})

	it('applies system safe area under the banner slot only', () => {
		const banner = readRel('ads/tabs-bottom-banner.tsx')
		expect(banner).toContain('useSafeAreaInsets')
		expect(banner).toContain('paddingBottom: bottomPad')
		expect(banner).toContain('AdBanner')
		expect(banner).toContain('CONTENT → APP TAB BAR → BANNER')
	})

	it('ScreenWithBottomBanner no longer mounts an in-screen AdBanner', () => {
		const screen = readRel('ads/screen-with-bottom-banner.tsx')
		expect(screen).not.toContain('<AdBanner')
		expect(screen).toContain('TabsBottomBanner')
	})
})
