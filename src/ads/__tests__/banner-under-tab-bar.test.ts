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

	it('composes TabBar then TabsBottomBanner with zero tab bottom inset', () => {
		const tabs = readRel('app/(tabs)/_layout.tsx')
		expect(tabs).toContain('function TabBarWithBanner')
		expect(tabs.indexOf('BottomTabBar')).toBeLessThan(
			tabs.indexOf('<TabsBottomBanner'),
		)
		expect(tabs).toContain('insets={{ ...props.insets, bottom: 0 }}')
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
