import {
	DEFAULT_ENABLED_METRIC_KINDS,
	normalizeEnabledKinds,
} from '@/domain/health/metric-catalog'
import type { DiaryBackup } from '@/domain/backup/validate-backup'
import type {
	AppSettings,
	HealthMetric,
	Measurement,
	Medication,
	MedicationIntake,
	Profile,
	ProfileMetricSettings,
	Reminder,
} from '@/domain/types'
import { resolveActiveSettings } from './import-backup-dataset'

type MemorySnapshot = {
	profiles: Map<string, Profile>
	measurements: Map<string, Measurement>
	healthMetrics: Map<string, HealthMetric>
	metricSettings: Map<string, ProfileMetricSettings>
	medications: Map<string, Medication>
	intakes: Map<string, MedicationIntake>
	reminders: Map<string, Reminder>
	settings: AppSettings
}

/** Captures in-memory store state for transactional rollback in tests. */
export function captureMemorySnapshot(input: {
	profiles: Map<string, Profile>
	measurements: Map<string, Measurement>
	healthMetrics: Map<string, HealthMetric>
	metricSettings: Map<string, ProfileMetricSettings>
	medications: Map<string, Medication>
	intakes: Map<string, MedicationIntake>
	reminders: Map<string, Reminder>
	settings: AppSettings
}): MemorySnapshot {
	return {
		profiles: new Map(input.profiles),
		measurements: new Map(input.measurements),
		healthMetrics: new Map(input.healthMetrics),
		metricSettings: new Map(input.metricSettings),
		medications: new Map(input.medications),
		intakes: new Map(input.intakes),
		reminders: new Map(input.reminders),
		settings: { ...input.settings },
	}
}

export function restoreMemorySnapshot(
	target: MemorySnapshot,
	snapshot: MemorySnapshot,
): void {
	target.profiles.clear()
	for (const [k, v] of snapshot.profiles) {
		target.profiles.set(k, { ...v })
	}
	target.measurements.clear()
	for (const [k, v] of snapshot.measurements) {
		target.measurements.set(k, { ...v })
	}
	target.healthMetrics.clear()
	for (const [k, v] of snapshot.healthMetrics) {
		target.healthMetrics.set(k, { ...v })
	}
	target.metricSettings.clear()
	for (const [k, v] of snapshot.metricSettings) {
		target.metricSettings.set(k, { ...v })
	}
	target.medications.clear()
	for (const [k, v] of snapshot.medications) {
		target.medications.set(k, { ...v })
	}
	target.intakes.clear()
	for (const [k, v] of snapshot.intakes) {
		target.intakes.set(k, { ...v })
	}
	target.reminders.clear()
	for (const [k, v] of snapshot.reminders) {
		target.reminders.set(k, { ...v })
	}
	target.settings = { ...snapshot.settings }
}

	/** Test hook: inject failure after N import steps inside memory restore. */
export type MemoryImportFailureHook = {
	afterStep: number
}

let memoryImportFailureHook: MemoryImportFailureHook | null = null

export function setMemoryImportFailureHookForTests(
	hook: MemoryImportFailureHook | null,
): void {
	memoryImportFailureHook = hook
}

/** Replaces all in-memory user data from a validated backup. */
export function importBackupDatasetMemory(
	target: MemorySnapshot,
	backup: DiaryBackup,
): void {
	let step = 0
	const bump = () => {
		step += 1
		if (
			memoryImportFailureHook &&
			step >= memoryImportFailureHook.afterStep
		) {
			throw new Error('Injected import failure')
		}
	}

	target.profiles.clear()
	target.measurements.clear()
	target.healthMetrics.clear()
	target.metricSettings.clear()
	target.medications.clear()
	target.intakes.clear()
	target.reminders.clear()

	bump()

	for (const profile of backup.profiles) {
		target.profiles.set(profile.id, { ...profile })
	}
	bump()

	const settingsByProfile = new Map(
		backup.profileMetricSettings.map((row) => [row.profileId, row]),
	)
	for (const profile of backup.profiles) {
		const row =
			settingsByProfile.get(profile.id) ??
			({
				profileId: profile.id,
				enabledKinds: [...DEFAULT_ENABLED_METRIC_KINDS],
				updatedAt: profile.updatedAt,
			} as const)
		target.metricSettings.set(profile.id, {
			profileId: profile.id,
			enabledKinds: normalizeEnabledKinds(row.enabledKinds),
			updatedAt: row.updatedAt,
		})
	}
	bump()

	for (const med of backup.medications) {
		target.medications.set(med.id, { ...med })
	}
	bump()

	for (const m of backup.measurements) {
		target.measurements.set(m.id, { ...m })
	}
	bump()

	for (const h of backup.healthMetrics) {
		target.healthMetrics.set(h.id, { ...h })
	}
	bump()

	for (const intake of backup.medicationIntakes) {
		target.intakes.set(intake.id, { ...intake })
	}
	bump()

	for (const reminder of backup.reminders) {
		target.reminders.set(reminder.id, {
			...reminder,
			platformNotificationId: null,
		})
	}
	bump()

	target.settings = resolveActiveSettings(backup.settings, backup.profiles)
}
