import { SETTINGS_ROUTE, REMINDERS_ROUTE } from '@/config/routes'

describe('settings navigation routes', () => {
	it('uses Expo Router canonical /settings path for Ещё', () => {
		expect(SETTINGS_ROUTE).toBe('/settings')
		expect(SETTINGS_ROUTE).not.toContain('/index')
	})

	it('exposes reminders under settings stack', () => {
		expect(REMINDERS_ROUTE).toBe('/settings/reminders')
	})
})
