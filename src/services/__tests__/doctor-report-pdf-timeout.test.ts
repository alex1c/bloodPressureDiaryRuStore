import * as Print from 'expo-print'
import { generateDoctorPdf } from '@/services/doctor-report-pdf'
import type { DoctorReportData } from '@/domain/report/build-doctor-report'

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }))
jest.mock('expo-sharing', () => ({}))
jest.mock('@/domain/report/build-doctor-report', () => ({
	buildDoctorReportFileName: () => 'report.pdf',
}))
jest.mock('@/domain/report/render-doctor-report-html', () => ({
	renderDoctorReportHtml: () => '<html>Test</html>',
}))

describe('PDF renderer recovery', () => {
	beforeEach(() => jest.useFakeTimers())
	afterEach(() => jest.useRealTimers())

	it('rejects a stalled native renderer so the screen can offer retry', async () => {
		jest.mocked(Print.printToFileAsync).mockImplementationOnce(() => new Promise(() => {}))
		const result = generateDoctorPdf({} as DoctorReportData)
		const assertion = expect(result).rejects.toThrow('PDF rendering timed out')
		await jest.advanceTimersByTimeAsync(60_000)
		await assertion
		expect(jest.getTimerCount()).toBe(0)
	})

	it('returns a completed PDF and clears the deadline', async () => {
		jest.mocked(Print.printToFileAsync).mockResolvedValueOnce({ uri: 'file:///print.pdf', numberOfPages: 1 })
		await expect(generateDoctorPdf({} as DoctorReportData)).resolves.toEqual({
			uri: 'file:///print.pdf', fileName: 'report.pdf',
		})
		expect(jest.getTimerCount()).toBe(0)
	})
})
