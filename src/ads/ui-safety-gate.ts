/**
 * Live UI safety for interstitials (Graphs-only in this release).
 *
 * Any unknown signal → do not show.
 */

let blockingModalCount = 0
let keyboardVisible = false
let keyboardKnown = false
let keyboardSubscribed = false
let graphsScreenFocused = false
/** Last pathname reported by navigation — used for fresh pre-show probes. */
let lastKnownPathname: string | null = null

function ensureKeyboardSubscription(): void {
	if (keyboardSubscribed) {
		return
	}
	keyboardSubscribed = true
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Keyboard } = require('react-native') as typeof import('react-native')
		try {
			if (typeof Keyboard.isVisible === 'function') {
				keyboardVisible = Keyboard.isVisible()
				keyboardKnown = true
			}
		} catch {
			keyboardKnown = false
		}
		try {
			Keyboard.addListener('keyboardDidShow', () => {
				keyboardVisible = true
				keyboardKnown = true
			})
			Keyboard.addListener('keyboardDidHide', () => {
				keyboardVisible = false
				keyboardKnown = true
			})
			// Cold start: if isVisible is unavailable, assume hidden until DidShow.
			// Waiting for the first keyboard event would permanently block interstitials
			// for users who never open the keyboard on Graphs.
			if (!keyboardKnown) {
				keyboardVisible = false
				keyboardKnown = true
			}
		} catch {
			// Listener failure → treat keyboard as unknown; never confirm UI.
			keyboardKnown = false
		}
	} catch {
		/* Jest / non-RN — keyboard stays unknown → interstitial blocked */
		keyboardKnown = false
	}
}

export function beginBlockingModal(): void {
	blockingModalCount += 1
}

export function endBlockingModal(): void {
	blockingModalCount = Math.max(0, blockingModalCount - 1)
}

/** Graphs screen focus — required for interstitial in this app version. */
export function setGraphsScreenFocused(focused: boolean): void {
	graphsScreenFocused = focused
}

/** Keep a live navigation path for pre-show refresh (stale guard snapshots). */
export function reportNavigationPathname(
	pathname: string | null | undefined,
): void {
	lastKnownPathname =
		typeof pathname === 'string' && pathname.length > 0 ? pathname : null
}

export function isGraphsPath(pathname: string | null | undefined): boolean {
	if (!pathname) {
		return false
	}
	return (
		pathname === '/graphs' ||
		pathname.endsWith('/graphs') ||
		pathname.includes('/(tabs)/graphs')
	)
}

export function isSensitivePath(pathname: string | null | undefined): boolean {
	if (!pathname) {
		return true
	}
	if (isGraphsPath(pathname)) {
		return false
	}
	return true
}

export type LiveInterstitialUiState = {
	hasBlockingModal: boolean
	hasKeyboardOrInputFlow: boolean
	onSensitiveScreen: boolean
	/** True only when Graphs is focused, path known, keyboard known. */
	uiStateConfirmed: boolean
	graphsFocused: boolean
	keyboardKnown: boolean
}

export function getLiveInterstitialUiState(
	pathname?: string | null,
): LiveInterstitialUiState {
	ensureKeyboardSubscription()
	const resolved =
		typeof pathname === 'string' && pathname.length > 0
			? pathname
			: lastKnownPathname
	const pathKnown = typeof resolved === 'string' && resolved.length > 0
	const onGraphs =
		pathKnown && isGraphsPath(resolved) && graphsScreenFocused
	const uiStateConfirmed =
		pathKnown &&
		onGraphs &&
		keyboardKnown &&
		!keyboardVisible &&
		blockingModalCount === 0

	return {
		hasBlockingModal: blockingModalCount > 0,
		hasKeyboardOrInputFlow: !keyboardKnown || keyboardVisible,
		onSensitiveScreen: !onGraphs,
		uiStateConfirmed,
		graphsFocused: graphsScreenFocused,
		keyboardKnown,
	}
}

/** @internal */
export function resetUiSafetyGateForTests(): void {
	blockingModalCount = 0
	keyboardVisible = false
	keyboardKnown = false
	keyboardSubscribed = false
	graphsScreenFocused = false
	lastKnownPathname = null
}

/** @internal */
export function setKeyboardStateForTests(input: {
	visible: boolean
	known: boolean
}): void {
	keyboardVisible = input.visible
	keyboardKnown = input.known
	keyboardSubscribed = true
}
