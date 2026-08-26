import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DiaryProvider } from '@/hooks/use-diary'
import { colors } from '@/theme'

/** Root navigation — diary first; measurement routes as stack screens. */
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
				<Stack.Screen name="index" />
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
