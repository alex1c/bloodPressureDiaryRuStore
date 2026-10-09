import AppMetrica from '@appmetrica/react-native-analytics'
import {
	createAppMetricaAnalyticsService,
	isAppMetricaInitializedForTests,
	resetAppMetricaInitializationForTests,
	setAnalyticsAllowed,
} from '@/analytics/appmetrica-service'

describe('AppMetrica activate failure and retry', () => {
	beforeEach(() => {
		resetAppMetricaInitializationForTests()
		jest.clearAllMocks()
	})

	it('does not mark initialized when activate throws', () => {
		setAnalyticsAllowed(true)
		;(AppMetrica.activate as jest.Mock).mockImplementation(() => {
			throw new Error('activate_failed')
		})
		const service = createAppMetricaAnalyticsService()
		expect(() => service.initialize()).toThrow('activate_failed')
		expect(isAppMetricaInitializedForTests()).toBe(false)
	})

	it('retries activate after a prior failure', () => {
		setAnalyticsAllowed(true)
		;(AppMetrica.activate as jest.Mock)
			.mockImplementationOnce(() => {
				throw new Error('activate_failed')
			})
			.mockImplementationOnce(() => undefined)

		const service = createAppMetricaAnalyticsService()
		expect(() => service.initialize()).toThrow('activate_failed')
		service.initialize()
		expect(isAppMetricaInitializedForTests()).toBe(true)
		expect(AppMetrica.activate).toHaveBeenCalledTimes(2)
	})
})
