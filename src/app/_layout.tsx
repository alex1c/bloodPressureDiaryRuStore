import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { DiaryProvider } from '@/hooks/use-diary'
import { MedicationsProvider } from '@/hooks/use-medications'
import { colors } from '@/theme'

// Keep native splash until React tree is ready (fixes DevLauncher ClassNotFound).
void SplashScreen.preventAutoHideAsync().catch(() => {
	// Already prevented or unavailable in some test hosts.
})

/**
 * Root stack: tabs first, measurement / medication / health routes on top.
 * Diary remains the initial screen via (tabs)/index.
 */
export default function RootLayout() {
	useEffect(() => {
		void SplashScreen.hideAsync().catch(() => {})
	}, [])

	return (
		<DiaryProvider>
			<MedicationsProvider>
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
					<Stack.Screen
						name="medication/new"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="medication/[id]"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="health/[kind]/index"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="health/[kind]/new"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="health/entry/[id]"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="report/index"
						options={{ headerShown: true, presentation: 'card' }}
					/>
					<Stack.Screen
						name="settings/index"
						options={{ headerShown: true, presentation: 'card' }}
					/>
				</Stack>
			</MedicationsProvider>
		</DiaryProvider>
	)
}
