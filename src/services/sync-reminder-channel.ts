/**
 * Cold-start / locale sync for the Android reminders notification channel.
 *
 * Kept free of react-native so Node/Jest can assert the cold-start bug scenario:
 * persisted preference → resolved locale → stable channel id + localized name.
 */
import {
	normalizeLocalePreference,
	resolveAppLocale,
	type AppLocale,
	type LocalePreference,
} from '@/i18n/locale'
import {
	ANDROID_CHANNEL_ID,
	androidChannelDisplayName,
} from '@/services/android-channel-name'

export type ReminderChannelWriter = (
	channelId: string,
	options: { name: string },
) => Promise<void>

/**
 * Resolves a stored locale preference and writes/updates the single
 * `app-reminders` channel display name. Does not create per-locale channel ids
 * and does not touch notification schedules.
 */
export async function syncReminderChannelFromPreference(input: {
	/** Raw or normalized preference from settings (`system` | ru|en|es|de). */
	preference: string | LocalePreference
	/**
	 * System language tag used only when preference is `system`.
	 * Pass explicitly in tests; production uses the device tag.
	 */
	systemLanguageTag?: string | null
	writeChannel: ReminderChannelWriter
}): Promise<{
	channelId: string
	preference: LocalePreference
	locale: AppLocale
	name: string
}> {
	const preference = normalizeLocalePreference(input.preference)
	const locale = resolveAppLocale(preference, input.systemLanguageTag)
	const name = androidChannelDisplayName(locale)
	await input.writeChannel(ANDROID_CHANNEL_ID, { name })
	return {
		channelId: ANDROID_CHANNEL_ID,
		preference,
		locale,
		name,
	}
}
