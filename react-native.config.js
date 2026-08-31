/**
 * Native dependency autolinking overrides.
 * Keep react-native-reanimated out of the Android build — Expo SDK 57
 * expo-modules-core is pinned to worklets 0.10.x (see DECISIONS.md), while
 * current reanimated 4.6 requires worklets 0.12.x.
 */
module.exports = {
	dependencies: {
		'react-native-reanimated': {
			platforms: {
				android: null,
				ios: null,
			},
		},
	},
}
