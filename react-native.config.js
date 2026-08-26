/**
 * React Native / Expo autolinking overrides.
 *
 * When APP_VARIANT=production, keep expo-dev-* packages out of the native
 * Android project even though they remain in package.json for local development.
 */
const isProduction = process.env.APP_VARIANT === 'production'

const disabled = { platforms: { android: null, ios: null } }

module.exports = {
	dependencies: isProduction
		? {
				'expo-dev-client': disabled,
				'expo-dev-launcher': disabled,
				'expo-dev-menu': disabled,
				'expo-dev-menu-interface': disabled,
			}
		: {},
}
