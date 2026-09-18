/**
 * Static product configuration shared across the app shell.
 */
export const appConfig = {
	defaultLocale: 'ru' as const,
	supportedLocales: ['ru', 'en'] as const,
	androidPackage: 'com.calculatorplatform.bpdiary',
	productId: 'bp-diary',
	versionName: '1.0.2',
	versionCode: 3,
	displayName: 'Дневник давления',
} as const

export type SupportedLocale = (typeof appConfig.supportedLocales)[number]
