/**
 * Locale preference and resolved language types for BP Diary i18n.
 */

/** User preference stored in settings (manual override or follow system). */
export type LocalePreference = 'system' | 'ru' | 'en' | 'es' | 'de'

/** Concrete UI language after resolving system + preference. */
export type AppLocale = 'ru' | 'en' | 'es' | 'de'

export const LOCALE_PREFERENCES: readonly LocalePreference[] = [
	'system',
	'ru',
	'en',
	'es',
	'de',
] as const

export const APP_LOCALES: readonly AppLocale[] = [
	'ru',
	'en',
	'es',
	'de',
] as const

export function isLocalePreference(value: string): value is LocalePreference {
	return (LOCALE_PREFERENCES as readonly string[]).includes(value)
}

export function isAppLocale(value: string): value is AppLocale {
	return (APP_LOCALES as readonly string[]).includes(value)
}

/** Maps BCP-47 / OS language tags onto a supported AppLocale. */
export function mapSystemLanguageTag(tag: string | null | undefined): AppLocale {
	if (!tag) {
		return 'en'
	}
	const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? ''
	if (primary === 'ru') {
		return 'ru'
	}
	if (primary === 'es') {
		return 'es'
	}
	if (primary === 'de') {
		return 'de'
	}
	if (primary === 'en') {
		return 'en'
	}
	return 'en'
}

/**
 * Resolves stored preference against the current system language tag.
 * Explicit locale always wins; system falls through to mapSystemLanguageTag.
 */
export function resolveAppLocale(
	preference: LocalePreference,
	systemLanguageTag: string | null | undefined,
): AppLocale {
	if (preference !== 'system') {
		return preference
	}
	return mapSystemLanguageTag(systemLanguageTag)
}

/** Intl locale tag for date/number formatting. */
export function toIntlLocale(locale: AppLocale): string {
	switch (locale) {
		case 'ru':
			return 'ru-RU'
		case 'en':
			return 'en-US'
		case 'es':
			return 'es-ES'
		case 'de':
			return 'de-DE'
		default: {
			const _exhaustive: never = locale
			return _exhaustive
		}
	}
}

/**
 * Normalizes legacy backup/settings locale values.
 * Unknown values fall back to system (safe default for new schema).
 */
export function normalizeLocalePreference(
	raw: string | null | undefined,
): LocalePreference {
	if (raw == null || raw === '') {
		return 'system'
	}
	if (isLocalePreference(raw)) {
		return raw
	}
	return 'system'
}
