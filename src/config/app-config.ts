import type { LocalePreference } from '@/i18n'

/**
 * Static product configuration shared across the app shell.
 */
export const appConfig = {
	defaultLocalePreference: 'system' as const satisfies LocalePreference,
	supportedLocalePreferences: [
		'system',
		'ru',
		'en',
		'es',
		'de',
	] as const satisfies readonly LocalePreference[],
	/** @deprecated Prefer supportedLocalePreferences — kept for older imports. */
	supportedLocales: ['ru', 'en', 'es', 'de'] as const,
	defaultLocale: 'ru' as const,
	androidPackage: 'com.calculatorplatform.bpdiary',
	productId: 'bp-diary',
	versionName: '1.0.2',
	versionCode: 3,
	displayName: 'Дневник давления',
} as const

export type SupportedLocale = (typeof appConfig.supportedLocales)[number]
