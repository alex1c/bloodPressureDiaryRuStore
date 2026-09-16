/**
 * Soft-prompt rules for offering measurement reminders after saves.
 * Pure functions — persistence lives in reminder-prompt-persistence.
 */

export type MeasurementReminderPromptState = {
	/** How many times the user dismissed the prompt (caps at 2). */
	dismissCount: number
	/** Creates after the first dismiss; reset on each dismiss. */
	measurementsSinceDismiss: number
}

export const DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE: MeasurementReminderPromptState =
	{
		dismissCount: 0,
		measurementsSinceDismiss: 0,
	}

export type MeasurementCreatedPromptInput = {
	state: MeasurementReminderPromptState
	/** True when an enabled measurement reminder (medicationId null) exists. */
	hasActiveMeasurementReminder: boolean
	/**
	 * True when this create is the profile's first measurement
	 * (measurementCountAfterSave === 1).
	 */
	isFirstMeasurement: boolean
}

export type MeasurementCreatedPromptResult = {
	state: MeasurementReminderPromptState
	shouldShow: boolean
}

/**
 * Decides whether to show the measurement soft prompt after a successful create.
 * Never shows when dismissCount >= 2 or an active measurement reminder exists.
 */
export function onMeasurementCreatedForPrompt(
	input: MeasurementCreatedPromptInput,
): MeasurementCreatedPromptResult {
	const { state, hasActiveMeasurementReminder, isFirstMeasurement } = input

	if (hasActiveMeasurementReminder || state.dismissCount >= 2) {
		return { state, shouldShow: false }
	}

	if (state.dismissCount === 0) {
		return { state, shouldShow: isFirstMeasurement }
	}

	// After first dismiss: count subsequent creates, re-offer at >= 3.
	const next: MeasurementReminderPromptState = {
		...state,
		measurementsSinceDismiss: state.measurementsSinceDismiss + 1,
	}
	return {
		state: next,
		shouldShow: next.measurementsSinceDismiss >= 3,
	}
}

/**
 * Records a soft-prompt dismiss. Second dismiss (dismissCount → 2) stops forever.
 */
export function onDismissMeasurementReminderPrompt(
	state: MeasurementReminderPromptState,
): MeasurementReminderPromptState {
	return {
		dismissCount: Math.min(2, state.dismissCount + 1),
		measurementsSinceDismiss: 0,
	}
}

/**
 * Pure predicate used by tests and callers that already have counters.
 */
export function shouldShowMeasurementReminderPrompt(input: {
	dismissCount: number
	measurementsSinceDismiss: number
	hasActiveMeasurementReminder: boolean
	isFirstMeasurement?: boolean
	measurementCountAfterSave?: number
}): boolean {
	const isFirst =
		input.isFirstMeasurement === true ||
		input.measurementCountAfterSave === 1
	const result = onMeasurementCreatedForPrompt({
		state: {
			dismissCount: input.dismissCount,
			measurementsSinceDismiss: input.measurementsSinceDismiss,
		},
		hasActiveMeasurementReminder: input.hasActiveMeasurementReminder,
		isFirstMeasurement: isFirst,
	})
	return result.shouldShow
}
