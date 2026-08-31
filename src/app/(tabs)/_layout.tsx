import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useDiary } from '@/hooks/use-diary'
import { colors, typography } from '@/theme'

/**
 * Opens medications after optionally switching to the reminder's profile.
 * Profile switch runs first so today's doses match the notification context.
 */
function openMedicationsFromNotificationData(
	data: unknown,
	router: ReturnType<typeof useRouter>,
	switchProfile: (profileId: string) => Promise<void>,
) {
	const payload = data as { screen?: string; profileId?: string } | null
	if (payload?.screen !== 'medications') {
		return
	}

	void (async () => {
		if (payload.profileId) {
			try {
				await switchProfile(payload.profileId)
			} catch {
				// Still navigate if switch fails (profile may already be active).
			}
		}
		router.push('/(tabs)/medications')
	})()
}

/** Bottom tabs: Diary | Graphs | Medications | Health. */
export default function TabsLayout() {
	const router = useRouter()
	const { switchProfile } = useDiary()

	// Open medications when the user taps a local reminder notification.
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				openMedicationsFromNotificationData(
					response.notification.request.content.data,
					router,
					switchProfile,
				)
			},
		)

		// Cold start: notification may already have been tapped before listeners attach.
		void Notifications.getLastNotificationResponseAsync().then((response) => {
			if (!response) {
				return
			}
			openMedicationsFromNotificationData(
				response.notification.request.content.data,
				router,
				switchProfile,
			)
		})

		return () => sub.remove()
	}, [router, switchProfile])

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarLabelStyle: {
					fontSize: typography.secondary,
					fontWeight: '600',
				},
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					minHeight: 56,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Дневник',
					tabBarLabel: 'Дневник',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="heart-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="graphs"
				options={{
					title: 'Графики',
					tabBarLabel: 'Графики',
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="stats-chart-outline"
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="medications"
				options={{
					title: 'Лекарства',
					tabBarLabel: 'Лекарства',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="medical-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="health"
				options={{
					title: 'Здоровье',
					tabBarLabel: 'Здоровье',
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="fitness-outline" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	)
}
