import type { AppLocale } from './locale'
import { catalogs, type MessageKey } from './dictionaries'

export type TranslateParams = Record<string, string | number>

/**
 * Looks up a message and substitutes `{param}` placeholders.
 * Falls back to Russian, then the raw key, so missing keys never crash UI.
 */
export function translate(
	locale: AppLocale,
	key: MessageKey,
	params?: TranslateParams,
): string {
	const catalog = catalogs[locale] ?? catalogs.ru
	let text = catalog[key] ?? catalogs.ru[key] ?? key
	if (params) {
		for (const [name, value] of Object.entries(params)) {
			text = text.split(`{${name}}`).join(String(value))
		}
	}
	return text
}

/** Bound translator for a fixed locale (useful outside React). */
export function createTranslator(locale: AppLocale) {
	return (key: MessageKey, params?: TranslateParams) =>
		translate(locale, key, params)
}
