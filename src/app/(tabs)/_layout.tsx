import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { colors, typography } from '@/theme'

/** Bottom tabs: Diary (default) + Graphs. No empty placeholder tabs. */
export default function TabsLayout() {
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
					tabBarIcon: ({ color }) => (
						<Text style={{ color, fontSize: 18 }}>●</Text>
					),
					tabBarLabel: 'Дневник',
				}}
			/>
			<Tabs.Screen
				name="graphs"
				options={{
					title: 'Графики',
					tabBarIcon: ({ color }) => (
						<Text style={{ color, fontSize: 18 }}>↗</Text>
					),
					tabBarLabel: 'Графики',
				}}
			/>
		</Tabs>
	)
}
