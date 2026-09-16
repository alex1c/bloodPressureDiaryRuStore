import * as Notifications from 'expo-notifications'
import TabsLayout from '@/app/(tabs)/_layout'
import {
	evaluateInterstitialEligibility,
	overrideAdSessionStateForTests,
	resetAdSessionMemoryForTests,
} from '@/ads/ad-policy'

jest.mock('react', () => ({
	...jest.requireActual('react'),
	useEffect: (effect: () => void) => effect(),
}))
jest.mock('expo-router', () => ({
	Tabs: Object.assign(() => null, { Screen: () => null }),
	useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/hooks/use-diary', () => ({
	useDiary: () => ({ switchProfile: () => new Promise(() => {}) }),
}))
jest.mock('expo-notifications', () => ({
	addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
	getLastNotificationResponseAsync: jest.fn(async () => null),
}))

describe('warm reminder notification ad guard', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		resetAdSessionMemoryForTests()
		overrideAdSessionStateForTests({ meaningfulActionCount: 5 })
	})

	it.each(['diary', 'medications'])(
		'blocks interstitial immediately on a %s notification, before profile switching completes',
		(screen) => {
			TabsLayout()
			const listener = jest.mocked(
				Notifications.addNotificationResponseReceivedListener,
			).mock.calls[0]![0]
			listener({
				actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
				notification: { request: { content: { data: { screen, profileId: 'profile' } } } },
			} as unknown as Notifications.NotificationResponse)
			expect(evaluateInterstitialEligibility({
				hasCompletedFirstMeasurement: true,
				interstitialReady: true,
				hasBlockingModal: false,
				hasKeyboardOrInputFlow: false,
				onSensitiveScreen: false,
			})).toEqual({ eligible: false, reason: 'notification_open' })
		},
	)
})
