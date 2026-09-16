import {
	isEveryDayWeekdays,
	jsWeekdayToExpoWeekday,
	packPlatformNotificationIds,
	unpackPlatformNotificationIds,
} from '@/services/reminder-notification-ids'

describe('reminder notification id packing', () => {
	it('packs a single id as a plain string', () => {
		expect(packPlatformNotificationIds(['abc'])).toBe('abc')
		expect(packPlatformNotificationIds([null, 'abc', ''])).toBe('abc')
	})

	it('packs multiple ids as JSON', () => {
		expect(packPlatformNotificationIds(['a', 'b'])).toBe('["a","b"]')
	})

	it('unpacks plain and JSON forms', () => {
		expect(unpackPlatformNotificationIds('abc')).toEqual(['abc'])
		expect(unpackPlatformNotificationIds('["a","b"]')).toEqual(['a', 'b'])
		expect(unpackPlatformNotificationIds(null)).toEqual([])
	})

	it('maps JS weekdays to Expo weekdays', () => {
		expect(jsWeekdayToExpoWeekday(0)).toBe(1)
		expect(jsWeekdayToExpoWeekday(6)).toBe(7)
		expect(isEveryDayWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe(true)
		expect(isEveryDayWeekdays([1, 2, 3, 4, 5])).toBe(false)
	})
})
