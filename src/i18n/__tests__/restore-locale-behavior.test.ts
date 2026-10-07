/**
 * Behavioral restore locale coverage (no full UI mount):
 * success applies restored preference immediately; failure leaves locale alone.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	normalizeLocalePreference,
	resolveAppLocale,
	type AppLocale,
	type LocalePreference,
} from '@/i18n/locale'
import { syncReminderChannelFromPreference } from '@/services/sync-reminder-channel'

/**
 * Mirrors the settings restore gate: only apply locale after a successful restore.
 */
async function applyLocaleAfterRestoreAttempt(input: {
	restoreOk: boolean
	/** Locale currently shown in the UI before restore. */
	activeLocale: AppLocale
	/** Preference written into settings by a successful restore. */
	restoredPreference: LocalePreference
	onApply: (locale: AppLocale) => Promise<void>
}): Promise<AppLocale> {
	if (!input.restoreOk) {
		return input.activeLocale
	}
	const preference = normalizeLocalePreference(input.restoredPreference)
	const locale = resolveAppLocale(preference, null)
	await input.onApply(locale)
	return locale
}

describe('restore locale live refresh behavior', () => {
	it('successful restore activates a non-RU locale immediately', async () => {
		let active: AppLocale = 'ru'
		const channelWrites: string[] = []

		active = await applyLocaleAfterRestoreAttempt({
			restoreOk: true,
			activeLocale: active,
			restoredPreference: 'de',
			onApply: async (locale) => {
				active = locale
				await syncReminderChannelFromPreference({
					preference: locale,
					writeChannel: async (_id, options) => {
						channelWrites.push(options.name)
					},
				})
			},
		})

		expect(active).toBe('de')
		expect(channelWrites).toEqual(['Erinnerungen'])
	})

	it('failed restore does not change the active locale', async () => {
		let active: AppLocale = 'en'
		const apply = jest.fn(async (locale: AppLocale) => {
			active = locale
		})

		const result = await applyLocaleAfterRestoreAttempt({
			restoreOk: false,
			activeLocale: active,
			restoredPreference: 'de',
			onApply: apply,
		})

		expect(result).toBe('en')
		expect(active).toBe('en')
		expect(apply).not.toHaveBeenCalled()
	})

	it('settings performRestore calls reload only after ok restore', () => {
		const settings = readFileSync(
			join(__dirname, '../../features/settings/settings-screen.tsx'),
			'utf8',
		)
		const block = settings.slice(
			settings.indexOf('async function performRestore'),
			settings.indexOf('async function handleLocaleSelect'),
		)
		const failIdx = block.indexOf('if (!result.ok)')
		const reloadIdx = block.indexOf('await reloadLocaleFromSettings()')
		expect(failIdx).toBeGreaterThan(-1)
		expect(reloadIdx).toBeGreaterThan(failIdx)
		const failReturn = block.indexOf('return', failIdx)
		expect(failReturn).toBeGreaterThan(failIdx)
		expect(failReturn).toBeLessThan(reloadIdx)
	})
})
