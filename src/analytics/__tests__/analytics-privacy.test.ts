import AppMetrica from '@appmetrica/react-native-analytics'
import {
	createAppMetricaAnalyticsService,
	resetAppMetricaInitializationForTests,
} from '@/analytics/appmetrica-service'
import { sanitizeAnalyticsParams } from '@/analytics/sanitize'
import { analytics } from '@/analytics/events'
import {
	setAnalyticsBackend,
} from '@/analytics/backend'
import { createNoopAnalyticsBackend } from '@/analytics/noop-backend'

describe('analytics privacy', () => {
	it('strips forbidden health-related keys in non-strict mode', () => {
		const result = sanitizeAnalyticsParams({
			has_tags: true,
			systolic: 120,
			note: 'secret',
		})
		expect(result).toEqual({ has_tags: true })
	})

	it('throws in strict mode when forbidden keys are present', () => {
		expect(() =>
			sanitizeAnalyticsParams({ pulse: 70 }, { strict: true }),
		).toThrow(/Forbidden analytics key/)
	})

	it('typed measurement event sends only safe booleans', () => {
		const backend = createNoopAnalyticsBackend()
		const report = jest.spyOn(backend, 'report')
		setAnalyticsBackend(backend)

		analytics.trackMeasurementCreated({ hasTags: true, hasNote: false })

		expect(report).toHaveBeenCalledWith('measurement_created', {
			has_tags: true,
			has_note: false,
		})
	})

	it('initializes AppMetrica only once', () => {
		resetAppMetricaInitializationForTests()
		const service = createAppMetricaAnalyticsService()
		service.initialize()
		service.initialize()
		expect(AppMetrica.activate).toHaveBeenCalledTimes(1)
	})
})
