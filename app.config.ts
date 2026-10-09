import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Expo app config — Continuous Native Generation entry.
 *
 * Production:
 *   APP_VARIANT=production
 *   APP_STORE=rustore|googleplay
 *   npm run prebuild:android:production
 *
 * Package ID is fixed in docs/DECISIONS.md: com.calculatorplatform.bpdiary
 *
 * NOTE: Do not import TypeScript modules from `src/` here. Expo compiles
 * app.config.ts to a temporary CJS file that can only `require` plain JS.
 * Keep store resolution inlined (mirrors `src/config/store.ts`).
 */
type StoreId = 'rustore' | 'googleplay'

function resolveStoreIdForConfig(
	raw: string | undefined,
	options: { requireExplicit: boolean; developmentDefault: StoreId },
): StoreId {
	const trimmed = raw?.trim().toLowerCase()
	if (trimmed === 'rustore' || trimmed === 'googleplay') {
		return trimmed
	}
	if (options.requireExplicit) {
		throw new Error(
			`APP_STORE must be "rustore" or "googleplay" for production (got: ${JSON.stringify(raw ?? '')})`,
		)
	}
	if (trimmed === undefined || trimmed === '') {
		return options.developmentDefault
	}
	throw new Error(
		`Invalid APP_STORE value: ${JSON.stringify(raw)}. Expected "rustore" or "googleplay".`,
	)
}

export default ({ config }: ConfigContext): ExpoConfig => {
	const isProduction = process.env.APP_VARIANT === 'production'
	const storeId = resolveStoreIdForConfig(process.env.APP_STORE, {
		requireExplicit: isProduction,
		developmentDefault: 'rustore',
	})

	const plugins: NonNullable<ExpoConfig['plugins']> = [
		'./plugins/with-worklets-packaging',
		// Exclude SQLite/prefs from Auto Backup / OEM D2D (see DECISIONS.md).
		'./plugins/with-disable-auto-backup',
		// Disable Yandex Ads ContentProvider auto-init until JS consent gate.
		'./plugins/with-yandex-ads-manual-init',
		'expo-router',
		'expo-splash-screen',
		[
			'expo-notifications',
			{
				// Neutral local reminders only — no remote push.
				icon: './assets/icon.png',
				color: '#2B6CB0',
			},
		],
		'expo-sqlite',
		'expo-sharing',
	]

	if (!isProduction) {
		plugins.splice(1, 0, 'expo-dev-client')
	}

	return {
		...config,
		name: 'Дневник давления',
		slug: 'bp-diary',
		version: '1.1.1',
		orientation: 'portrait',
		icon: './assets/icon.png',
		userInterfaceStyle: 'light',
		scheme: 'bp-diary',
		experiments: {
			typedRoutes: true,
		},
		ios: {
			supportsTablet: true,
			bundleIdentifier: 'com.calculatorplatform.bpdiary',
		},
		android: {
			package: 'com.calculatorplatform.bpdiary',
			versionCode: 5,
			// Health SQLite must not enter Google Auto Backup by default.
			// User-controlled JSON export/share remains the supported path.
			allowBackup: false,
			adaptiveIcon: {
				backgroundColor: '#E8F0F5',
				foregroundImage: './assets/android-icon-foreground.png',
				backgroundImage: './assets/android-icon-background.png',
				monochromeImage: './assets/android-icon-monochrome.png',
			},
			predictiveBackGestureEnabled: false,
			// Expo CNG template + debug overlays inject SYSTEM_ALERT_WINDOW.
			// Block it in production release so RuStore AAB does not declare it.
			...(isProduction
				? {
						blockedPermissions: [
							'android.permission.SYSTEM_ALERT_WINDOW',
							'android.permission.READ_EXTERNAL_STORAGE',
							'android.permission.WRITE_EXTERNAL_STORAGE',
						],
					}
				: {}),
		},
		plugins,
		extra: {
			appVariant: isProduction ? 'production' : 'development',
			storeId,
			foundationVersion: '1.1.1',
		},
	}
}
