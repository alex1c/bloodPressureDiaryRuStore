import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
	cacheDirectory,
	copyAsync,
	deleteAsync,
	getInfoAsync,
} from 'expo-file-system/legacy'
import type { DoctorReportData } from '@/domain/report/build-doctor-report'
import { buildDoctorReportFileName } from '@/domain/report/build-doctor-report'
import { renderDoctorReportHtml } from '@/domain/report/render-doctor-report-html'

export type GeneratedDoctorPdf = {
	uri: string
	fileName: string
}

/**
 * Generates a PDF into the app cache with a stable, sanitized filename.
 * Does not share — caller invokes shareDoctorPdf after success UI.
 */
export async function generateDoctorPdf(
	data: DoctorReportData,
): Promise<GeneratedDoctorPdf> {
	const fileName = buildDoctorReportFileName(data)
	const html = renderDoctorReportHtml(data)
	const printed = await Print.printToFileAsync({ html })

	const base = cacheDirectory
	if (!base) {
		return { uri: printed.uri, fileName }
	}

	const target = `${base}reports/${fileName}`
	try {
		await ensureReportsDir(base)
		const existing = await getInfoAsync(target)
		if (existing.exists) {
			await deleteAsync(target, { idempotent: true })
		}
		await copyAsync({ from: printed.uri, to: target })
		// Best-effort cleanup of the anonymous print temp file.
		await deleteAsync(printed.uri, { idempotent: true }).catch(() => {})
		return { uri: target, fileName }
	} catch {
		// Fall back to the original print cache URI if rename/copy fails.
		return { uri: printed.uri, fileName }
	}
}

/** Opens the Android Share Sheet for an already-generated PDF. */
export async function shareDoctorPdf(pdf: GeneratedDoctorPdf): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('Sharing is not available on this device')
	}
	await Sharing.shareAsync(pdf.uri, {
		mimeType: 'application/pdf',
		dialogTitle: 'Поделиться отчётом',
		UTI: 'com.adobe.pdf',
	})
}

async function ensureReportsDir(base: string): Promise<void> {
	const dir = `${base}reports`
	const info = await getInfoAsync(dir)
	if (!info.exists) {
		const { makeDirectoryAsync } = await import('expo-file-system/legacy')
		await makeDirectoryAsync(dir, { intermediates: true })
	}
}
