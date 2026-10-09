/**
 * Syncs optional AppMetrica / Yandex Ads with purpose consent.
 *
 * Permission *denies* are applied synchronously in PrivacyConsentProvider.
 * This bootstrap only starts newly granted SDKs and must not revive gates
 * from a stale Accept effect after Reject (permissionGeneration + cancel).
 */

import { useEffect } from 'react'
import {
	getOptionalSdkPhase,
	retryOptionalSdksAfterFailure,
	syncOptionalSdks,
} from '@/services'
import { usePrivacyConsent } from './consent-context'
import { applyYandexUserConsent } from './sdk-consent-bridge'

/** Side-effect bridge — must render under PrivacyConsentProvider. */
export function OptionalSdkBootstrap() {
	const consent = usePrivacyConsent()

	useEffect(() => {
		if (!consent.ready) {
			return
		}

		let cancelled = false
		const analyticsAllowed = consent.analyticsAllowed
		const adsAllowed = consent.adsAllowed
		applyYandexUserConsent(consent.ads)

		void (async () => {
			if (cancelled) {
				return
			}

			// Denies are already on the service gates from the Provider handler.
			// syncOptionalSdks still runs so Accept can start SDKs; generation
			// aborts if Reject applied a newer permission write mid-flight.
			await syncOptionalSdks({
				analyticsAllowed,
				adsAllowed,
			})

			if (cancelled) {
				return
			}

			if (
				getOptionalSdkPhase() === 'failed' &&
				(analyticsAllowed || adsAllowed)
			) {
				await retryOptionalSdksAfterFailure()
			}
		})()

		return () => {
			cancelled = true
		}
	}, [
		consent.ready,
		consent.ads,
		consent.analyticsAllowed,
		consent.adsAllowed,
	])

	return null
}
