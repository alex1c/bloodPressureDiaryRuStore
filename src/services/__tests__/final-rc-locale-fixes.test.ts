/**
 * Regression coverage for Codex P2 final-RC findings:
 * - multi-profile reminder titles must use the active locale (not defaultT=ru)
 * - Android channel display name follows locale with a stable channel id
 * - restore path exposes an explicit locale reload (repos identity unchanged)
 */
import { createTranslator } from '@/i18n'
import type { Profile, Reminder } from '@/domain/types'
import { buildTitleForStoredReminder } from '@/services/reminder-title'
import {
	ANDROID_CHANNEL_ID,
	androidChannelDisplayName,
} from '@/services/android-channel-name'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const profile: Profile = {
	id: 'p-mom',
	name: 'Mom',
	isDefault: false,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
}

function medReminder(overrides: Partial<Reminder> = {}): Reminder {
	return {
		id: 'r-med',
		profileId: profile.id,
		medicationId: 'm-1',
		title: 'Мама — напоминание о лекарстве',
		body: 'Losartan — запланированный приём в 08:00',
		hour: 8,
		minute: 0,
		weekdays: [1, 2, 3, 4, 5],
		enabled: true,
		platformNotificationId: 'plat-1',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

describe('multi-profile reminder locale (Codex P2)', () => {
	it('builds EN/ES/DE titles when translator is passed', () => {
		const reminder = medReminder()
		const en = buildTitleForStoredReminder(
			reminder,
			profile,
			true,
			createTranslator('en'),
		)
		const es = buildTitleForStoredReminder(
			reminder,
			profile,
			true,
			createTranslator('es'),
		)
		const de = buildTitleForStoredReminder(
			reminder,
			profile,
			true,
			createTranslator('de'),
		)

		expect(en).toBe('Mom — medication reminder')
		expect(es).toBe('Mom — recordatorio de medicamento')
		expect(de).toBe('Mom — medikamentenerinnerung')

		// Without an explicit translator, legacy defaultT=ru must not be used
		// by reconcile — callers pass createTranslator(activeLocale).
		expect(en).not.toMatch(/напоминание/i)
		expect(es).not.toMatch(/напоминание/i)
		expect(de).not.toMatch(/напоминание/i)
	})

	it('preserves schedule fields while only returning a title patch', () => {
		const reminder = medReminder({
			hour: 20,
			minute: 30,
			weekdays: [0, 6],
			enabled: true,
			platformNotificationId: 'keep-id',
		})
		const title = buildTitleForStoredReminder(
			reminder,
			profile,
			true,
			createTranslator('en'),
		)
		expect(title).toContain('Mom')
		expect(reminder.hour).toBe(20)
		expect(reminder.minute).toBe(30)
		expect(reminder.weekdays).toEqual([0, 6])
		expect(reminder.enabled).toBe(true)
		expect(reminder.platformNotificationId).toBe('keep-id')
		expect(reminder.medicationId).toBe('m-1')
		expect(reminder.profileId).toBe(profile.id)
	})

	it('would regress to Russian if translator is omitted (documents the bug)', () => {
		const title = buildTitleForStoredReminder(
			medReminder(),
			profile,
			true,
			undefined,
		)
		expect(title).toMatch(/напоминание/i)
	})

	it('reconcile passes active translator into buildTitleForStoredReminder', () => {
		const src = readFileSync(
			join(__dirname, '../reconcile-medication-reminders.ts'),
			'utf8',
		)
		expect(src).toContain('createTranslator(locale)')
		expect(src).toContain('buildTitleForStoredReminder(')
		expect(src).toMatch(
			/buildTitleForStoredReminder\(\s*reminder,\s*profile,\s*includeProfileName,\s*t,/s,
		)
	})
})

describe('Android notification channel localization (Codex P2)', () => {
	it('keeps a stable channel id across locales', () => {
		expect(ANDROID_CHANNEL_ID).toBe('app-reminders')
	})

	it('maps RU/EN/ES/DE to natural channel display names', () => {
		expect(androidChannelDisplayName('ru')).toBe('Напоминания')
		expect(androidChannelDisplayName('en')).toBe('Reminders')
		expect(androidChannelDisplayName('es')).toBe('Recordatorios')
		expect(androidChannelDisplayName('de')).toBe('Erinnerungen')
	})

	it('updates channel metadata via ensureAndroidChannelForLocale', () => {
		const src = readFileSync(
			join(__dirname, '../medication-notifications.ts'),
			'utf8',
		)
		expect(src).toContain('ensureAndroidChannelForLocale')
		expect(src).toContain('androidChannelDisplayName')
		expect(src).not.toMatch(
			/setNotificationChannelAsync\([\s\S]*name:\s*'Напоминания'/,
		)
	})
})

describe('restore locale live refresh (Codex P2)', () => {
	it('exposes reloadLocaleFromSettings on I18nProvider', () => {
		const provider = readFileSync(
			join(__dirname, '../../i18n/provider.tsx'),
			'utf8',
		)
		expect(provider).toContain('reloadLocaleFromSettings')
		expect(provider).toContain('repos.settings.get()')
		expect(provider).toContain('ensureAndroidChannelForLocale')
		expect(provider).toContain('refreshReminderCopyForLocale')
	})

	it('settings restore calls reloadLocaleFromSettings after success', () => {
		const settings = readFileSync(
			join(__dirname, '../../features/settings/settings-screen.tsx'),
			'utf8',
		)
		expect(settings).toContain('reloadLocaleFromSettings')
		const restoreBlock = settings.slice(
			settings.indexOf('async function performRestore'),
			settings.indexOf('async function handleLocaleSelect'),
		)
		expect(restoreBlock).toContain('await reloadLocaleFromSettings()')
		expect(restoreBlock).toContain('if (!result.ok)')
		// Failed restore returns before locale reload.
		const failIdx = restoreBlock.indexOf('if (!result.ok)')
		const reloadIdx = restoreBlock.indexOf('await reloadLocaleFromSettings()')
		expect(failIdx).toBeGreaterThan(-1)
		expect(reloadIdx).toBeGreaterThan(failIdx)
	})
})
