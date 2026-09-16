import {
	buildMeasurementReminderContent,
	buildReminderContent,
} from '@/domain/reminders/reminder-content'

describe('buildReminderContent', () => {
	it('uses medication reminder title and schedule time in the body', () => {
		expect(
			buildReminderContent({
				medicationName: 'Лозартан',
				scheduleHm: '08:00',
			}),
		).toEqual({
			title: 'Напоминание о лекарстве',
			body: 'Лозартан — запланированный приём в 08:00',
		})
	})

	it('prefixes title with profile name when requested', () => {
		const content = buildReminderContent({
			medicationName: 'Аспирин',
			scheduleHm: '20:30',
			profileName: 'Мама',
			includeProfileName: true,
		})
		expect(content.title).toBe('Мама — напоминание о лекарстве')
		expect(content.body).toContain('20:30')
	})
})

describe('buildMeasurementReminderContent', () => {
	it('returns fixed measurement copy', () => {
		expect(buildMeasurementReminderContent()).toEqual({
			title: 'Пора измерить давление',
			body: 'Если сейчас удобно, запишите новое измерение в дневник.',
		})
	})
})
