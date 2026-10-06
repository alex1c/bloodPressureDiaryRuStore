import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { analytics } from '@/analytics'
import type { DiaryRepositories } from '@/storage/repositories/types'
import {
	normalizeLocalePreference,
	type AppLocale,
	type LocalePreference,
} from './locale'
import { resolveLocaleFromPreference } from './device-locale'
import { translate, type TranslateParams } from './translate'
import type { MessageKey } from './dictionaries'

type I18nContextValue = {
	/** Stored preference (system or explicit). */
	preference: LocalePreference
	/** Resolved UI locale. */
	locale: AppLocale
	t: (key: MessageKey, params?: TranslateParams) => string
	setLocalePreference: (next: LocalePreference) => Promise<void>
}

const I18nContext = createContext<I18nContextValue | null>(null)

type I18nProviderProps = {
	repos: DiaryRepositories | null
	children: ReactNode
}

/**
 * Provides locale preference + translator to the React tree.
 * Preference is persisted in app settings; changing it refreshes reminder copy.
 */
export function I18nProvider({ repos, children }: I18nProviderProps) {
	const [preference, setPreference] = useState<LocalePreference>('system')
	const [locale, setLocale] = useState<AppLocale>(() =>
		resolveLocaleFromPreference('system'),
	)

	useEffect(() => {
		if (!repos) {
			return
		}
		let cancelled = false
		void (async () => {
			const settings = await repos.settings.get()
			if (cancelled) {
				return
			}
			const pref = normalizeLocalePreference(settings.locale)
			setPreference(pref)
			setLocale(resolveLocaleFromPreference(pref))
		})()
		return () => {
			cancelled = true
		}
	}, [repos])

	const setLocalePreference = useCallback(
		async (next: LocalePreference) => {
			const resolved = resolveLocaleFromPreference(next)
			setPreference(next)
			setLocale(resolved)
			if (repos) {
				const settings = await repos.settings.get()
				await repos.settings.update({
					...settings,
					locale: next,
				})
				// Lazy-load reminder services so Jest/domain imports of @/i18n
				// do not pull react-native notification modules at bootstrap.
				const { refreshReminderCopyForLocale } = await import(
					'@/services/reminder-locale'
				)
				const { reconcileAllProfileNotifications } = await import(
					'@/services/reconcile-medication-reminders'
				)
				await refreshReminderCopyForLocale({ repos, locale: resolved })
				await reconcileAllProfileNotifications({ repos })
			}
			analytics.trackLocaleChanged({ locale: resolved, preference: next })
		},
		[repos],
	)

	const t = useCallback(
		(key: MessageKey, params?: TranslateParams) =>
			translate(locale, key, params),
		[locale],
	)

	const value = useMemo(
		() => ({ preference, locale, t, setLocalePreference }),
		[preference, locale, t, setLocalePreference],
	)

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Access i18n from feature screens. */
export function useI18n(): I18nContextValue {
	const ctx = useContext(I18nContext)
	if (!ctx) {
		throw new Error('useI18n must be used within I18nProvider')
	}
	return ctx
}

/**
 * Safe translator for modules that may render before provider mount
 * (falls back to system-resolved locale).
 */
export function useOptionalI18n(): I18nContextValue {
	const ctx = useContext(I18nContext)
	if (ctx) {
		return ctx
	}
	const locale = resolveLocaleFromPreference('system')
	return {
		preference: 'system',
		locale,
		t: (key, params) => translate(locale, key, params),
		setLocalePreference: async () => {},
	}
}
