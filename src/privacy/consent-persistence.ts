/**
 * Preference persistence for analytics / ads purposes (1.1.1).
 *
 * Disk storage is history/preferences only. It NEVER auto-enables optional
 * SDKs — every process starts with runtime DENIED until an explicit session
 * confirm (see session-consent.ts).
 *
 * All four purpose combinations are written independently. A partial deny
 * (e.g. analytics denied + ads granted) is not coerced into a full Reject.
 *
 * Legacy / trust / deny-intent files may still exist from prior builds; they
 * are read only as preference hints and never as automatic SDK grants.
 * Medical diary data is never touched here.
 */

import * as FileSystem from 'expo-file-system/legacy'

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}privacy-consent-v2.json`
const LEGACY_STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}privacy-consent-v1.json`
/** Retained path for tests / leftover files from prior builds — not used to enable SDKs. */
const DENY_INTENT_FILE = `${FileSystem.documentDirectory ?? ''}privacy-consent-deny-intent.json`
const TRUST_FILE = `${FileSystem.documentDirectory ?? ''}privacy-consent-trust.json`

export type PurposeDecision = 'granted' | 'denied'

export type ConsentStorageStatus =
	| 'ok'
	| 'unavailable'
	| 'corrupt'
	/** Storage probes failed — preferences unknown; runtime stays DENIED. */
	| 'untrusted'

export type PersistedPrivacyConsent = {
	analytics: PurposeDecision | null
	ads: PurposeDecision | null
	updatedAtIso: string | null
	storageStatus: ConsentStorageStatus
}

const UNDECIDED: PersistedPrivacyConsent = {
	analytics: null,
	ads: null,
	updatedAtIso: null,
	storageStatus: 'ok',
}

let writeChain: Promise<unknown> = Promise.resolve()

function parsePurposes(raw: unknown): PersistedPrivacyConsent | null {
	if (!raw || typeof raw !== 'object') {
		return null
	}
	const obj = raw as Record<string, unknown>

	if (obj.choice === 'accepted') {
		return {
			analytics: 'granted',
			ads: 'granted',
			updatedAtIso:
				typeof obj.updatedAtIso === 'string' ? obj.updatedAtIso : null,
			storageStatus: 'ok',
		}
	}
	if (obj.choice === 'declined') {
		return {
			analytics: 'denied',
			ads: 'denied',
			updatedAtIso:
				typeof obj.updatedAtIso === 'string' ? obj.updatedAtIso : null,
			storageStatus: 'ok',
		}
	}

	const analytics =
		obj.analytics === 'granted' || obj.analytics === 'denied'
			? obj.analytics
			: null
	const ads =
		obj.ads === 'granted' || obj.ads === 'denied' ? obj.ads : null

	if (
		obj.analytics !== undefined &&
		obj.analytics !== null &&
		analytics === null
	) {
		return null
	}
	if (obj.ads !== undefined && obj.ads !== null && ads === null) {
		return null
	}

	return {
		analytics,
		ads,
		updatedAtIso:
			typeof obj.updatedAtIso === 'string' ? obj.updatedAtIso : null,
		storageStatus: 'ok',
	}
}

type ProbeResult =
	| { kind: 'missing' }
	| { kind: 'error' }
	| { kind: 'present'; body: string }

async function probeFile(path: string): Promise<ProbeResult> {
	try {
		const info = await FileSystem.getInfoAsync(path)
		if (!info.exists) {
			return { kind: 'missing' }
		}
		const body = await FileSystem.readAsStringAsync(path)
		return { kind: 'present', body }
	} catch {
		return { kind: 'error' }
	}
}

async function deleteIfExists(path: string): Promise<void> {
	try {
		const info = await FileSystem.getInfoAsync(path)
		if (!info.exists) {
			return
		}
		await FileSystem.deleteAsync(path, { idempotent: true })
	} catch {
		/* best-effort — preferences write already succeeded or will throw */
	}
}

/** True when both purposes are denied (full opt-out). */
export function isFullDenyWrite(input: {
	analytics: PurposeDecision
	ads: PurposeDecision
}): boolean {
	return input.analytics === 'denied' && input.ads === 'denied'
}

/** @deprecated Prefer {@link isFullDenyWrite}. Kept for import compatibility. */
export function isRejectWrite(input: {
	analytics: PurposeDecision
	ads: PurposeDecision
}): boolean {
	return isFullDenyWrite(input)
}

/**
 * Reads saved preferences for UI history / prefill only.
 * Callers must NOT treat a granted preference as runtime SDK permission.
 */
export async function readPersistedPrivacyConsent(): Promise<PersistedPrivacyConsent> {
	if (!FileSystem.documentDirectory) {
		return { ...UNDECIDED, storageStatus: 'unavailable' }
	}

	const v2Probe = await probeFile(STORAGE_FILE)
	if (v2Probe.kind === 'error') {
		return { ...UNDECIDED, storageStatus: 'untrusted' }
	}
	if (v2Probe.kind === 'present') {
		try {
			const parsed = parsePurposes(JSON.parse(v2Probe.body))
			if (!parsed) {
				return { ...UNDECIDED, storageStatus: 'corrupt' }
			}
			// Independent purposes — including mixed grant/deny.
			if (parsed.analytics !== null && parsed.ads !== null) {
				return parsed
			}
			return { ...UNDECIDED, storageStatus: 'corrupt' }
		} catch {
			return { ...UNDECIDED, storageStatus: 'corrupt' }
		}
	}

	const legacyProbe = await probeFile(LEGACY_STORAGE_FILE)
	if (legacyProbe.kind === 'error') {
		return { ...UNDECIDED, storageStatus: 'untrusted' }
	}
	if (legacyProbe.kind === 'present') {
		try {
			const parsed = parsePurposes(JSON.parse(legacyProbe.body))
			if (!parsed || parsed.analytics === null || parsed.ads === null) {
				return { ...UNDECIDED, storageStatus: 'corrupt' }
			}
			return parsed
		} catch {
			return { ...UNDECIDED, storageStatus: 'corrupt' }
		}
	}

	return { ...UNDECIDED }
}

export type WritePrivacyConsentInput = {
	analytics: PurposeDecision
	ads: PurposeDecision
}

/**
 * Persists the independent purpose pair. Write failures propagate — callers
 * must not claim success. Does not enable SDKs (session layer owns that).
 */
export async function writePersistedPrivacyConsent(
	input: WritePrivacyConsentInput,
): Promise<PersistedPrivacyConsent> {
	const updatedAtIso = new Date().toISOString()
	const next: PersistedPrivacyConsent = {
		analytics: input.analytics,
		ads: input.ads,
		updatedAtIso,
		storageStatus: 'ok',
	}

	const run = async (): Promise<PersistedPrivacyConsent> => {
		if (!FileSystem.documentDirectory) {
			return { ...next, storageStatus: 'unavailable' }
		}

		const payload = JSON.stringify({
			analytics: next.analytics,
			ads: next.ads,
			updatedAtIso,
		})

		// Single authoritative preference write for all four combinations.
		await FileSystem.writeAsStringAsync(STORAGE_FILE, payload)
		// Best-effort cleanup of prior-build markers — failures must not undo
		// the preference write above or re-enable SDKs (session gate handles that).
		await deleteIfExists(LEGACY_STORAGE_FILE)
		await deleteIfExists(DENY_INTENT_FILE)
		await deleteIfExists(TRUST_FILE)
		return next
	}

	const pending = writeChain.then(run, run)
	writeChain = pending.then(
		() => undefined,
		() => undefined,
	)
	return pending
}

export function resetConsentWriteQueueForTests(): void {
	writeChain = Promise.resolve()
}

export function getConsentStoragePathsForTests() {
	return {
		v2: STORAGE_FILE,
		legacy: LEGACY_STORAGE_FILE,
		denyIntent: DENY_INTENT_FILE,
		trust: TRUST_FILE,
	}
}

export type PrivacyConsentChoice = 'accepted' | 'declined'

export function toLegacyChoice(
	state: Pick<PersistedPrivacyConsent, 'analytics' | 'ads'>,
): PrivacyConsentChoice | null {
	if (state.analytics === null && state.ads === null) {
		return null
	}
	if (state.analytics === 'denied' && state.ads === 'denied') {
		return 'declined'
	}
	if (state.analytics === 'granted' || state.ads === 'granted') {
		return 'accepted'
	}
	return null
}
