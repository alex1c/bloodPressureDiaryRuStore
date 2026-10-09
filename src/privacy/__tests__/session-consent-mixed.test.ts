/**
 * Independent purpose combinations (session runtime + preference round-trip).
 */

import * as FileSystem from 'expo-file-system/legacy'
import {
	readPersistedPrivacyConsent,
	resetConsentWriteQueueForTests,
	writePersistedPrivacyConsent,
} from '@/privacy/consent-persistence'
import {
	applySessionChoice,
	initialSessionRuntime,
	resolveRuntimePermissions,
} from '@/privacy/session-consent'

const COMBINATIONS: {
	analytics: 'granted' | 'denied'
	ads: 'granted' | 'denied'
}[] = [
	{ analytics: 'granted', ads: 'granted' },
	{ analytics: 'granted', ads: 'denied' },
	{ analytics: 'denied', ads: 'granted' },
	{ analytics: 'denied', ads: 'denied' },
]

describe('session consent mixed purposes', () => {
	const files = new Map<string, string>()

	beforeEach(() => {
		resetConsentWriteQueueForTests()
		files.clear()
		jest.clearAllMocks()
		;(FileSystem.getInfoAsync as jest.Mock).mockImplementation(
			async (path: string) => ({ exists: files.has(path) }),
		)
		;(FileSystem.readAsStringAsync as jest.Mock).mockImplementation(
			async (path: string) => {
				const body = files.get(path)
				if (body === undefined) {
					throw new Error('missing')
				}
				return body
			},
		)
		;(FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
			async (path: string, body: string) => {
				files.set(path, body)
			},
		)
		;(FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined)
	})

	it.each(COMBINATIONS)(
		'in-session %j maps to independent runtime flags',
		(combo) => {
			const session = applySessionChoice(combo)
			const runtime = resolveRuntimePermissions({
				session,
				requirementRequiresExplicitConsent: true,
			})
			expect(runtime.analyticsAllowed).toBe(combo.analytics === 'granted')
			expect(runtime.adsAllowed).toBe(combo.ads === 'granted')
		},
	)

	it('transitions across all four combinations without force-full-Reject', async () => {
		for (const combo of COMBINATIONS) {
			await writePersistedPrivacyConsent(combo)
			const prefs = await readPersistedPrivacyConsent()
			expect(prefs.analytics).toBe(combo.analytics)
			expect(prefs.ads).toBe(combo.ads)

			const session = applySessionChoice(combo)
			const runtime = resolveRuntimePermissions({
				session,
				requirementRequiresExplicitConsent: true,
			})
			expect(runtime.analyticsAllowed).toBe(combo.analytics === 'granted')
			expect(runtime.adsAllowed).toBe(combo.ads === 'granted')
		}
	})

	it('cold start after mixed Accept keeps runtime DENIED until confirm', async () => {
		await writePersistedPrivacyConsent({
			analytics: 'granted',
			ads: 'denied',
		})
		const prefs = await readPersistedPrivacyConsent()
		expect(prefs.analytics).toBe('granted')
		expect(prefs.ads).toBe('denied')

		const cold = resolveRuntimePermissions({
			session: initialSessionRuntime(),
			requirementRequiresExplicitConsent: true,
		})
		expect(cold.analyticsAllowed).toBe(false)
		expect(cold.adsAllowed).toBe(false)
	})
})
