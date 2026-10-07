/**
 * Behavioral regression: cold start must sync `app-reminders` channel name
 * from the persisted locale — never leave a fresh runtime stuck on RU.
 */
import {
	ANDROID_CHANNEL_ID,
	androidChannelDisplayName,
} from '@/services/android-channel-name'
import { syncReminderChannelFromPreference } from '@/services/sync-reminder-channel'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('notification channel cold start', () => {
	it.each([
		['ru', 'Напоминания'],
		['en', 'Reminders'],
		['es', 'Recordatorios'],
		['de', 'Erinnerungen'],
	] as const)(
		'persisted %s → fresh runtime writes channel name %s',
		async (preference, expectedName) => {
			const writes: { id: string; name: string }[] = []
			// Fresh runtime: empty write log (no prior lastChannelLocale=ru).
			const result = await syncReminderChannelFromPreference({
				preference,
				writeChannel: async (channelId, options) => {
					writes.push({ id: channelId, name: options.name })
				},
			})

			expect(result.channelId).toBe('app-reminders')
			expect(result.channelId).toBe(ANDROID_CHANNEL_ID)
			expect(result.locale).toBe(preference)
			expect(result.name).toBe(expectedName)
			expect(writes).toEqual([{ id: 'app-reminders', name: expectedName }])
			expect(writes[0]?.name).not.toBe(
				preference === 'ru' ? 'Reminders' : 'Напоминания',
			)
		},
	)

	it('repeated initialization keeps a single stable channel id', async () => {
		const ids: string[] = []
		const writeChannel = async (channelId: string, options: { name: string }) => {
			ids.push(channelId)
			void options
		}

		await syncReminderChannelFromPreference({
			preference: 'de',
			writeChannel,
		})
		await syncReminderChannelFromPreference({
			preference: 'de',
			writeChannel,
		})
		await syncReminderChannelFromPreference({
			preference: 'en',
			writeChannel,
		})

		expect(ids).toEqual(['app-reminders', 'app-reminders', 'app-reminders'])
		expect(new Set(ids).size).toBe(1)
	})

	it('system preference resolves via system language tag (and fallback)', async () => {
		const de = await syncReminderChannelFromPreference({
			preference: 'system',
			systemLanguageTag: 'de-DE',
			writeChannel: async () => {},
		})
		expect(de.locale).toBe('de')
		expect(de.name).toBe(androidChannelDisplayName('de'))

		const unsupported = await syncReminderChannelFromPreference({
			preference: 'system',
			systemLanguageTag: 'fr-FR',
			writeChannel: async () => {},
		})
		// Existing fallback: unsupported system → en
		expect(unsupported.locale).toBe('en')
		expect(unsupported.name).toBe('Reminders')
	})

	it('simulates DE cold start after a prior RU runtime (no RU sticky default)', async () => {
		const firstRuntime: { id: string; name: string }[] = []
		await syncReminderChannelFromPreference({
			preference: 'ru',
			writeChannel: async (id, options) => {
				firstRuntime.push({ id, name: options.name })
			},
		})
		expect(firstRuntime[0]?.name).toBe('Напоминания')

		// New JS runtime: separate write sink; persisted preference is DE.
		const coldStart: { id: string; name: string }[] = []
		await syncReminderChannelFromPreference({
			preference: 'de',
			writeChannel: async (id, options) => {
				coldStart.push({ id, name: options.name })
			},
		})
		expect(coldStart).toEqual([{ id: 'app-reminders', name: 'Erinnerungen' }])
		expect(coldStart[0]?.name).not.toBe('Напоминания')
	})

	it('I18nProvider cold-start effect syncs channel without rescheduling', () => {
		const provider = readFileSync(
			join(__dirname, '../../i18n/provider.tsx'),
			'utf8',
		)
		// Startup load path must update the channel from persisted settings.
		expect(provider).toMatch(
			/repos\.settings\.get\(\)[\s\S]*ensureAndroidChannelForLocale\(resolved\)/,
		)
		// Cold-start block must not reconcile/reschedule merely for channel name.
		const coldStartEffect = provider.slice(
			provider.indexOf('useEffect(() => {'),
			provider.indexOf('const setLocalePreference'),
		)
		expect(coldStartEffect).toContain('ensureAndroidChannelForLocale')
		expect(coldStartEffect).not.toContain('reconcileAllProfileNotifications')
		expect(coldStartEffect).not.toContain('refreshReminderCopyForLocale')
	})
})
