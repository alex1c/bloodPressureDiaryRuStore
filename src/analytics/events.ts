import type { StatsPeriodDays } from '@/domain/statistics/measurement-stats'
import { getAnalyticsBackend } from './backend'
import { filterAllowedAnalyticsEvent } from './allowlist'
import type { SafeAnalyticsParams } from './sanitize'

export type GraphAnalyticsPeriod = '7' | '30' | '90' | 'all'

function toGraphPeriod(period: StatsPeriodDays): GraphAnalyticsPeriod {
	if (period === 'all') {
		return 'all'
	}
	return String(period) as GraphAnalyticsPeriod
}

function report(event: string, params?: SafeAnalyticsParams): void {
	const filtered = filterAllowedAnalyticsEvent(event, params)
	if (!filtered) {
		if (__DEV__) {
			console.warn('[analytics] dropped non-allowlisted event', event, params)
		}
		return
	}
	getAnalyticsBackend().report(filtered.event, filtered.params)
}

/**
 * Central analytics API.
 *
 * Privacy contract (Codex P1): never report events triggered by creating,
 * updating, or deleting medical diary data (measurements, health metrics,
 * medications, intakes). Doctor PDF/share events carry no medical params.
 */
export const analytics = {
	trackAppOpen() {
		report('app_open')
	},

	trackAppSessionStarted() {
		report('app_session_started')
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMeasurementCreated(_input?: { hasTags?: boolean; hasNote?: boolean }) {
		/* medical mutation — blocked */
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMeasurementUpdated(_input?: { hasTags?: boolean; hasNote?: boolean }) {
		/* medical mutation — blocked */
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMeasurementDeleted() {
		/* medical mutation — blocked */
	},

	trackGraphsOpened() {
		report('graphs_opened')
	},

	trackGraphPeriodChanged(period: StatsPeriodDays) {
		report('graph_period_changed', { period: toGraphPeriod(period) })
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMedicationCreated() {
		/* medical mutation — blocked */
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMedicationUpdated() {
		/* medical mutation — blocked */
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackMedicationDeactivated() {
		/* medical mutation — blocked */
	},

	/** @deprecated Medical intake fact — intentionally not reported. */
	trackMedicationIntakeMarked() {
		/* medical intake — blocked */
	},

	/** @deprecated Medical intake fact — intentionally not reported. */
	trackMedicationIntakeUndone() {
		/* medical intake — blocked */
	},

	trackReminderEnabled() {
		report('reminder_enabled')
	},

	trackReminderPermissionDenied() {
		report('reminder_permission_denied')
	},

	/** @deprecated Medical mutation — intentionally not reported. */
	trackHealthMetricCreated(_metricType?: string) {
		/* medical mutation — blocked */
	},

	trackProfileCreated() {
		report('profile_created')
	},

	trackProfileSwitched() {
		report('profile_switched')
	},

	trackDoctorReportOpened() {
		report('doctor_report_opened')
	},

	/** Feature usage only — no period ranges or measurement flags. */
	trackDoctorReportPdfCreated(_input?: {
		reportPeriod?: string
		hasMeasurements?: boolean
	}) {
		report('doctor_report_pdf_created')
	},

	/** Feature usage only — no period ranges or measurement flags. */
	trackDoctorReportShared(_input?: {
		reportPeriod?: string
		hasMeasurements?: boolean
	}) {
		report('doctor_report_shared')
	},

	trackBackupCreated() {
		report('backup_created')
	},

	trackBackupRestoreStarted() {
		report('backup_restore_started')
	},

	trackBackupRestoreSuccess() {
		report('backup_restore_success')
	},

	trackBackupRestoreFailed() {
		report('backup_restore_failed')
	},

	trackLocaleChanged(input: { locale: string; preference: string }) {
		report('locale_changed', {
			locale: input.locale,
			preference: input.preference,
		})
	},
} as const
