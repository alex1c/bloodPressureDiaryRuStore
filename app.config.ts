import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Expo app config — Continuous Native Generation entry.
 *
 * Production / RuStore:
 *   APP_VARIANT=production
 *   npm run prebuild:android:production
 *
 * Package ID is fixed in docs/DECISIONS.md: com.calculatorplatform.bpdiary
 */
export default ({ config }: ConfigContext): ExpoConfig => {
	const isProduction = process.env.APP_VARIANT === 'production'

	const plugins: NonNullable<ExpoConfig['plugins']> = [
		'expo-router',
		'expo-sqlite',
	]

	if (!isProduction) {
		plugins.splice(1, 0, 'expo-dev-client')
	}

	return {
		...config,
		name: 'Давление и пульс — дневник',
		slug: 'bp-diary',
		version: '1.0.0',
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
			versionCode: 1,
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
						],
					}
				: {}),
		},
		plugins,
		extra: {
			appVariant: isProduction ? 'production' : 'development',
			foundationVersion: '1.0.0',
		},
	}
}
