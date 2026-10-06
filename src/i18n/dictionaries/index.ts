import type { AppLocale } from '../locale'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { ru, type MessageCatalog, type MessageKey } from './ru'

export type { MessageCatalog, MessageKey }

export const catalogs: Record<AppLocale, MessageCatalog> = {
	ru,
	en,
	es,
	de,
}

/** Ensures every catalog contains the same keys as the Russian baseline. */
export function assertCatalogCompleteness(): {
	ok: boolean
	missing: Partial<Record<AppLocale, MessageKey[]>>
} {
	const baseline = Object.keys(ru) as MessageKey[]
	const missing: Partial<Record<AppLocale, MessageKey[]>> = {}
	for (const locale of Object.keys(catalogs) as AppLocale[]) {
		const catalog = catalogs[locale]
		const absent = baseline.filter((key) => !(key in catalog) || !catalog[key])
		if (absent.length > 0) {
			missing[locale] = absent
		}
	}
	return { ok: Object.keys(missing).length === 0, missing }
}
