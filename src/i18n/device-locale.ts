/**
 * Best-effort device language tag without adding expo-localization.
 * Falls back to undefined → English via mapSystemLanguageTag.
 *
 * Lazy-requires react-native so pure domain/Jest modules can import
 * locale helpers without pulling the RN runtime.
 */
import {
	mapSystemLanguageTag,
	resolveAppLocale,
	type AppLocale,
	type LocalePreference,
} from './locale'

export function getDeviceLanguageTag(): string | undefined {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const rn = require('react-native') as typeof import('react-native')
		const { NativeModules, Platform } = rn
		if (Platform.OS === 'android') {
			const locale =
				NativeModules.I18nManager?.localeIdentifier ??
				NativeModules.I18nManager?.locale
			if (typeof locale === 'string' && locale.length > 0) {
				return locale.replace('_', '-')
			}
		}
		const locales =
			typeof Intl !== 'undefined'
				? Intl.DateTimeFormat().resolvedOptions().locale
				: undefined
		return locales
	} catch {
		return undefined
	}
}

/** Resolves preference + device language into a concrete AppLocale. */
export function resolveLocaleFromPreference(
	preference: LocalePreference,
): AppLocale {
	return resolveAppLocale(preference, getDeviceLanguageTag())
}

export { mapSystemLanguageTag, resolveAppLocale }
