import {
	readPersistedAdSessionState,
	writePersistedAdSessionState,
} from './ad-session-persistence'

const INTERSTITIAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
const MIN_SESSIONS_FOR_INTERSTITIAL = 4

export type AdSessionMemoryState = {
	sessionCount: number
	lastInterstitialAt: string | null
	interstitialShownThisSession: boolean
	openedFromMedicationNotification: boolean
	graphsFocusCount: number
	graphsPeriodChangesThisSession: number
}

let memory: AdSessionMemoryState = {
	sessionCount: 0,
	lastInterstitialAt: null,
	interstitialShownThisSession: false,
	openedFromMedicationNotification: false,
	graphsFocusCount: 0,
	graphsPeriodChangesThisSession: 0,
}

let sessionStarted = false

/** Resets in-memory ad session state for tests. */
export function resetAdSessionMemoryForTests(): void {
	memory = {
		sessionCount: 0,
		lastInterstitialAt: null,
		interstitialShownThisSession: false,
		openedFromMedicationNotification: false,
		graphsFocusCount: 0,
		graphsPeriodChangesThisSession: 0,
	}
	sessionStarted = false
}

export function getAdSessionMemoryState(): Readonly<AdSessionMemoryState> {
	return memory
}

/** Overrides persisted counters in tests/debug without waiting real sessions. */
export function overrideAdSessionStateForTests(input: {
	sessionCount?: number
	lastInterstitialAt?: string | null
	interstitialShownThisSession?: boolean
	openedFromMedicationNotification?: boolean
}): void {
	memory = {
		...memory,
		...input,
	}
}

/**
 * Increments session count once per real app session start.
 * React remounts must not inflate the counter.
 */
export async function beginAdSessionOnce(): Promise<void> {
	if (sessionStarted) {
		return
	}
	sessionStarted = true

	const persisted = await readPersistedAdSessionState()
	memory.sessionCount = persisted.sessionCount + 1
	memory.lastInterstitialAt = persisted.lastInterstitialAt

	await writePersistedAdSessionState({
		sessionCount: memory.sessionCount,
		lastInterstitialAt: memory.lastInterstitialAt,
	})
}

export function markOpenedFromMedicationNotification(): void {
	memory.openedFromMedicationNotification = true
}

export function recordGraphsFocus(): void {
	memory.graphsFocusCount += 1
}

export function recordGraphsPeriodChange(): number {
	memory.graphsPeriodChangesThisSession += 1
	return memory.graphsPeriodChangesThisSession
}

export async function markInterstitialShown(now = new Date()): Promise<void> {
	memory.interstitialShownThisSession = true
	memory.lastInterstitialAt = now.toISOString()
	await writePersistedAdSessionState({
		sessionCount: memory.sessionCount,
		lastInterstitialAt: memory.lastInterstitialAt,
	})
}

export type InterstitialEligibilityInput = {
	hasCompletedFirstMeasurement: boolean
	interstitialReady: boolean
	hasBlockingModal: boolean
	hasKeyboardOrInputFlow: boolean
	onSensitiveScreen: boolean
	now?: Date
}

export type InterstitialEligibilityResult = {
	eligible: boolean
	reason?: string
}

/** Central interstitial policy — all triggers must consult this gate. */
export function evaluateInterstitialEligibility(
	input: InterstitialEligibilityInput,
): InterstitialEligibilityResult {
	if (!input.hasCompletedFirstMeasurement) {
		return { eligible: false, reason: 'first_measurement_gate' }
	}
	if (memory.openedFromMedicationNotification) {
		return { eligible: false, reason: 'notification_open' }
	}
	if (memory.sessionCount < MIN_SESSIONS_FOR_INTERSTITIAL) {
		return { eligible: false, reason: 'session_count' }
	}
	if (memory.interstitialShownThisSession) {
		return { eligible: false, reason: 'already_shown_session' }
	}
	if (memory.lastInterstitialAt) {
		const last = Date.parse(memory.lastInterstitialAt)
		const now = input.now ?? new Date()
		if (!Number.isNaN(last) && now.getTime() - last < INTERSTITIAL_COOLDOWN_MS) {
			return { eligible: false, reason: 'cooldown' }
		}
	}
	if (input.onSensitiveScreen) {
		return { eligible: false, reason: 'sensitive_screen' }
	}
	if (input.hasBlockingModal) {
		return { eligible: false, reason: 'modal' }
	}
	if (input.hasKeyboardOrInputFlow) {
		return { eligible: false, reason: 'input_flow' }
	}
	if (!input.interstitialReady) {
		return { eligible: false, reason: 'not_ready' }
	}
	return { eligible: true }
}

/**
 * Graphs interstitial trigger:
 * - not on first Graphs visit in the session;
 * - at least one period change in the session;
 * - policy eligibility must pass.
 */
export function shouldTriggerGraphsInterstitial(
	policy: InterstitialEligibilityResult,
): boolean {
	if (!policy.eligible) {
		return false
	}
	if (memory.graphsFocusCount < 2) {
		return false
	}
	if (memory.graphsPeriodChangesThisSession < 1) {
		return false
	}
	return true
}

export const adPolicyConstants = {
	INTERSTITIAL_COOLDOWN_MS,
	MIN_SESSIONS_FOR_INTERSTITIAL,
} as const
