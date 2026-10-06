export type {
	AppLocale,
	LocalePreference,
} from './locale'
export {
	APP_LOCALES,
	LOCALE_PREFERENCES,
	isAppLocale,
	isLocalePreference,
	mapSystemLanguageTag,
	normalizeLocalePreference,
	resolveAppLocale,
	toIntlLocale,
} from './locale'
export { catalogs, assertCatalogCompleteness } from './dictionaries'
export type { MessageKey, MessageCatalog } from './dictionaries'
export { translate, createTranslator } from './translate'
export { formatLongDate, formatShortDate, formatDateTime } from './format'
export {
	getDeviceLanguageTag,
	resolveLocaleFromPreference,
} from './device-locale'
// Provider is a separate entry for app shell — avoid re-exporting it from the
// barrel so domain/Jest imports of `@/i18n` do not load notification services.
export { I18nProvider, useI18n, useOptionalI18n } from './provider'
