/* eslint-env jest */
jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
		setLocationTracking: jest.fn(),
		setDataSendingEnabled: jest.fn(),
		setAdvIdentifiersTracking: jest.fn(),
		reportAppOpen: jest.fn(),
	},
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(async () => undefined),
		setUserConsent: jest.fn(),
		setLocationConsent: jest.fn(),
		setAgeRestrictedUser: jest.fn(),
	},
	BannerAdSize: {
		stickySize: jest.fn(async () => ({
			width: 320,
			height: 50,
		})),
	},
	BannerView: 'BannerView',
	InterstitialAdLoader: {
		create: jest.fn(async () => ({
			loadAd: jest.fn(async () => {
				const ad = {
					show: jest.fn(
						() =>
							new Promise(() => {
								/* never resolves — matches RN SDK 8.3.0 showAd hang */
							}),
					),
					onAdShown: undefined,
					onAdFailedToShow: undefined,
					onAdDismissed: undefined,
				}
				Object.defineProperty(ad, 'onAdShown', {
					set(fn) {
						ad._onAdShown = fn
					},
					get() {
						return ad._onAdShown
					},
				})
				Object.defineProperty(ad, 'onAdFailedToShow', {
					set(fn) {
						ad._onAdFailedToShow = fn
					},
					get() {
						return ad._onAdFailedToShow
					},
				})
				Object.defineProperty(ad, 'onAdDismissed', {
					set(fn) {
						ad._onAdDismissed = fn
					},
					get() {
						return ad._onAdDismissed
					},
				})
				return ad
			}),
		})),
	},
}))

jest.mock('expo-constants', () => ({
	__esModule: true,
	default: {
		expoConfig: {
			extra: {
				appVariant: 'development',
			},
		},
	},
}))

jest.mock('expo-file-system/legacy', () => ({
	documentDirectory: 'file:///mock/',
	getInfoAsync: jest.fn(async () => ({ exists: false })),
	readAsStringAsync: jest.fn(async () => '{}'),
	writeAsStringAsync: jest.fn(async () => undefined),
	deleteAsync: jest.fn(async () => undefined),
}))
