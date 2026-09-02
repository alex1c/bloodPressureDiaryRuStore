import * as FileSystem from 'expo-file-system/legacy'

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}ad-session-state.json`

export type PersistedAdSessionState = {
	sessionCount: number
	lastInterstitialAt: string | null
}

const DEFAULT_STATE: PersistedAdSessionState = {
	sessionCount: 0,
	lastInterstitialAt: null,
}

/** Reads persisted ad session counters from app document storage. */
export async function readPersistedAdSessionState(): Promise<PersistedAdSessionState> {
	if (!FileSystem.documentDirectory) {
		return { ...DEFAULT_STATE }
	}

	try {
		const info = await FileSystem.getInfoAsync(STORAGE_FILE)
		if (!info.exists) {
			return { ...DEFAULT_STATE }
		}
		const raw = await FileSystem.readAsStringAsync(STORAGE_FILE)
		const parsed = JSON.parse(raw) as Partial<PersistedAdSessionState>
		return {
			sessionCount:
				typeof parsed.sessionCount === 'number' && parsed.sessionCount >= 0
					? parsed.sessionCount
					: 0,
			lastInterstitialAt:
				typeof parsed.lastInterstitialAt === 'string'
					? parsed.lastInterstitialAt
					: null,
		}
	} catch {
		return { ...DEFAULT_STATE }
	}
}

/** Persists ad session counters to app document storage. */
export async function writePersistedAdSessionState(
	state: PersistedAdSessionState,
): Promise<void> {
	if (!FileSystem.documentDirectory) {
		return
	}

	await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(state))
}

/** Test-only reset helper. */
export async function clearPersistedAdSessionStateForTests(): Promise<void> {
	if (!FileSystem.documentDirectory) {
		return
	}
	try {
		await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true })
	} catch {
		/* ignore */
	}
}
