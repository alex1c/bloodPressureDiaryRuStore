import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Reminder } from '@/domain/types'

const ANDROID_CHANNEL_ID = 'medication-reminders'

/** Neutral copy for local medication reminders — never medical advice. */
export function buildReminderContent(input: {
	medicationName: string
	dosageText: string
}): { title: string; body: string } {
	const title = 'Лекарство по расписанию'
	const dosage = input.dosageText.trim()
	const body = dosage
		? `${input.medicationName} — ${dosage}`
		: input.medicationName
	return { title, body }
}

let handlerConfigured = false

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

/** Ensures Android notification channel exists (idempotent). */
export async function ensureAndroidChannel(): Promise<void> {
	if (Platform.OS !== 'android') {
		return
	}
	await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
		name: 'Напоминания о лекарствах',
		importance: Notifications.AndroidImportance.DEFAULT,
		vibrationPattern: [0, 250, 250, 250],
		lightColor: '#2B6CB0',
	})
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
 * Schedules a daily local notification for a reminder slot.
 * Returns the platform notification id, or null if scheduling is unavailable.
 */
export async function scheduleDailyReminderNotification(
	reminder: Reminder,
): Promise<string | null> {
	configureNotificationHandler()
	await ensureAndroidChannel()

	const permission = await getNotificationPermissionState()
	if (permission !== 'granted') {
		return null
	}

	const id = await Notifications.scheduleNotificationAsync({
		content: {
			title: reminder.title,
			body: reminder.body ?? undefined,
			data: {
				screen: 'medications',
				reminderId: reminder.id,
				medicationId: reminder.medicationId,
			},
			sound: true,
			...(Platform.OS === 'android'
				? { channelId: ANDROID_CHANNEL_ID }
				: {}),
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DAILY,
			hour: reminder.hour,
			minute: reminder.minute,
			...(Platform.OS === 'android'
				? { channelId: ANDROID_CHANNEL_ID }
				: {}),
		},
	})
	return id
}

/** Cancels one scheduled notification if the id is known. */
export async function cancelPlatformNotification(
	platformNotificationId: string | null | undefined,
): Promise<void> {
	if (!platformNotificationId) {
		return
	}
	try {
		await Notifications.cancelScheduledNotificationAsync(
			platformNotificationId,
		)
	} catch {
		// Already cancelled or unknown — safe to ignore.
	}
}

/**
 * Cancels every scheduled notification for this app.
 * Used before idempotent reconciliation.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
	await Notifications.cancelAllScheduledNotificationsAsync()
}
