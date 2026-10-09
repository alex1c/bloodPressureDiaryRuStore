/**
 * Two-process style consent tests (separate read after write map mutation).
 *
 * 1.1.1 model: disk Accept never auto-enables SDKs on cold start.
 */

import * as FileSystem from 'expo-file-system/legacy'
import {
	getConsentStoragePathsForTests,
	readPersistedPrivacyConsent,
	resetConsentWriteQueueForTests,
	writePersistedPrivacyConsent,
} from '@/privacy/consent-persistence'
import {
	applySessionChoice,
	initialSessionRuntime,
	resolveRuntimePermissions,
} from '@/privacy/session-consent'

describe('consent session cold start (two-process simulation)', () => {
	const files = new Map<string, string>()

	beforeEach(() => {
		resetConsentWriteQueueForTests()
		files.clear()
		jest.clearAllMocks()

		;(FileSystem.getInfoAsync as jest.Mock).mockImplementation(
			async (path: string) => ({
				exists: files.has(path),
			}),
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
		;(FileSystem.deleteAsync as jest.Mock).mockImplementation(
			async (path: string) => {
				files.delete(path)
			},
		)
	})

	it('Accept → Reject write fails → cold start keeps runtime DENIED', async () => {
		const paths = getConsentStoragePathsForTests()

		// Process A: Accept persisted.
		await writePersistedPrivacyConsent({
			analytics: 'granted',
			ads: 'granted',
		})
		expect(JSON.parse(files.get(paths.v2)!).analytics).toBe('granted')

		// Process A: Reject write fails — Accept may remain on disk.
		;(FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
			async () => {
				throw new Error('tombstone_failed')
			},
		)
		await expect(
			writePersistedPrivacyConsent({
				analytics: 'denied',
				ads: 'denied',
			}),
		).rejects.toThrow('tombstone_failed')
		expect(JSON.parse(files.get(paths.v2)!).analytics).toBe('granted')

		// Process B (new JS runtime): preferences may still show Accept…
		const coldPrefs = await readPersistedPrivacyConsent()
		expect(coldPrefs.analytics).toBe('granted')
		expect(coldPrefs.ads).toBe('granted')

		// …but session runtime starts DENIED — SDKs must not activate.
		const session = initialSessionRuntime()
		const runtime = resolveRuntimePermissions({
			session,
			requirementRequiresExplicitConsent: true,
		})
		expect(session.sessionConfirmed).toBe(false)
		expect(runtime.analyticsAllowed).toBe(false)
		expect(runtime.adsAllowed).toBe(false)
	})

	it('legacy Accept on disk is preference only — runtime DENIED', async () => {
		const paths = getConsentStoragePathsForTests()
		files.set(
			paths.legacy,
			JSON.stringify({ choice: 'accepted', updatedAtIso: '2026-01-01' }),
		)

		const cold = await readPersistedPrivacyConsent()
		expect(cold.analytics).toBe('granted')
		expect(cold.ads).toBe('granted')

		const runtime = resolveRuntimePermissions({
			session: initialSessionRuntime(),
			requirementRequiresExplicitConsent: true,
		})
		expect(runtime.analyticsAllowed).toBe(false)
		expect(runtime.adsAllowed).toBe(false)
	})

	it('treats probe errors as untrusted preferences; runtime still DENIED', async () => {
		;(FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
			new Error('fs_unavailable'),
		)
		const cold = await readPersistedPrivacyConsent()
		expect(cold.analytics).toBeNull()
		expect(cold.ads).toBeNull()
		expect(cold.storageStatus).toBe('untrusted')

		const runtime = resolveRuntimePermissions({
			session: initialSessionRuntime(),
			requirementRequiresExplicitConsent: true,
		})
		expect(runtime.analyticsAllowed).toBe(false)
		expect(runtime.adsAllowed).toBe(false)
	})

	it('preserves mixed purpose preferences across processes', async () => {
		await writePersistedPrivacyConsent({
			analytics: 'denied',
			ads: 'granted',
		})
		const cold = await readPersistedPrivacyConsent()
		expect(cold.analytics).toBe('denied')
		expect(cold.ads).toBe('granted')

		const runtimeCold = resolveRuntimePermissions({
			session: initialSessionRuntime(),
			requirementRequiresExplicitConsent: true,
		})
		expect(runtimeCold.analyticsAllowed).toBe(false)
		expect(runtimeCold.adsAllowed).toBe(false)

		const confirmed = applySessionChoice({
			analytics: 'denied',
			ads: 'granted',
		})
		const runtime = resolveRuntimePermissions({
			session: confirmed,
			requirementRequiresExplicitConsent: true,
		})
		expect(runtime.analyticsAllowed).toBe(false)
		expect(runtime.adsAllowed).toBe(true)
	})
})
