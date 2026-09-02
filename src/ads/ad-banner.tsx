import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { BannerAdSize, BannerView } from 'yandex-mobile-ads'
import type { BannerPlacement } from '@/config/ads'
import { getAdService } from './index'

type BannerSize = Awaited<ReturnType<typeof BannerAdSize.stickySize>>

/** Reserved banner slot height to avoid layout jumps while loading. */
const BANNER_SLOT_HEIGHT = 60

type AdBannerProps = {
	placement: BannerPlacement
	visible?: boolean
}

/**
 * Reusable Yandex banner slot for Diary / Graphs / Health overview screens.
 * Collapses gracefully on load failure — never retries in a tight loop.
 */
export function AdBanner({ placement, visible = true }: AdBannerProps) {
	if (!visible || Platform.OS !== 'android') {
		return null
	}

	return <AdBannerInner key={placement} placement={placement} />
}

function AdBannerInner({ placement }: { placement: BannerPlacement }) {
	const [loaded, setLoaded] = useState(false)
	const [failed, setFailed] = useState(false)
	const [bannerSize, setBannerSize] = useState<BannerSize | null>(null)
	const adService = getAdService()

	useEffect(() => {
		let cancelled = false
		void BannerAdSize.stickySize(320)
			.then((size) => {
				if (!cancelled) {
					setBannerSize(size)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true)
				}
			})
		return () => {
			cancelled = true
		}
	}, [placement])

	if (failed) {
		return null
	}

	if (!bannerSize) {
		return <View style={[styles.container, { minHeight: BANNER_SLOT_HEIGHT }]} />
	}

	const adUnitId = adService.getBannerAdUnitId(placement)

	return (
		<View
			style={[
				styles.container,
				{ minHeight: loaded ? undefined : BANNER_SLOT_HEIGHT },
			]}
		>
			<BannerView
				adRequest={{ adUnitId }}
				size={bannerSize}
				style={styles.banner}
				onAdLoaded={() => setLoaded(true)}
				onAdFailedToLoad={() => {
					setFailed(true)
					setLoaded(false)
				}}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		overflow: 'hidden',
	},
	banner: {
		width: '100%',
	},
})
