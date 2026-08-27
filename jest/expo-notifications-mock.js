module.exports = {
	setNotificationHandler: () => {},
	setNotificationChannelAsync: async () => {},
	getPermissionsAsync: async () => ({
		granted: true,
		canAskAgain: true,
		status: 'granted',
	}),
	requestPermissionsAsync: async () => ({
		granted: true,
		canAskAgain: true,
		status: 'granted',
	}),
	scheduleNotificationAsync: async () => 'mock-notif',
	cancelScheduledNotificationAsync: async () => {},
	cancelAllScheduledNotificationsAsync: async () => {},
	addNotificationResponseReceivedListener: () => ({
		remove: () => {},
	}),
	AndroidImportance: { DEFAULT: 3 },
	IosAuthorizationStatus: { PROVISIONAL: 2 },
	PermissionStatus: { UNDETERMINED: 'undetermined' },
	SchedulableTriggerInputTypes: { DAILY: 'daily' },
}
