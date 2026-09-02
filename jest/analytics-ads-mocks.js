/* eslint-env jest */
jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: {
		initialize: jest.fn(async () => undefined),
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
			loadAd: jest.fn(async () => ({
				show: jest.fn(async () => undefined),
			})),
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
