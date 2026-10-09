/**
 * Yandex Mobile Ads adapter — live consent revoke + attempt-scoped interstitial callbacks.
 */

import Constants from 'expo-constants'
import { MobileAds, InterstitialAdLoader } from 'yandex-mobile-ads'
import type { InterstitialAd } from 'yandex-mobile-ads'
import {
	resolveAdRuntimeVariant,
	resolveBannerAdUnitId,
	resolveInterstitialAdUnitId,
	type BannerPlacement,
} from '@/config/ads'
import { getActiveStoreId } from '@/config/active-store'
import {
	beginAdSessionOnce,
	evaluateInterstitialEligibility,
	markInterstitialShown,
	shouldTriggerGraphsInterstitial,
	type InterstitialEligibilityInput,
} from './ad-policy'

let initialized = false
let interstitialReady = false
let interstitialAd: InterstitialAd | null = null
let interstitialLoader: InterstitialAdLoader | null = null
let interstitialShowInFlight = false
let adsAllowed = false
let consentEpoch = 0
let initializeInFlight: Promise<void> | null = null
/** Monotonic id so late callbacks from ad A cannot mutate attempt B. */
let nextShowAttemptId = 1
let activeShowAttemptId: number | null = null
/** Missing-callback watchdog (ms). */
const SHOW_WATCHDOG_MS = 15_000
let showWatchdogTimer: ReturnType<typeof setTimeout> | null = null

function runtimeVariant() {
	return resolveAdRuntimeVariant(
		Constants.expoConfig?.extra?.appVariant as string | undefined,
	)
}

function runtimeStoreId() {
	return getActiveStoreId()
}

function clearPreloadedInterstitial(): void {
	interstitialReady = false
	interstitialAd = null
}

function clearShowWatchdog(): void {
	if (showWatchdogTimer) {
		clearTimeout(showWatchdogTimer)
		showWatchdogTimer = null
	}
}

export function resetYandexAdServiceForTests(): void {
	clearShowWatchdog()
	initialized = false
	interstitialReady = false
	interstitialAd = null
	interstitialLoader = null
	interstitialShowInFlight = false
	adsAllowed = false
	consentEpoch = 0
	initializeInFlight = null
	nextShowAttemptId = 1
	activeShowAttemptId = null
}

export function getAdsAllowedForTests(): boolean {
	return adsAllowed
}

export function getConsentEpochForTests(): number {
	return consentEpoch
}

export function getActiveShowAttemptIdForTests(): number | null {
	return activeShowAttemptId
}

/**
 * Stage breadcrumbs for interstitial diagnostics (no PII / medical values).
 * Dev-only — do not spam production logcat after QA.
 */
function logIntStage(stage: string, detail?: string): void {
	if (typeof __DEV__ === 'undefined' || !__DEV__) {
		return
	}
	const suffix = detail ? ` ${detail}` : ''
	console.info(`[ads.int] ${stage}${suffix}`)
}

async function preloadInterstitialInternal(epoch: number): Promise<void> {
	if (!initialized || !adsAllowed || epoch !== consentEpoch) {
		logIntStage('PRELOAD', 'skipped_not_active')
		return
	}

	try {
		logIntStage(
			'PRELOAD',
			`unit=${resolveInterstitialAdUnitId(runtimeVariant(), runtimeStoreId())}`,
		)
		interstitialLoader ??= await InterstitialAdLoader.create()
		if (!adsAllowed || epoch !== consentEpoch) {
			clearPreloadedInterstitial()
			return
		}
		const loaded = await interstitialLoader.loadAd({
			adUnitId: resolveInterstitialAdUnitId(
				runtimeVariant(),
				runtimeStoreId(),
			),
		})
		if (!adsAllowed || epoch !== consentEpoch) {
			clearPreloadedInterstitial()
			return
		}
		interstitialAd = loaded
		interstitialReady = Boolean(interstitialAd)
		logIntStage('LOAD', interstitialReady ? 'success' : 'empty')
	} catch (error) {
		interstitialReady = false
		interstitialAd = null
		logIntStage('LOAD', 'failure')
		if (__DEV__) {
			console.warn('[ads] interstitial preload failed', error)
		}
	}
}

export type LiveUiRefreshSnapshot = {
	uiStateConfirmed: boolean
	hasBlockingModal: boolean
	hasKeyboardOrInputFlow: boolean
	onSensitiveScreen: boolean
}

export type InterstitialShowGuard = Omit<
	InterstitialEligibilityInput,
	'interstitialReady'
> & {
	uiStateConfirmed?: boolean
	/**
	 * Mandatory fresh UI probe immediately before native show().
	 * Omission / throw / unconfirmed → show blocked (no stale-snapshot fallback).
	 */
	refreshUiState?: () => LiveUiRefreshSnapshot
}

export function createYandexAdService() {
	return {
		setAdsAllowed(allowed: boolean) {
			if (adsAllowed === allowed) {
				try {
					MobileAds.setUserConsent(allowed)
				} catch {
					/* native unavailable */
				}
				return
			}
			adsAllowed = allowed
			consentEpoch += 1
			try {
				MobileAds.setUserConsent(allowed)
			} catch {
				/* native unavailable */
			}
			if (!allowed) {
				clearPreloadedInterstitial()
				// Do not clear activeShowAttemptId — in-flight show may still fire
				// onAdShown and must record cooldown; new shows stay blocked by adsAllowed.
				// Leave initializeInFlight running so it exits via epoch/adsAllowed checks
				// (do not start a parallel initialize).
				initialized = false
			}
		},

		isAdsAllowed() {
			return adsAllowed
		},

		async initialize() {
			if (!adsAllowed) {
				return
			}
			if (initialized) {
				return
			}
			if (initializeInFlight) {
				await initializeInFlight
				return
			}

			const epoch = consentEpoch
			initializeInFlight = (async () => {
				try {
					await MobileAds.initialize()
					if (!adsAllowed || epoch !== consentEpoch) {
						return
					}
					initialized = true
					await beginAdSessionOnce()
					if (!adsAllowed || epoch !== consentEpoch) {
						clearPreloadedInterstitial()
						initialized = false
						return
					}
					await preloadInterstitialInternal(epoch)
					if (!adsAllowed || epoch !== consentEpoch) {
						clearPreloadedInterstitial()
						initialized = false
					}
				} catch (error) {
					initialized = false
					if (__DEV__) {
						console.warn('[ads] MobileAds.initialize failed', error)
					}
					throw error
				} finally {
					initializeInFlight = null
				}
			})()

			await initializeInFlight
		},

		async preloadInterstitial() {
			if (!adsAllowed || !initialized) {
				return
			}
			await preloadInterstitialInternal(consentEpoch)
		},

		canShowAds(context: { hasCompletedFirstMeasurement: boolean }) {
			return adsAllowed && context.hasCompletedFirstMeasurement === true
		},

		getBannerAdUnitId(placement: BannerPlacement) {
			return resolveBannerAdUnitId(
				placement,
				runtimeVariant(),
				runtimeStoreId(),
			)
		},

		isInterstitialReady() {
			return adsAllowed && interstitialReady
		},

		evaluateInterstitial(
			input: Omit<InterstitialEligibilityInput, 'interstitialReady'>,
		) {
			if (!adsAllowed) {
				return evaluateInterstitialEligibility({
					...input,
					interstitialReady: false,
				})
			}
			return evaluateInterstitialEligibility({
				...input,
				interstitialReady,
			})
		},

		maybeShowGraphsInterstitial(input: InterstitialShowGuard) {
			if (!adsAllowed) {
				logIntStage('ELIGIBILITY', 'ads_not_allowed')
				return
			}
			// Fresh UI callback is mandatory — never show from a stale snapshot alone.
			if (typeof input.refreshUiState !== 'function') {
				logIntStage('ELIGIBILITY', 'missing_refresh_ui')
				return
			}
			const policy = evaluateInterstitialEligibility({
				...input,
				interstitialReady,
			})
			if (!shouldTriggerGraphsInterstitial(policy)) {
				// Inventory miss alone: retry preload without relaxing other gates.
				if (policy.reason === 'not_ready') {
					const wouldShow = evaluateInterstitialEligibility({
						...input,
						interstitialReady: true,
					})
					if (shouldTriggerGraphsInterstitial(wouldShow)) {
						logIntStage('PRELOAD', 'retry_after_not_ready')
						void this.preloadInterstitial()
					} else {
						logIntStage(
							'ELIGIBILITY',
							wouldShow.reason ?? 'not_ready_and_gated',
						)
					}
					return
				}
				logIntStage('ELIGIBILITY', policy.reason ?? 'not_eligible')
				return
			}
			logIntStage('SHOW', 'try_show')
			void this.tryShowInterstitial(input)
		},

		async tryShowInterstitial(guard?: InterstitialShowGuard) {
			if (!guard) {
				if (__DEV__) {
					console.warn('[ads] tryShowInterstitial requires a live guard')
				}
				return
			}
			if (typeof guard.refreshUiState !== 'function') {
				return
			}
			if (!adsAllowed || interstitialShowInFlight) {
				logIntStage('SHOW', 'blocked_in_flight_or_consent')
				return
			}
			if (!interstitialReady || !interstitialAd) {
				logIntStage('SHOW', 'not_ready')
				return
			}

			const epochAtStart = consentEpoch
			const recheck = evaluateInterstitialEligibility({
				...guard,
				interstitialReady: true,
			})
			if (!recheck.eligible || !adsAllowed) {
				logIntStage('SHOW', recheck.reason ?? 'recheck_blocked')
				return
			}

			const ad = interstitialAd
			interstitialReady = false
			interstitialAd = null
			interstitialShowInFlight = true

			const attemptId = nextShowAttemptId++
			activeShowAttemptId = attemptId
			let terminal = false
			let shownRecorded = false

			const finishAttempt = (opts: { preload: boolean }) => {
				if (terminal) {
					return
				}
				terminal = true
				clearShowWatchdog()
				if (activeShowAttemptId === attemptId) {
					activeShowAttemptId = null
					interstitialShowInFlight = false
				}
				if (
					opts.preload &&
					adsAllowed &&
					epochAtStart === consentEpoch
				) {
					void preloadInterstitialInternal(consentEpoch)
				}
			}

			ad.onAdShown = () => {
				if (terminal && shownRecorded) {
					return
				}
				if (activeShowAttemptId !== attemptId && shownRecorded) {
					return
				}
				// Stale attempt A after B started: ignore unless this is still active.
				if (activeShowAttemptId !== attemptId) {
					return
				}
				if (shownRecorded) {
					return
				}
				shownRecorded = true
				logIntStage('CALLBACK', 'onAdShown')
				// Record cooldown even if Reject happened after show() — show occurred.
				void markInterstitialShown()
				// Do not preload when ads no longer allowed.
				if (!adsAllowed || epochAtStart !== consentEpoch) {
					/* wait for dismiss/fail/watchdog to release lock */
				}
			}

			ad.onAdFailedToShow = () => {
				if (activeShowAttemptId !== attemptId) {
					return
				}
				logIntStage('CALLBACK', 'onAdFailedToShow')
				clearPreloadedInterstitial()
				finishAttempt({ preload: adsAllowed })
			}

			ad.onAdDismissed = () => {
				if (activeShowAttemptId !== attemptId) {
					return
				}
				logIntStage('CALLBACK', 'onAdDismissed')
				finishAttempt({ preload: adsAllowed })
			}

			// Missing callbacks: release lock without allowing another uncapped show —
			// if shown was not recorded, still consume the session slot conservatively.
			clearShowWatchdog()
			showWatchdogTimer = setTimeout(() => {
				if (activeShowAttemptId !== attemptId || terminal) {
					return
				}
				if (!shownRecorded) {
					void markInterstitialShown()
					shownRecorded = true
				}
				finishAttempt({ preload: false })
			}, SHOW_WATCHDOG_MS)

			try {
				if (!adsAllowed || epochAtStart !== consentEpoch) {
					finishAttempt({ preload: false })
					return
				}
				// Mandatory fresh UI probe — prior guard.uiStateConfirmed is ignored.
				let live: LiveUiRefreshSnapshot
				try {
					live = guard.refreshUiState()
				} catch {
					finishAttempt({ preload: adsAllowed })
					return
				}
				if (live.uiStateConfirmed !== true) {
					finishAttempt({ preload: adsAllowed })
					return
				}
				const liveGuard = {
					...guard,
					hasBlockingModal: live.hasBlockingModal,
					hasKeyboardOrInputFlow: live.hasKeyboardOrInputFlow,
					onSensitiveScreen: live.onSensitiveScreen,
					uiStateConfirmed: live.uiStateConfirmed,
				}
				const finalCheck = evaluateInterstitialEligibility({
					...liveGuard,
					interstitialReady: true,
				})
				if (!finalCheck.eligible || !adsAllowed) {
					logIntStage('SHOW', finalCheck.reason ?? 'final_ui_blocked')
					finishAttempt({ preload: false })
					return
				}
				logIntStage('SHOW', 'native_show')
				void ad.show().catch(() => {
					if (activeShowAttemptId !== attemptId) {
						return
					}
					logIntStage('CALLBACK', 'show_promise_rejected')
					if (!shownRecorded) {
						clearPreloadedInterstitial()
						finishAttempt({ preload: adsAllowed })
					}
				})
			} catch (error) {
				logIntStage('SHOW', 'native_show_threw')
				if (__DEV__) {
					console.warn('[ads] interstitial show failed', error)
				}
				finishAttempt({ preload: adsAllowed })
			}
		},
	}
}

export type YandexAdService = ReturnType<typeof createYandexAdService>
