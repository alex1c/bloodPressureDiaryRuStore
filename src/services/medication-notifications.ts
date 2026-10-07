import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Reminder } from '@/domain/types'
import {
	buildMeasurementReminderContent,
	buildReminderContent,
	MEASUREMENT_REMINDER_BODY,
	MEASUREMENT_REMINDER_TITLE,
} from '@/domain/reminders/reminder-content'
import type { AppLocale } from '@/i18n/locale'
import {
	ANDROID_CHANNEL_ID,
	androidChannelDisplayName,
} from '@/services/android-channel-name'
import {
	isEveryDayWeekdays,
	jsWeekdayToExpoWeekday,
	packPlatformNotificationIds,
	unpackPlatformNotificationIds,
} from '@/services/reminder-notification-ids'

export {
	buildMeasurementReminderContent,
	buildReminderContent,
	MEASUREMENT_REMINDER_BODY,
	MEASUREMENT_REMINDER_TITLE,
}

export { ANDROID_CHANNEL_ID, androidChannelDisplayName }

let handlerConfigured = false

/**
 * Last locale used for channel metadata. Scheduling falls back to this so
 * we keep one channel id while refreshing the OS display name on locale change.
 */
let lastChannelLocale: AppLocale = 'ru'

/** Configure foreground presentation once per JS runtime. */
export function configureNotificationHandler(): void {
	if (handlerConfigured) {
		return
	}
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	})
	handlerConfigured = true
}

/**
 * Creates/updates the single reminders channel with a locale-aware name.
 * Re-calling with the same id updates metadata without spawning new channels.
 */
export async function ensureAndroidChannelForLocale(
	locale: AppLocale,
): Promise<void> {
	lastChannelLocale = locale
	if (Platform.OS !== 'android') {
		return
	}
	await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
		name: androidChannelDisplayName(locale),
		importance: Notifications.AndroidImportance.DEFAULT,
		vibrationPattern: [0, 250, 250, 250],
		lightColor: '#2B6CB0',
	})
}

/** Ensures Android notification channel exists (uses last known locale). */
export async function ensureAndroidChannel(): Promise<void> {
	await ensureAndroidChannelForLocale(lastChannelLocale)
}

export type NotificationPermissionState =
	| 'granted'
	| 'denied'
	| 'undetermined'

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
	const settings = await Notifications.getPermissionsAsync()
	if (
		settings.granted ||
		settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
	) {
		return 'granted'
	}
	if (settings.canAskAgain === false) {
		return 'denied'
	}
	if (
		settings.status === Notifications.PermissionStatus.UNDETERMINED ||
		settings.canAskAgain
	) {
		return settings.granted ? 'granted' : 'undetermined'
	}
	return 'denied'
}

/**
 * Contextual permission request — call only when the user enables reminders.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
	const current = await getNotificationPermissionState()
	if (current === 'granted') {
		return 'granted'
	}
	if (current === 'denied') {
		return 'denied'
	}
	const result = await Notifications.requestPermissionsAsync()
	if (result.granted) {
		return 'granted'
	}
	return result.canAskAgain ? 'undetermined' : 'denied'
}

/**
 * Schedules local notification(s) for a reminder slot.
 * Daily when all weekdays selected; otherwise one WEEKLY per weekday.
 * Returns packed platform notification id(s), or null if unavailable.
 */
export async function scheduleDailyReminderNotification(
	reminder: Reminder,
): Promise<string | null> {
	configureNotificationHandler()
	await ensureAndroidChannel()

	const permission = await getNotificationPermissionState()
	if (permission !== 'granted' || !reminder.enabled) {
		return null
	}

	const isMeasurement = reminder.medicationId == null
	const screen = isMeasurement ? 'diary' : 'medications'
	const content = {
		title: reminder.title,
		body: reminder.body ?? undefined,
		data: {
			screen,
			reminderId: reminder.id,
			medicationId: reminder.medicationId,
			profileId: reminder.profileId,
		},
		sound: true as const,
		...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
	}

	const weekdays =
		reminder.weekdays.length > 0 ? reminder.weekdays : [0, 1, 2, 3, 4, 5, 6]

	if (isEveryDayWeekdays(weekdays)) {
		const id = await Notifications.scheduleNotificationAsync({
			content,
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DAILY,
				hour: reminder.hour,
				minute: reminder.minute,
				...(Platform.OS === 'android'
					? { channelId: ANDROID_CHANNEL_ID }
					: {}),
			},
		})
		return packPlatformNotificationIds([id])
	}

	const ids: string[] = []
	for (const jsDay of [...new Set(weekdays)].sort((a, b) => a - b)) {
		if (jsDay < 0 || jsDay > 6) {
			continue
		}
		const id = await Notifications.scheduleNotificationAsync({
			content,
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
				weekday: jsWeekdayToExpoWeekday(jsDay),
				hour: reminder.hour,
				minute: reminder.minute,
				...(Platform.OS === 'android'
					? { channelId: ANDROID_CHANNEL_ID }
					: {}),
			},
		})
		ids.push(id)
	}
	return packPlatformNotificationIds(ids)
}

/**
 * Conceptual rename: schedules daily or weekly reminder notifications.
 * Kept as an alias so call sites / tests can mock either name.
 */
export const scheduleReminderNotification = scheduleDailyReminderNotification

/** Cancels one scheduled notification if the id is known. */
export async function cancelPlatformNotification(
	platformNotificationId: string | null | undefined,
): Promise<void> {
	const ids = unpackPlatformNotificationIds(platformNotificationId)
	for (const id of ids) {
		try {
			await Notifications.cancelScheduledNotificationAsync(id)
		} catch {
			// Already cancelled or unknown — safe to ignore.
		}
	}
}

/** Cancels a list of known platform notification ids (pre-restore cleanup). */
export async function cancelPlatformNotificationIds(
	ids: string[],
): Promise<void> {
	for (const id of ids) {
		await cancelPlatformNotification(id)
	}
}

/**
 * Cancels scheduled notifications tracked in reminder rows for this app.
 * Prefer this over global cancel-all so future notification categories stay intact.
 */
export async function cancelManagedPlatformNotifications(input: {
	repos: {
		profiles: { list(): Promise<{ id: string }[]> }
		reminders: {
			listByProfile(profileId: string): Promise<Reminder[]>
		}
	}
}): Promise<void> {
	const profiles = await input.repos.profiles.list()
	const reminders = (
		await Promise.all(
			profiles.map((p) => input.repos.reminders.listByProfile(p.id)),
		)
	).flat()
	for (const reminder of reminders) {
		await cancelPlatformNotification(reminder.platformNotificationId)
	}
}

/**
 * Cancels every scheduled notification for this app.
 * @deprecated Prefer cancelManagedPlatformNotifications when possible.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
	await Notifications.cancelAllScheduledNotificationsAsync()
}

/** Opens Android app notification settings when the OS allows. */
export async function openSystemNotificationSettings(): Promise<void> {
	if (Platform.OS !== 'android') {
		return
	}
	try {
		await ensureAndroidChannelForLocale(lastChannelLocale)
	} catch {
		/* ignore */
	}
	try {
		const Linking = await import('react-native').then((m) => m.Linking)
		await Linking.openSettings()
	} catch {
		/* ignore */
	}
}
