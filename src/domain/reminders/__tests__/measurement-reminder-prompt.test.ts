import {
	DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
	onDismissMeasurementReminderPrompt,
	onMeasurementCreatedForPrompt,
	shouldShowMeasurementReminderPrompt,
} from '@/domain/reminders/measurement-reminder-prompt'

describe('measurement reminder soft prompt', () => {
	it('shows after the first measurement when never dismissed', () => {
		const result = onMeasurementCreatedForPrompt({
			state: DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
			hasActiveMeasurementReminder: false,
			isFirstMeasurement: true,
		})
		expect(result.shouldShow).toBe(true)
		expect(result.state.dismissCount).toBe(0)
	})

	it('does not show on non-first measurement before any dismiss', () => {
		const result = onMeasurementCreatedForPrompt({
			state: DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
			hasActiveMeasurementReminder: false,
			isFirstMeasurement: false,
		})
		expect(result.shouldShow).toBe(false)
	})

	it('does not re-show immediately after dismiss', () => {
		const dismissed = onDismissMeasurementReminderPrompt(
			DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
		)
		expect(dismissed.dismissCount).toBe(1)
		const next = onMeasurementCreatedForPrompt({
			state: dismissed,
			hasActiveMeasurementReminder: false,
			isFirstMeasurement: false,
		})
		expect(next.shouldShow).toBe(false)
		expect(next.state.measurementsSinceDismiss).toBe(1)
	})

	it('re-offers after 3 measurements following first dismiss', () => {
		let state = onDismissMeasurementReminderPrompt(
			DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
		)
		for (let i = 0; i < 2; i += 1) {
			const step = onMeasurementCreatedForPrompt({
				state,
				hasActiveMeasurementReminder: false,
				isFirstMeasurement: false,
			})
			expect(step.shouldShow).toBe(false)
			state = step.state
		}
		const third = onMeasurementCreatedForPrompt({
			state,
			hasActiveMeasurementReminder: false,
			isFirstMeasurement: false,
		})
		expect(third.shouldShow).toBe(true)
		expect(third.state.measurementsSinceDismiss).toBe(3)
	})

	it('stops forever after the second dismiss', () => {
		let state = onDismissMeasurementReminderPrompt(
			DEFAULT_MEASUREMENT_REMINDER_PROMPT_STATE,
		)
		state = onDismissMeasurementReminderPrompt(state)
		expect(state.dismissCount).toBe(2)
		const result = onMeasurementCreatedForPrompt({
			state,
			hasActiveMeasurementReminder: false,
			isFirstMeasurement: true,
		})
		expect(result.shouldShow).toBe(false)
	})

	it('never shows when an active measurement reminder exists', () => {
		expect(
			shouldShowMeasurementReminderPrompt({
				dismissCount: 0,
				measurementsSinceDismiss: 0,
				hasActiveMeasurementReminder: true,
				isFirstMeasurement: true,
			}),
		).toBe(false)
	})
})
