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
jest.mock('react-native', () => ({
	View: 'View',
	StyleSheet: { create: (s: object) => s, hairlineWidth: 1 },
}))
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-router', () => ({
	Tabs: Object.assign(() => null, { Screen: () => null }),
	useRouter: () => ({ push: jest.fn() }),
	usePathname: () => '/(tabs)',
}))
jest.mock('expo-router/build/react-navigation/bottom-tabs', () => ({
	BottomTabBar: () => null,
}))
jest.mock('@/ads/tabs-bottom-banner', () => ({
	TabsBottomBanner: () => null,
}))
jest.mock('@/hooks/use-diary', () => ({
	useDiary: () => ({ switchProfile: () => new Promise(() => {}) }),
}))
jest.mock('@/i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
		locale: 'ru',
		preference: 'system',
		setLocalePreference: async () => {},
		reloadLocaleFromSettings: async () => {},
	}),
}))
jest.mock('expo-notifications', () => ({
	addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
	getLastNotificationResponseAsync: jest.fn(async () => null),
}))
jest.mock('@expo/vector-icons', () => ({
	Ionicons: () => null,
}))
jest.mock('@/theme', () => ({
	colors: { primary: '#000', textMuted: '#666', surface: '#fff', border: '#ccc' },
	typography: { secondary: 12 },
	spacing: { xs: 4, md: 16 },
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
