import type { HealthMetricKind } from '@/domain/types'
import type { StatsPeriodDays } from '@/domain/statistics/measurement-stats'
import { getAnalyticsBackend } from './backend'
import type { SafeAnalyticsParams } from './sanitize'

export type GraphAnalyticsPeriod = '7' | '30' | '90' | 'all'

export type HealthMetricAnalyticsType = HealthMetricKind

function toGraphPeriod(period: StatsPeriodDays): GraphAnalyticsPeriod {
	if (period === 'all') {
		return 'all'
	}
	return String(period) as GraphAnalyticsPeriod
}

function report(event: string, params?: SafeAnalyticsParams): void {
	getAnalyticsBackend().report(event, params)
}

/** Central analytics API — UI must use these typed helpers, not raw SDK calls. */
export const analytics = {
	trackAppOpen() {
		report('app_open')
	},

	trackAppSessionStarted() {
		report('app_session_started')
	},

	trackMeasurementCreated(input: { hasTags: boolean; hasNote: boolean }) {
		report('measurement_created', {
			has_tags: input.hasTags,
			has_note: input.hasNote,
		})
	},

	trackMeasurementUpdated(input: { hasTags: boolean; hasNote: boolean }) {
		report('measurement_updated', {
			has_tags: input.hasTags,
			has_note: input.hasNote,
		})
	},

	trackMeasurementDeleted() {
		report('measurement_deleted')
	},

	trackGraphsOpened() {
		report('graphs_opened')
	},

	trackGraphPeriodChanged(period: StatsPeriodDays) {
		report('graph_period_changed', { period: toGraphPeriod(period) })
	},

	trackMedicationCreated() {
		report('medication_created')
	},

	trackMedicationUpdated() {
		report('medication_updated')
	},

	trackMedicationDeactivated() {
		report('medication_deactivated')
	},

	trackMedicationIntakeMarked() {
		report('medication_intake_marked')
	},

	trackMedicationIntakeUndone() {
		report('medication_intake_undone')
	},

	trackReminderEnabled() {
		report('reminder_enabled')
	},

	trackReminderPermissionDenied() {
		report('reminder_permission_denied')
	},

	trackHealthMetricCreated(metricType: HealthMetricAnalyticsType) {
		report('health_metric_created', { metric_type: metricType })
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

	trackDoctorReportPdfCreated(input: {
		reportPeriod: string
		hasMeasurements: boolean
	}) {
		report('doctor_report_pdf_created', {
			report_period: input.reportPeriod,
			has_measurements: input.hasMeasurements,
		})
	},

	trackDoctorReportShared(input: {
		reportPeriod: string
		hasMeasurements: boolean
	}) {
		report('doctor_report_shared', {
			report_period: input.reportPeriod,
			has_measurements: input.hasMeasurements,
		})
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
} as const
