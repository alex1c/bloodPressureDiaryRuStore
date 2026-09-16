import {
	readPersistedAdSessionState,
	writePersistedAdSessionState,
} from './ad-session-persistence'

/** ForestMusic-style cooldown between interstitials. */
const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000
/** Meaningful navigations / analytics actions required before first interstitial. */
const MIN_MEANINGFUL_ACTIONS = 5

export type AdSessionMemoryState = {
	sessionCount: number
	lastInterstitialAt: string | null
	interstitialShownThisSession: boolean
	openedFromMedicationNotification: boolean
	/** Safe tab / period / analytics actions that count toward eligibility. */
	meaningfulActionCount: number
	graphsFocusCount: number
	graphsPeriodChangesThisSession: number
}

let memory: AdSessionMemoryState = {
	sessionCount: 0,
	lastInterstitialAt: null,
	interstitialShownThisSession: false,
	openedFromMedicationNotification: false,
	meaningfulActionCount: 0,
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
		meaningfulActionCount: 0,
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
	meaningfulActionCount?: number
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

/** Records a safe meaningful action (tab period change, graphs revisit, etc.). */
export function recordMeaningfulAdAction(): number {
	memory.meaningfulActionCount += 1
	return memory.meaningfulActionCount
}

export function recordGraphsFocus(): void {
	memory.graphsFocusCount += 1
	recordMeaningfulAdAction()
}

export function recordGraphsPeriodChange(): number {
	memory.graphsPeriodChangesThisSession += 1
	recordMeaningfulAdAction()
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

/**
 * Central interstitial policy — all triggers must consult this gate.
 * Rules: first measurement done, 5 meaningful actions, 5 min cooldown,
 * max 1 per session; never on sensitive / modal / input / notification flows.
 */
export function evaluateInterstitialEligibility(
	input: InterstitialEligibilityInput,
): InterstitialEligibilityResult {
	if (!input.hasCompletedFirstMeasurement) {
		return { eligible: false, reason: 'first_measurement_gate' }
	}
	if (memory.openedFromMedicationNotification) {
		return { eligible: false, reason: 'notification_open' }
	}
	if (memory.meaningfulActionCount < MIN_MEANINGFUL_ACTIONS) {
		return { eligible: false, reason: 'meaningful_actions' }
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
 * Graphs interstitial trigger after a meaningful period change when policy passes.
 * Period change itself already increments meaningfulActionCount.
 */
export function shouldTriggerGraphsInterstitial(
	policy: InterstitialEligibilityResult,
): boolean {
	if (!policy.eligible) {
		return false
	}
	if (memory.graphsPeriodChangesThisSession < 1) {
		return false
	}
	return true
}

export const adPolicyConstants = {
	INTERSTITIAL_COOLDOWN_MS,
	MIN_MEANINGFUL_ACTIONS,
	/** @deprecated Prefer MIN_MEANINGFUL_ACTIONS — kept for older tests/docs. */
	MIN_SESSIONS_FOR_INTERSTITIAL: MIN_MEANINGFUL_ACTIONS,
} as const
