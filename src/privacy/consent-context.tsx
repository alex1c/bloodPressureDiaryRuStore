/**
 * App-wide privacy consent gate for optional AppMetrica + Yandex Ads.
 *
 * 1.1.1 session model: every process starts with runtime DENIED. Disk
 * preferences may prefill the UI but never auto-enable SDKs. Explicit save in
 * this process activates only the chosen purposes. Reject applies immediately
 * before disk I/O. Persist failures keep the dialog open with Retry — never
 * pretend success.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import Constants from 'expo-constants'
import { getActiveStoreId } from '@/config/active-store'
import {
	readPersistedPrivacyConsent,
	writePersistedPrivacyConsent,
	type PersistedPrivacyConsent,
	type PurposeDecision,
} from './consent-persistence'
import {
	isConsentPending,
	resolveConsentRequirement,
	type ConsentRequirement,
} from './consent-policy'
import { applyOptionalSdkPermissionsSync } from '@/services'
import { applyYandexUserConsent } from './sdk-consent-bridge'
import {
	applySessionChoice,
	initialSessionRuntime,
	resolveRuntimePermissions,
	type SessionConsentRuntime,
} from './session-consent'

type ConsentContextValue = {
	ready: boolean
	/** Session decisions after confirm; null until first explicit save this process. */
	analytics: PurposeDecision | null
	ads: PurposeDecision | null
	/** Last saved preferences (history / prefill) — not active runtime consent. */
	preferenceAnalytics: PurposeDecision | null
	preferenceAds: PurposeDecision | null
	sessionConfirmed: boolean
	requirement: ConsentRequirement
	pending: boolean
	analyticsAllowed: boolean
	adsAllowed: boolean
	optionalSdksAllowed: boolean
	storageStatus: PersistedPrivacyConsent['storageStatus']
	persistError: string | null
	/** Last attempted purposes when persist failed (for Retry). */
	pendingRetry: { analytics: PurposeDecision; ads: PurposeDecision } | null
	savePurposes: (input: {
		analytics: PurposeDecision
		ads: PurposeDecision
	}) => Promise<void>
	retryPersist: () => Promise<void>
	acceptAll: () => Promise<void>
	declineAll: () => Promise<void>
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

function isProductionRuntime(): boolean {
	const variant = Constants.expoConfig?.extra?.appVariant
	if (variant === 'production') {
		return true
	}
	return !__DEV__
}

export function PrivacyConsentProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false)
	const [session, setSession] = useState<SessionConsentRuntime>(() =>
		initialSessionRuntime(),
	)
	const [preferenceAnalytics, setPreferenceAnalytics] =
		useState<PurposeDecision | null>(null)
	const [preferenceAds, setPreferenceAds] =
		useState<PurposeDecision | null>(null)
	const [analytics, setAnalytics] = useState<PurposeDecision | null>(null)
	const [ads, setAds] = useState<PurposeDecision | null>(null)
	const [storageStatus, setStorageStatus] =
		useState<PersistedPrivacyConsent['storageStatus']>('ok')
	const [persistError, setPersistError] = useState<string | null>(null)
	const [pendingRetry, setPendingRetry] = useState<{
		analytics: PurposeDecision
		ads: PurposeDecision
	} | null>(null)
	const saveGeneration = useRef(0)

	const requirement = useMemo(
		() =>
			resolveConsentRequirement({
				storeId: getActiveStoreId(),
				isProductionRuntime: isProductionRuntime(),
			}),
		[],
	)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			// Cold start: runtime stays DENIED regardless of disk contents.
			setSession(initialSessionRuntime())
			setAnalytics(null)
			setAds(null)

			const persisted = await readPersistedPrivacyConsent()
			if (cancelled) {
				return
			}
			if (
				persisted.storageStatus === 'corrupt' ||
				persisted.storageStatus === 'unavailable' ||
				persisted.storageStatus === 'untrusted'
			) {
				setPreferenceAnalytics(null)
				setPreferenceAds(null)
			} else {
				// Preferences for UI history only — not session runtime.
				setPreferenceAnalytics(persisted.analytics)
				setPreferenceAds(persisted.ads)
			}
			setStorageStatus(persisted.storageStatus)
			setReady(true)
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const savePurposes = useCallback(
		async (input: { analytics: PurposeDecision; ads: PurposeDecision }) => {
			const generation = ++saveGeneration.current

			// Immediate in-memory session apply (Reject disables SDKs before disk).
			const nextSession = applySessionChoice(input)
			setSession(nextSession)
			setAnalytics(input.analytics)
			setAds(input.ads)
			setPreferenceAnalytics(input.analytics)
			setPreferenceAds(input.ads)
			setPersistError(null)
			setPendingRetry(null)
			applyYandexUserConsent(input.ads)

			// First-party service gates flip HERE — before render, useEffect, or I/O.
			// Bootstrap may start newly granted SDKs asynchronously afterward.
			applyOptionalSdkPermissionsSync({
				analyticsAllowed: nextSession.analyticsAllowed,
				adsAllowed: nextSession.adsAllowed,
			})

			try {
				const next = await writePersistedPrivacyConsent(input)
				if (generation !== saveGeneration.current) {
					return
				}
				setStorageStatus(next.storageStatus)
				if (next.storageStatus === 'unavailable') {
					setPersistError('storage_unavailable')
					setPendingRetry(input)
					throw new Error('storage_unavailable')
				}
			} catch (error) {
				if (generation !== saveGeneration.current) {
					return
				}
				setStorageStatus('unavailable')
				setPersistError(
					error instanceof Error ? error.message : 'consent_persist_failed',
				)
				setPendingRetry(input)
				// Do not roll session back to a prior Accept — keep the explicit
				// choice; disk failure must not revive an older grant on disk as
				// "success". UI stays open via pendingRetry.
				throw error
			}
		},
		[],
	)

	const retryPersist = useCallback(async () => {
		if (!pendingRetry) {
			return
		}
		await savePurposes(pendingRetry)
	}, [pendingRetry, savePurposes])

	const acceptAll = useCallback(async () => {
		await savePurposes({ analytics: 'granted', ads: 'granted' })
	}, [savePurposes])

	const declineAll = useCallback(async () => {
		await savePurposes({ analytics: 'denied', ads: 'denied' })
	}, [savePurposes])

	const value = useMemo<ConsentContextValue>(() => {
		const runtime = resolveRuntimePermissions({
			session,
			requirementRequiresExplicitConsent:
				requirement.requiresExplicitConsent,
		})
		const state = { analytics, ads }
		return {
			ready,
			analytics,
			ads,
			preferenceAnalytics,
			preferenceAds,
			sessionConfirmed: session.sessionConfirmed,
			requirement,
			pending:
				isConsentPending(state, requirement) ||
				(requirement.requiresExplicitConsent &&
					!session.sessionConfirmed) ||
				pendingRetry !== null,
			analyticsAllowed: runtime.analyticsAllowed,
			adsAllowed: runtime.adsAllowed,
			optionalSdksAllowed:
				runtime.analyticsAllowed || runtime.adsAllowed,
			storageStatus,
			persistError,
			pendingRetry,
			savePurposes,
			retryPersist,
			acceptAll,
			declineAll,
		}
	}, [
		ready,
		analytics,
		ads,
		preferenceAnalytics,
		preferenceAds,
		session,
		requirement,
		storageStatus,
		persistError,
		pendingRetry,
		savePurposes,
		retryPersist,
		acceptAll,
		declineAll,
	])

	return (
		<ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
	)
}

export function usePrivacyConsent(): ConsentContextValue {
	const ctx = useContext(ConsentContext)
	if (!ctx) {
		throw new Error('usePrivacyConsent must be used within PrivacyConsentProvider')
	}
	return ctx
}

export function usePrivacyConsentOptional(): ConsentContextValue {
	const ctx = useContext(ConsentContext)
	if (ctx) {
		return ctx
	}
	return {
		ready: true,
		analytics: 'granted',
		ads: 'granted',
		preferenceAnalytics: 'granted',
		preferenceAds: 'granted',
		sessionConfirmed: true,
		requirement: {
			requiresExplicitConsent: false,
			reason: 'missing_provider_fallback',
			isFirstPartyGateOnly: true,
			blocksGoogleDemandUntilCmp: true,
			adsPersonalizationSeparable: false,
		},
		pending: false,
		analyticsAllowed: true,
		adsAllowed: true,
		optionalSdksAllowed: true,
		storageStatus: 'ok',
		persistError: null,
		pendingRetry: null,
		savePurposes: async () => {},
		retryPersist: async () => {},
		acceptAll: async () => {},
		declineAll: async () => {},
	}
}
