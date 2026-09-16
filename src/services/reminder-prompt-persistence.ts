import * as FileSystem from 'expo-file-system/legacy'
import {
	DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
	type MeasurementReminderPromptState,
} from '@/domain/reminders/measurement-reminder-prompt'

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ''}reminder-prompt-state.json`

export type PersistedReminderPromptState = MeasurementReminderPromptState & {
	/** Medication ids already offered the «Напоминать о приёме?» soft prompt. */
	promptedMedicationIds: string[]
}

const DEFAULT_STATE: PersistedReminderPromptState = {
	...DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
	promptedMedicationIds: [],
}

function normalizeState(
	parsed: Partial<PersistedReminderPromptState>,
): PersistedReminderPromptState {
	const dismissCount =
		typeof parsed.dismissCount === 'number' &&
		parsed.dismissCount >= 0 &&
		parsed.dismissCount <= 2
			? Math.floor(parsed.dismissCount)
			: 0
	const measurementsSinceDismiss =
		typeof parsed.measurementsSinceDismiss === 'number' &&
		parsed.measurementsSinceDismiss >= 0
			? Math.floor(parsed.measurementsSinceDismiss)
			: 0
	const promptedMedicationIds = Array.isArray(parsed.promptedMedicationIds)
		? parsed.promptedMedicationIds.filter(
				(id): id is string => typeof id === 'string' && id.length > 0,
			)
		: []
	return {
		dismissCount,
		measurementsSinceDismiss,
		promptedMedicationIds,
	}
}

/** Reads soft-prompt counters from app document storage. */
export async function readReminderPromptState(): Promise<PersistedReminderPromptState> {
	if (!FileSystem.documentDirectory) {
		return { ...DEFAULT_STATE, promptedMedicationIds: [] }
	}

	try {
		const info = await FileSystem.getInfoAsync(STORAGE_FILE)
		if (!info.exists) {
			return { ...DEFAULT_STATE, promptedMedicationIds: [] }
		}
		const raw = await FileSystem.readAsStringAsync(STORAGE_FILE)
		const parsed = JSON.parse(raw) as Partial<PersistedReminderPromptState>
		return normalizeState(parsed)
	} catch {
		return { ...DEFAULT_STATE, promptedMedicationIds: [] }
	}
}

/** Persists soft-prompt counters to app document storage. */
export async function writeReminderPromptState(
	state: PersistedReminderPromptState,
): Promise<void> {
	if (!FileSystem.documentDirectory) {
		return
	}

	await FileSystem.writeAsStringAsync(
		STORAGE_FILE,
		JSON.stringify(normalizeState(state)),
	)
}

/** Marks a medication id as already prompted for remind soft-prompt. */
export async function markMedicationRemindPrompted(
	medicationId: string,
): Promise<void> {
	const current = await readReminderPromptState()
	if (current.promptedMedicationIds.includes(medicationId)) {
		return
	}
	await writeReminderPromptState({
		...current,
		promptedMedicationIds: [...current.promptedMedicationIds, medicationId],
	})
}

/** True when this medication has not yet been offered the remind soft-prompt. */
export async function shouldOfferMedicationRemindPrompt(
	medicationId: string,
): Promise<boolean> {
	const current = await readReminderPromptState()
	return !current.promptedMedicationIds.includes(medicationId)
}

/** Test-only reset helper. */
export async function clearReminderPromptStateForTests(): Promise<void> {
	if (!FileSystem.documentDirectory) {
		return
	}
	try {
		await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true })
	} catch {
		/* ignore */
	}
}
