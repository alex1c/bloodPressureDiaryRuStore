import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { DiaryProvider, useDiary } from '@/hooks/use-diary'
import { MedicationsProvider } from '@/hooks/use-medications'
import { I18nProvider } from '@/i18n'
import {
	OptionalSdkBootstrap,
	PrivacyConsentModal,
	PrivacyConsentProvider,
} from '@/privacy'
import { colors } from '@/theme'

// Keep native splash until React tree is ready (fixes DevLauncher ClassNotFound).
void SplashScreen.preventAutoHideAsync().catch(() => {
	// Already prevented or unavailable in some test hosts.
})

/** Bridges diary repos into the i18n provider once storage is ready. */
function I18nBridge({ children }: { children: React.ReactNode }) {
	const { repos } = useDiary()
	return <I18nProvider repos={repos}>{children}</I18nProvider>
}

/**
 * Root stack: tabs first, measurement / medication / health routes on top.
 * Diary remains the initial screen via (tabs)/index.
 */
export default function RootLayout() {
	useEffect(() => {
		void SplashScreen.hideAsync().catch(() => {})
	}, [])

	return (
		<PrivacyConsentProvider>
			<DiaryProvider>
				<I18nBridge>
					<MedicationsProvider>
						<OptionalSdkBootstrap />
						<PrivacyConsentModal />
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
							<Stack.Screen
								name="settings/reminders"
								options={{ headerShown: true, presentation: 'card' }}
							/>
						</Stack>
					</MedicationsProvider>
				</I18nBridge>
			</DiaryProvider>
		</PrivacyConsentProvider>
	)
}
