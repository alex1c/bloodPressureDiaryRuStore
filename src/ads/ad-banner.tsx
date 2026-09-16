import { useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { BannerAdSize, BannerView } from 'yandex-mobile-ads'
import type { BannerPlacement } from '@/config/ads'
import { getAdService } from './index'

type BannerSize = Awaited<ReturnType<typeof BannerAdSize.stickySize>>

/** Reserved banner slot height to avoid layout jumps while loading. */
const BANNER_SLOT_HEIGHT = 60

/** Initial delay before first retry after a transient load failure. */
const RETRY_BASE_MS = 8_000
/** Cap backoff so we never hammer the ad network. */
const RETRY_MAX_MS = 120_000
/** Hard ceiling on automatic retries per banner mount lifetime. */
const RETRY_MAX_ATTEMPTS = 6

type AdBannerProps = {
	placement: BannerPlacement
	visible?: boolean
}

/**
 * Reusable Yandex banner slot for Diary / Graphs / Health overview screens.
 * Transient load failures keep the slot and retry with bounded exponential backoff.
 */
export function AdBanner({ placement, visible = true }: AdBannerProps) {
	if (!visible || Platform.OS !== 'android') {
		return null
	}

	return <AdBannerInner key={placement} placement={placement} />
}

function AdBannerInner({ placement }: { placement: BannerPlacement }) {
	const [loaded, setLoaded] = useState(false)
	const [bannerSize, setBannerSize] = useState<BannerSize | null>(null)
	const [requestKey, setRequestKey] = useState(0)
	const [attempt, setAttempt] = useState(0)
	const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const adService = getAdService()
	const adUnitId = adService.getBannerAdUnitId(placement)

	useEffect(() => {
		let cancelled = false
		void BannerAdSize.stickySize(320)
			.then((size) => {
				if (!cancelled) {
					setBannerSize(size)
				}
			})
			.catch((error) => {
				if (__DEV__) {
					console.warn('[ads] AD FAILED size resolve', placement, error)
				}
			})
		return () => {
			cancelled = true
		}
	}, [placement])

	useEffect(() => {
		return () => {
			if (retryTimer.current) {
				clearTimeout(retryTimer.current)
				retryTimer.current = null
			}
		}
	}, [])

	useEffect(() => {
		if (__DEV__ && bannerSize) {
			console.log('[ads] AD REQUEST', placement, adUnitId, {
				attempt,
				requestKey,
			})
		}
	}, [placement, adUnitId, attempt, requestKey, bannerSize])

	function scheduleRetry(nextAttempt: number) {
		if (nextAttempt > RETRY_MAX_ATTEMPTS) {
			if (__DEV__) {
				console.warn('[ads] AD RETRY exhausted', placement, nextAttempt)
			}
			return
		}
		const delay = Math.min(
			RETRY_MAX_MS,
			RETRY_BASE_MS * 2 ** Math.max(0, nextAttempt - 1),
		)
		if (__DEV__) {
			console.log('[ads] AD RETRY', placement, {
				attempt: nextAttempt,
				delayMs: delay,
			})
		}
		if (retryTimer.current) {
			clearTimeout(retryTimer.current)
		}
		retryTimer.current = setTimeout(() => {
			setAttempt(nextAttempt)
			setLoaded(false)
			setRequestKey((k) => k + 1)
		}, delay)
	}

	if (!bannerSize) {
		return (
			<View style={[styles.container, { minHeight: BANNER_SLOT_HEIGHT }]} />
		)
	}

	return (
		<View
			style={[
				styles.container,
				{ minHeight: loaded ? undefined : BANNER_SLOT_HEIGHT },
			]}
		>
			<BannerView
				key={`${placement}-${requestKey}`}
				adRequest={{ adUnitId }}
				size={bannerSize}
				style={styles.banner}
				onAdLoaded={() => {
					if (__DEV__) {
						console.log('[ads] AD LOADED', placement, adUnitId)
					}
					setLoaded(true)
					setAttempt(0)
					if (retryTimer.current) {
						clearTimeout(retryTimer.current)
						retryTimer.current = null
					}
				}}
				onAdFailedToLoad={(error) => {
					if (__DEV__) {
						console.warn('[ads] AD FAILED', placement, adUnitId, error)
					}
					setLoaded(false)
					scheduleRetry(attempt + 1)
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
