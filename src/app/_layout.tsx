import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DiaryProvider } from '@/hooks/use-diary'
import { colors } from '@/theme'

/**
 * Root stack: tabs first, measurement routes on top.
 * Diary remains the initial screen via (tabs)/index.
 */
export default function RootLayout() {
	return (
		<DiaryProvider>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					contentStyle: { backgroundColor: colors.background },
					headerShown: false,
				}}
			>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen
					name="measurement/new"
					options={{ headerShown: true, presentation: 'card' }}
				/>
				<Stack.Screen
					name="measurement/[id]"
					options={{ headerShown: true, presentation: 'card' }}
				/>
			</Stack>
		</DiaryProvider>
	)
}
