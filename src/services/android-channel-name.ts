/**
 * Android reminder notification channel naming.
 * Kept free of react-native imports so Node/Jest can cover locale mapping.
 */
import type { AppLocale } from '@/i18n/locale'
import { translate } from '@/i18n/translate'

/** Stable Android channel id — display name may change with locale. */
export const ANDROID_CHANNEL_ID = 'app-reminders'

/** Localized Android channel display name (stable id, mutable name). */
export function androidChannelDisplayName(locale: AppLocale): string {
	return translate(locale, 'notif.channel.name')
}
