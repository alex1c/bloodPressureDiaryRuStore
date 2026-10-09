import AppMetrica from '@appmetrica/react-native-analytics'
import {
	ANALYTICS_EVENT_ALLOWLIST,
	FORBIDDEN_ANALYTICS_EVENTS,
	filterAllowedAnalyticsEvent,
} from '@/analytics/allowlist'
import {
	createAppMetricaAnalyticsService,
	resetAppMetricaInitializationForTests,
	setAnalyticsAllowed,
} from '@/analytics/appmetrica-service'
import { sanitizeAnalyticsParams } from '@/analytics/sanitize'
import { FORBIDDEN_ANALYTICS_KEYS } from '@/analytics/forbidden-keys'
import { analytics } from '@/analytics/events'
import { setAnalyticsBackend } from '@/analytics/backend'
import { createNoopAnalyticsBackend } from '@/analytics/noop-backend'

describe('analytics privacy allowlist', () => {
	it('strips forbidden health-related keys in non-strict mode', () => {
		const result = sanitizeAnalyticsParams({
			has_tags: true,
			systolic: 120,
			note: 'secret',
			metric_type: 'weight',
		})
		expect(result).toEqual({ has_tags: true })
	})

	it('throws in strict mode when forbidden keys are present', () => {
		expect(() =>
			sanitizeAnalyticsParams({ pulse: 70 }, { strict: true }),
		).toThrow(/Forbidden analytics key/)
	})

	it('drops unknown events and medical mutation event names', () => {
		expect(filterAllowedAnalyticsEvent('totally_unknown_event')).toBeNull()
		for (const event of FORBIDDEN_ANALYTICS_EVENTS) {
			expect(filterAllowedAnalyticsEvent(event)).toBeNull()
		}
	})

	it('strips unexpected params from paramless allowlisted events', () => {
		expect(
			filterAllowedAnalyticsEvent('app_open', { systolic: 120 }),
		).toEqual({ event: 'app_open' })
		expect(
			filterAllowedAnalyticsEvent('graphs_opened', { note: 'x' }),
		).toEqual({ event: 'graphs_opened' })
		expect(
			filterAllowedAnalyticsEvent('doctor_report_pdf_created', {
				has_measurements: true,
				report_period: '2026-01-01',
			}),
		).toEqual({ event: 'doctor_report_pdf_created' })
		expect(
			filterAllowedAnalyticsEvent('graph_period_changed', {
				period: 'hacked',
			}),
		).toBeNull()
	})

	it('accepts only allowlisted graph period values', () => {
		expect(
			filterAllowedAnalyticsEvent('graph_period_changed', { period: '30' }),
		).toEqual({
			event: 'graph_period_changed',
			params: { period: '30' },
		})
	})

	it('medical mutation helpers never call the backend', () => {
		const backend = createNoopAnalyticsBackend()
		const report = jest.spyOn(backend, 'report')
		setAnalyticsBackend(backend)

		analytics.trackMeasurementCreated({ hasTags: true, hasNote: true })
		analytics.trackMeasurementUpdated()
		analytics.trackMeasurementDeleted()
		analytics.trackHealthMetricCreated('weight')
		analytics.trackMedicationCreated()
		analytics.trackMedicationUpdated()
		analytics.trackMedicationDeactivated()
		analytics.trackMedicationIntakeMarked()
		analytics.trackMedicationIntakeUndone()

		expect(report).not.toHaveBeenCalled()
	})

	it('doctor PDF/share events carry no medical params', () => {
		const backend = createNoopAnalyticsBackend()
		const report = jest.spyOn(backend, 'report')
		setAnalyticsBackend(backend)

		analytics.trackDoctorReportPdfCreated({
			reportPeriod: '2026-01-01 — 2026-01-31',
			hasMeasurements: true,
		})
		analytics.trackDoctorReportShared({
			reportPeriod: '7',
			hasMeasurements: false,
		})

		expect(report.mock.calls).toEqual([
			['doctor_report_pdf_created'],
			['doctor_report_shared'],
		])
	})

	it('technical allowlisted events still report', () => {
		const backend = createNoopAnalyticsBackend()
		const report = jest.spyOn(backend, 'report')
		setAnalyticsBackend(backend)

		analytics.trackAppOpen()
		analytics.trackGraphsOpened()
		analytics.trackGraphPeriodChanged(30)

		expect(report.mock.calls).toEqual([
			['app_open'],
			['graphs_opened'],
			['graph_period_changed', { period: '30' }],
		])
	})

	it('keeps a non-empty allowlist without forbidden medical events', () => {
		expect(Object.keys(ANALYTICS_EVENT_ALLOWLIST).length).toBeGreaterThan(5)
		for (const event of FORBIDDEN_ANALYTICS_EVENTS) {
			expect(
				Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_ALLOWLIST, event),
			).toBe(false)
		}
		expect(FORBIDDEN_ANALYTICS_KEYS).toEqual(
			expect.arrayContaining(['systolic', 'metric_type', 'dosage', 'intake']),
		)
	})

	it('rejects prototype pollution event names via hasOwnProperty', () => {
		expect(filterAllowedAnalyticsEvent('toString')).toBeNull()
		expect(filterAllowedAnalyticsEvent('constructor')).toBeNull()
		expect(filterAllowedAnalyticsEvent('__proto__')).toBeNull()
		expect(filterAllowedAnalyticsEvent('unknown_event_xyz')).toBeNull()
		// `in` would be true for toString — allowlist must not use `in`.
		expect('toString' in ANALYTICS_EVENT_ALLOWLIST).toBe(true)
		expect(
			Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_ALLOWLIST, 'toString'),
		).toBe(false)
	})

	it('disables AppMetrica app-open / deeplink tracking on activate', () => {
		resetAppMetricaInitializationForTests()
		setAnalyticsAllowed(true)
		const service = createAppMetricaAnalyticsService()
		service.initialize()
		expect(AppMetrica.activate).toHaveBeenCalledWith(
			expect.objectContaining({
				appOpenTrackingEnabled: false,
				locationTracking: false,
			}),
		)
		expect(AppMetrica.setLocationTracking).toHaveBeenCalledWith(false)
	})

	it('drops reports when analytics consent is revoked', () => {
		resetAppMetricaInitializationForTests()
		setAnalyticsAllowed(true)
		const service = createAppMetricaAnalyticsService()
		service.initialize()
		jest.clearAllMocks()
		setAnalyticsAllowed(false)
		service.report('app_open')
		expect(AppMetrica.reportEvent).not.toHaveBeenCalled()
	})

	it('does not activate AppMetrica before analytics is allowed', () => {
		resetAppMetricaInitializationForTests()
		const service = createAppMetricaAnalyticsService()
		service.initialize()
		expect(AppMetrica.activate).not.toHaveBeenCalled()
	})
})
