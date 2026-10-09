/**
 * Temporary 1.1.1 consent model: disk preferences never auto-enable SDKs.
 *
 * Every new JS process starts with runtime analytics/ads DENIED until the user
 * explicitly confirms choices in this session. Saved preferences may prefill
 * the UI but must not be treated as active consent.
 */

import type { PurposeDecision } from './consent-persistence'

export type SessionConsentRuntime = {
	/** True only after an explicit save in the current process. */
	sessionConfirmed: boolean
	analyticsAllowed: boolean
	adsAllowed: boolean
}

/** Cold-start / new-process defaults — always DENIED until session confirm. */
export function initialSessionRuntime(): SessionConsentRuntime {
	return {
		sessionConfirmed: false,
		analyticsAllowed: false,
		adsAllowed: false,
	}
}

/**
 * Applies an explicit in-session choice. Mixed combinations are independent —
 * denying one purpose does not force-deny the other.
 */
export function applySessionChoice(input: {
	analytics: PurposeDecision
	ads: PurposeDecision
}): SessionConsentRuntime {
	return {
		sessionConfirmed: true,
		analyticsAllowed: input.analytics === 'granted',
		adsAllowed: input.ads === 'granted',
	}
}

/**
 * Maps persisted preferences + session gate → first-party SDK enablement.
 * Preferences alone never enable SDKs (process B after Accept on disk).
 */
export function resolveRuntimePermissions(input: {
	session: SessionConsentRuntime
	requirementRequiresExplicitConsent: boolean
}): Pick<SessionConsentRuntime, 'analyticsAllowed' | 'adsAllowed'> {
	if (!input.requirementRequiresExplicitConsent) {
		return {
			analyticsAllowed: true,
			adsAllowed: true,
		}
	}
	if (!input.session.sessionConfirmed) {
		return {
			analyticsAllowed: false,
			adsAllowed: false,
		}
	}
	return {
		analyticsAllowed: input.session.analyticsAllowed,
		adsAllowed: input.session.adsAllowed,
	}
}
