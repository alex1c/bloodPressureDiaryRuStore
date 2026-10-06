import type { ChartPoint } from '@/domain/statistics/measurement-stats'
import { getActiveStoreConfig } from '@/config/active-store'
import { getStoreConfig, type StoreId } from '@/config/store'
import type { AppLocale } from '@/i18n/locale'
import { createTranslator } from '@/i18n/translate'
import type { MessageKey } from '@/i18n/dictionaries'
import type { DoctorReportData } from './build-doctor-report'

export type DoctorReportRenderOptions = {
	locale: AppLocale
	storeId?: StoreId
}

/**
 * Renders a printable HTML document from a frozen DoctorReportData snapshot.
 * Locale drives copy; store drives the download footer URL/label.
 */
export function renderDoctorReportHtml(
	data: DoctorReportData,
	options: DoctorReportRenderOptions = { locale: 'ru' },
): string {
	const locale = options.locale
	const t = createTranslator(locale)
	const store = options.storeId
		? getStoreConfig(options.storeId)
		: getActiveStoreConfig()

	const profile = escapeHtml(data.profileName)
	const chart =
		data.chartPoints.length > 0
			? `<div class="chart">${buildBpChartSvg(data.chartPoints, t)}</div>`
			: ''

	const bpSection =
		data.bp.count === 0
			? `<p class="muted">${escapeHtml(t('report.pdf.noBp'))}</p>`
			: `<table class="summary">
					<tr><td>${escapeHtml(t('report.pdf.count'))}</td><td>${data.bp.count}</td></tr>
					<tr><td>${escapeHtml(t('report.pdf.avgBp'))}</td><td>${bpPair(data.bp.avgSystolic, data.bp.avgDiastolic)}</td></tr>
					<tr><td>${escapeHtml(t('report.pdf.avgPulse'))}</td><td>${data.bp.avgPulse ?? '—'}</td></tr>
					<tr><td>${escapeHtml(t('report.pdf.minBp'))}</td><td>${bpPair(data.bp.minSystolic, data.bp.minDiastolic)}</td></tr>
					<tr><td>${escapeHtml(t('report.pdf.maxBp'))}</td><td>${bpPair(data.bp.maxSystolic, data.bp.maxDiastolic)}</td></tr>
					${
						data.bp.morning
							? `<tr><td>${escapeHtml(t('report.pdf.morningAvg'))}</td><td>${bpPair(data.bp.morning.avgSystolic, data.bp.morning.avgDiastolic)}</td></tr>`
							: ''
					}
					${
						data.bp.evening
							? `<tr><td>${escapeHtml(t('report.pdf.eveningAvg'))}</td><td>${bpPair(data.bp.evening.avgSystolic, data.bp.evening.avgDiastolic)}</td></tr>`
							: ''
					}
				</table>`

	const measurementRows = data.measurements
		.map((m) => {
			const tags = m.tagsLabel ? escapeHtml(m.tagsLabel) : '—'
			const note = m.noteShort
				? escapeHtml(t('report.pdf.note', { note: m.noteShort }))
				: ''
			return `<tr>
				<td>${escapeHtml(m.dayLabel)}</td>
				<td>${escapeHtml(m.timeLabel)}</td>
				<td>${m.systolic} / ${m.diastolic}</td>
				<td>${m.pulse}</td>
				<td>${tags}</td>
			</tr>${
				note
					? `<tr class="note-row"><td colspan="5">${note}</td></tr>`
					: ''
			}`
		})
		.join('')

	const measurementsSection =
		data.measurements.length === 0
			? ''
			: `<h2>${escapeHtml(t('report.pdf.measurements'))}</h2>
				<table class="data">
					<thead>
						<tr>
							<th>${escapeHtml(t('report.pdf.col.date'))}</th>
							<th>${escapeHtml(t('report.pdf.col.time'))}</th>
							<th>${escapeHtml(t('report.pdf.col.bp'))}</th>
							<th>${escapeHtml(t('report.pdf.col.pulse'))}</th>
							<th>${escapeHtml(t('report.pdf.col.context'))}</th>
						</tr>
					</thead>
					<tbody>${measurementRows}</tbody>
				</table>`

	const medSection =
		data.medications.length === 0
			? ''
			: `<h2>${escapeHtml(t('report.pdf.medications'))}</h2>
				${data.medications
					.map(
						(m) => `<div class="med">
							<div class="med-title">${escapeHtml(m.name)}${m.dosageText ? ` — ${escapeHtml(m.dosageText)}` : ''}</div>
							<div class="med-meta">${escapeHtml(t('report.pdf.schedule', { schedule: m.scheduleLabel || '—' }))}</div>
							<div class="med-meta">${escapeHtml(t('report.pdf.takenCount', { count: m.takenCountInPeriod }))}</div>
						</div>`,
					)
					.join('')}`

	const healthSection =
		data.health.length === 0
			? ''
			: `<h2>${escapeHtml(t('report.pdf.health'))}</h2>
				${data.health
					.map(
						(h) => `<div class="health">
							<div class="health-title">${escapeHtml(h.label)}</div>
							<div>${escapeHtml(t('report.pdf.latest', { value: h.latestValueFormatted, unit: h.unit }))}</div>
							${
								h.periodDeltaFormatted
									? `<div>${escapeHtml(t('report.pdf.periodChange', { value: h.periodDeltaFormatted }))}</div>`
									: ''
							}
						</div>`,
					)
					.join('')}`

	const tagsSection =
		data.tagStats.length === 0
			? ''
			: `<h2>${escapeHtml(t('report.pdf.tags'))}</h2>
				<ul class="tags">
					${data.tagStats
						.map(
							(tag) =>
								`<li>${escapeHtml(
									t('report.pdf.tagLine', {
										label: tag.label,
										count: tag.count,
										records: pluralRecords(tag.count, t),
										bp: bpPair(tag.avgSystolic, tag.avgDiastolic),
									}),
								)}</li>`,
						)
						.join('')}
				</ul>`

	const downloadKey: MessageKey =
		store.storeId === 'googleplay'
			? 'report.pdf.download.googleplay'
			: 'report.pdf.download.rustore'

	return `<!DOCTYPE html>
<html lang="${locale}">
<head>
	<meta charset="utf-8" />
	<title>${escapeHtml(t('report.pdf.appTitle'))} — ${profile}</title>
	<style>
		@page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; }
		* { box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "DejaVu Sans", Arial, sans-serif;
			color: #111;
			font-size: 11pt;
			line-height: 1.35;
			margin: 0;
			padding: 0;
			background: #fff;
		}
		h1 { font-size: 18pt; margin: 0 0 6px; font-weight: 700; }
		h2 {
			font-size: 13pt;
			margin: 18px 0 8px;
			padding-bottom: 4px;
			border-bottom: 1px solid #ccc;
			page-break-after: avoid;
		}
		.meta { color: #444; margin: 2px 0; }
		.muted { color: #666; }
		.summary { width: 100%; border-collapse: collapse; margin-top: 8px; }
		.summary td { padding: 4px 0; border-bottom: 1px solid #eee; }
		.summary td:last-child { text-align: right; font-weight: 600; }
		.chart { margin: 10px 0 4px; page-break-inside: avoid; }
		table.data {
			width: 100%;
			border-collapse: collapse;
			font-size: 9.5pt;
		}
		table.data th, table.data td {
			border: 1px solid #ddd;
			padding: 4px 6px;
			text-align: left;
			vertical-align: top;
		}
		table.data th { background: #f3f3f3; font-weight: 600; }
		table.data tr { page-break-inside: avoid; }
		.note-row td { font-size: 9pt; color: #444; background: #fafafa; }
		.med, .health {
			margin: 0 0 10px;
			padding-bottom: 8px;
			border-bottom: 1px solid #eee;
			page-break-inside: avoid;
		}
		.med-title, .health-title { font-weight: 700; }
		.med-meta { color: #444; font-size: 10pt; }
		.tags { margin: 0; padding-left: 18px; }
		.tags li { margin-bottom: 4px; page-break-inside: avoid; }
		.disclaimer {
			margin-top: 22px;
			padding-top: 10px;
			border-top: 1px solid #bbb;
			font-size: 9pt;
			color: #555;
			page-break-inside: avoid;
		}
		.store-footer {
			margin-top: 16px;
			padding-top: 10px;
			border-top: 1px solid #bbb;
			font-size: 9pt;
			color: #444;
			page-break-inside: avoid;
		}
		.store-footer a {
			color: #1a5fb4;
			text-decoration: underline;
		}
		.store-footer .url {
			display: block;
			margin-top: 4px;
			font-size: 8pt;
			color: #666;
			word-break: break-all;
		}
	</style>
</head>
<body>
	<h1>${escapeHtml(t('report.pdf.appTitle'))}</h1>
	<p class="meta">${escapeHtml(t('report.pdf.profile', { name: data.profileName }))}</p>
	<p class="meta">${escapeHtml(t('report.pdf.period', { period: data.periodLabel }))}</p>

	<h2>${escapeHtml(t('report.pdf.bpSection'))}</h2>
	${bpSection}
	${chart}

	${measurementsSection}
	${medSection}
	${healthSection}
	${tagsSection}

	<p class="disclaimer">${escapeHtml(t('report.disclaimer'))}</p>
	${buildStorePdfFooterHtml({
		appUrl: store.pdfAppUrl,
		footerLine: t('report.pdf.footerLine'),
		downloadLabel: t(downloadKey),
	})}
</body>
</html>`
}

/** Escapes text for safe insertion into HTML templates. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function bpPair(
	sys: number | null | undefined,
	dia: number | null | undefined,
): string {
	if (sys == null || dia == null) {
		return '—'
	}
	return `${sys} / ${dia}`
}

/**
 * Inline SVG BP chart for PDF (systolic + diastolic, chronological).
 * Keeps labels sparse so 90-day reports stay readable.
 */
export function buildBpChartSvg(
	points: ChartPoint[],
	t: (key: MessageKey) => string = createTranslator('ru'),
): string {
	if (points.length === 0) {
		return ''
	}

	const width = 520
	const height = 180
	const padL = 36
	const padR = 12
	const padT = 12
	const padB = 28
	const plotW = width - padL - padR
	const plotH = height - padT - padB

	const sys = points.map((p) => p.systolic)
	const dia = points.map((p) => p.diastolic)
	const minY = Math.min(...sys, ...dia) - 10
	const maxY = Math.max(...sys, ...dia) + 10
	const spanY = Math.max(1, maxY - minY)

	const xAt = (i: number) =>
		padL + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1))
	const yAt = (v: number) => padT + plotH - ((v - minY) / spanY) * plotH

	const sysPath = points
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.systolic).toFixed(1)}`)
		.join(' ')
	const diaPath = points
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.diastolic).toFixed(1)}`)
		.join(' ')

	const labelIndexes =
		points.length <= 6
			? points.map((_, i) => i)
			: [0, Math.floor((points.length - 1) / 2), points.length - 1]

	const xLabels = labelIndexes
		.map((i) => {
			const d = new Date(points[i]!.measuredAt)
			const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
			return `<text x="${xAt(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="9" fill="#555">${escapeHtml(label)}</text>`
		})
		.join('')

	const yTicks = [minY + spanY * 0.25, minY + spanY * 0.5, minY + spanY * 0.75].map(
		(v) => {
			const y = yAt(v)
			return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#e5e5e5" stroke-width="1" />
				<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#666">${Math.round(v)}</text>`
		},
	)

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
		<rect x="0" y="0" width="${width}" height="${height}" fill="#fff" />
		${yTicks.join('\n')}
		<path d="${sysPath}" fill="none" stroke="#1a1a1a" stroke-width="1.6" />
		<path d="${diaPath}" fill="none" stroke="#666" stroke-width="1.4" stroke-dasharray="4 3" />
		${xLabels}
		<text x="${padL}" y="10" font-size="9" fill="#333">${escapeHtml(t('report.pdf.chartLegend'))}</text>
	</svg>`
}

/**
 * Store distribution footer with a real HTML hyperlink annotation.
 * expo-print preserves &lt;a href&gt; as a clickable PDF link.
 */
export function buildStorePdfFooterHtml(input: {
	appUrl: string
	footerLine: string
	downloadLabel: string
}): string {
	const url = escapeHtml(input.appUrl)
	return `<div class="store-footer">
		<div>${escapeHtml(input.footerLine)}</div>
		<div><a href="${url}">${escapeHtml(input.downloadLabel)}</a></div>
		<span class="url">${url}</span>
	</div>`
}

/**
 * @deprecated Prefer buildStorePdfFooterHtml with active store config.
 * Kept so older RuStore-only tests keep compiling during migration.
 */
export function buildRustorePdfFooterHtml(): string {
	const store = getActiveStoreConfig()
	const t = createTranslator('ru')
	return buildStorePdfFooterHtml({
		appUrl: store.pdfAppUrl,
		footerLine: t('report.pdf.footerLine'),
		downloadLabel: t('report.pdf.download.rustore'),
	})
}

/** @deprecated Use getActiveStoreConfig().pdfAppUrl */
export const RUSTORE_APP_URL =
	'https://www.rustore.ru/catalog/app/com.calculatorplatform.bpdiary'

function pluralRecords(
	count: number,
	t: (key: MessageKey) => string,
): string {
	const mod10 = count % 10
	const mod100 = count % 100
	if (mod10 === 1 && mod100 !== 11) {
		return t('report.pdf.records.one')
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return t('report.pdf.records.few')
	}
	return t('report.pdf.records.many')
}
