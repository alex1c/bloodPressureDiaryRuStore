import { Tabs, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { colors, typography } from '@/theme'

function openMedicationsFromNotificationData(
	data: unknown,
	router: ReturnType<typeof useRouter>,
) {
	const payload = data as { screen?: string } | null
	if (payload?.screen === 'medications') {
		router.push('/(tabs)/medications')
	}
}

/** Bottom tabs: Diary (default) | Graphs | Medications. */
export default function TabsLayout() {
	const router = useRouter()

	// Open medications when the user taps a local reminder notification.
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				openMedicationsFromNotificationData(
					response.notification.request.content.data,
					router,
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
			)
		})

		return () => sub.remove()
	}, [router])

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
		</Tabs>
	)
}
