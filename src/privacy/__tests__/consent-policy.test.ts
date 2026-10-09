import {
	canEnableAds,
	canEnableAnalytics,
	canEnableOptionalSdks,
	isConsentPending,
	resolveConsentRequirement,
} from '@/privacy/consent-policy'
import {
	googleAdsCmpRequiredForJurisdiction,
	LOCALE_EXPANSION_PRIORITY,
	REGIONAL_CONSENT_MATRIX,
} from '@/privacy/consent-regions'
import {
	BLOCKED_MEDIATION_PARTNERS_UNTIL_APPROVAL,
	resolveConsentRuntimeSnapshot,
} from '@/privacy/cmp-adapter'
import {
	applyYandexUserConsent,
	mayInitializeAds,
	resetSdkConsentBridgeForTests,
} from '@/privacy/sdk-consent-bridge'
import {
	getConsentStoragePathsForTests,
	readPersistedPrivacyConsent,
	resetConsentWriteQueueForTests,
	writePersistedPrivacyConsent,
} from '@/privacy/consent-persistence'
import { MobileAds } from 'yandex-mobile-ads'
import * as FileSystem from 'expo-file-system/legacy'

describe('privacy consent policy (international)', () => {
	it('requires explicit first-party gate in production for both stores', () => {
		const gp = resolveConsentRequirement({
			storeId: 'googleplay',
			isProductionRuntime: true,
		})
		expect(gp.requiresExplicitConsent).toBe(true)
		expect(gp.isFirstPartyGateOnly).toBe(true)
		expect(gp.blocksGoogleDemandUntilCmp).toBe(true)
		expect(gp.adsPersonalizationSeparable).toBe(false)
	})

	it('skips consent gate in development', () => {
		expect(
			resolveConsentRequirement({
				storeId: 'googleplay',
				isProductionRuntime: false,
			}).requiresExplicitConsent,
		).toBe(false)
	})

	it('allows independent analytics vs ads purposes', () => {
		const requirement = resolveConsentRequirement({
			storeId: 'googleplay',
			isProductionRuntime: true,
		})
		expect(
			canEnableAnalytics('granted', requirement) &&
				!canEnableAds('denied', requirement),
		).toBe(true)
		expect(
			canEnableOptionalSdks(
				{ analytics: 'granted', ads: 'denied' },
				requirement,
			),
		).toBe(true)
		expect(
			canEnableOptionalSdks(
				{ analytics: 'denied', ads: 'denied' },
				requirement,
			),
		).toBe(false)
		expect(
			isConsentPending({ analytics: null, ads: null }, requirement),
		).toBe(true)
	})

	it('marks EEA/UK/CH as requiring Google-certified CMP before Google ads', () => {
		expect(googleAdsCmpRequiredForJurisdiction('eea_uk_ch')).toBe(true)
		expect(REGIONAL_CONSENT_MATRIX.us_state_privacy.requiresUsPrivacySignals).toBe(
			true,
		)
	})

	it('does not treat TC string alone as personalized-ads consent', () => {
		const denied = resolveConsentRuntimeSnapshot({
			analytics: 'denied',
			ads: 'denied',
			hasGoogleCertifiedCmpIntegration: true,
			cmpAllowsPersonalizedAds: true,
		})
		expect(denied.purposes.ads_personalized).toBe(false)
		expect(denied.purposes.ads_yandex).toBe(false)
	})

	it('keeps Google demand blocked without certified CMP integration', () => {
		const snapshot = resolveConsentRuntimeSnapshot({
			analytics: 'granted',
			ads: 'granted',
			hasGoogleCertifiedCmpIntegration: false,
		})
		expect(snapshot.provider).toBe('first_party_gate')
		expect(snapshot.blocksGoogleDemandUntilCmp).toBe(true)
	})

	it('lists mediation partners blocked until owner approval', () => {
		expect(BLOCKED_MEDIATION_PARTNERS_UNTIL_APPROVAL).toEqual(
			expect.arrayContaining(['admob', 'mintegral', 'applovin']),
		)
	})

	it('ships RU/EN/ES/DE and lists further locale priorities', () => {
		const shipped = LOCALE_EXPANSION_PRIORITY.filter((l) => l.status === 'shipped')
		expect(shipped.map((l) => l.code)).toEqual(['ru', 'en', 'es', 'de'])
	})
})

describe('Yandex setUserConsent bridge', () => {
	beforeEach(() => {
		resetSdkConsentBridgeForTests()
		jest.clearAllMocks()
	})

	it('does not call setUserConsent while ads purpose is pending', () => {
		applyYandexUserConsent(null)
		expect(MobileAds.setUserConsent).not.toHaveBeenCalled()
	})

	it('applies true on grant and false on deny without initializing ads', () => {
		applyYandexUserConsent('granted')
		expect(MobileAds.setUserConsent).toHaveBeenCalledWith(true)
		expect(MobileAds.initialize).not.toHaveBeenCalled()
		applyYandexUserConsent('denied')
		expect(MobileAds.setUserConsent).toHaveBeenCalledWith(false)
	})

	it('mayInitializeAds respects the gate', () => {
		expect(mayInitializeAds(null, true)).toBe(false)
		expect(mayInitializeAds('denied', true)).toBe(false)
		expect(mayInitializeAds('granted', true)).toBe(true)
	})
})

describe('consent persistence fail-closed', () => {
	beforeEach(() => {
		resetConsentWriteQueueForTests()
		jest.clearAllMocks()
		;(FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false })
		;(FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('{}')
		;(FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined)
	})

	it('writes purpose pair and re-reads after restart simulation', async () => {
		await writePersistedPrivacyConsent({
			analytics: 'denied',
			ads: 'denied',
		})
		expect(FileSystem.writeAsStringAsync).toHaveBeenCalled()
		const payload = (FileSystem.writeAsStringAsync as jest.Mock).mock
			.calls[0][1] as string
		;(FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true })
		;(FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(payload)
		const again = await readPersistedPrivacyConsent()
		expect(again.analytics).toBe('denied')
		expect(again.ads).toBe('denied')
	})

	it('propagates write failures instead of swallowing them', async () => {
		;(FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
			new Error('disk_full'),
		)
		await expect(
			writePersistedPrivacyConsent({
				analytics: 'denied',
				ads: 'denied',
			}),
		).rejects.toThrow('disk_full')
	})

	it('treats corrupt on-disk JSON as undecided (fail closed)', async () => {
		const paths = getConsentStoragePathsForTests()
		;(FileSystem.getInfoAsync as jest.Mock).mockImplementation(
			async (path: string) => ({
				exists: path === paths.v2,
			}),
		)
		;(FileSystem.readAsStringAsync as jest.Mock).mockImplementation(
			async () => '{"analytics":"wat"}',
		)
		const state = await readPersistedPrivacyConsent()
		expect(state.analytics).toBeNull()
		expect(state.ads).toBeNull()
		expect(state.storageStatus).toBe('corrupt')
	})

	it('serializes concurrent writes without dropping the last Reject', async () => {
		const order: string[] = []
		;(FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
			async (_path: string, body: string) => {
				order.push(body)
				await new Promise((r) => setTimeout(r, 5))
			},
		)
		const accept = writePersistedPrivacyConsent({
			analytics: 'granted',
			ads: 'granted',
		})
		const reject = writePersistedPrivacyConsent({
			analytics: 'denied',
			ads: 'denied',
		})
		await Promise.all([accept, reject])
		const last = JSON.parse(order[order.length - 1] as string) as {
			ads: string
		}
		expect(last.ads).toBe('denied')
	})

	it('writes mixed purposes without coercing to full deny', async () => {
		const files = new Map<string, string>()
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
		;(FileSystem.deleteAsync as jest.Mock).mockImplementation(
			async (path: string) => {
				files.delete(path)
			},
		)

		await writePersistedPrivacyConsent({
			analytics: 'denied',
			ads: 'granted',
		})
		const again = await readPersistedPrivacyConsent()
		expect(again.analytics).toBe('denied')
		expect(again.ads).toBe('granted')
	})
})
