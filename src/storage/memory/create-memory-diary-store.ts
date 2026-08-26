import {
	applyMeasurementUpdate,
	buildMeasurement,
} from '@/domain/measurement/build-measurement'
import { createEntityId, nowIso } from '@/domain/ids'
import type {
	AppSettings,
	CreateMeasurementInput,
	HealthMetric,
	Measurement,
	Medication,
	MedicationIntake,
	Profile,
	Reminder,
	UpdateMeasurementInput,
} from '@/domain/types'
import { CURRENT_SCHEMA_VERSION } from '../schema-version'
import type { DiaryRepositories } from '../repositories/types'

/**
 * In-memory diary store for unit tests and Node-side domain persistence checks.
 * Mirrors production repository contracts without SQLite.
 */
export function createMemoryDiaryStore(): DiaryRepositories {
	const profiles = new Map<string, Profile>()
	const measurements = new Map<string, Measurement>()
	const healthMetrics = new Map<string, HealthMetric>()
	const medications = new Map<string, Medication>()
	const intakes = new Map<string, MedicationIntake>()
	const reminders = new Map<string, Reminder>()
	let settings: AppSettings = {
		activeProfileId: null,
		locale: 'ru',
		hasCompletedFirstMeasurement: false,
	}
	const schemaVersion = CURRENT_SCHEMA_VERSION

	async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
		// Memory store is single-threaded; transaction is a sequencing seam
		// matching the SQLite repository API for shared call sites / tests.
		return fn()
	}

	return {
		getSchemaVersion: async () => schemaVersion,
		withTransaction,
		profiles: {
			async list() {
				return [...profiles.values()].sort((a, b) =>
					a.createdAt.localeCompare(b.createdAt),
				)
			},
			async getById(id) {
				return profiles.get(id) ?? null
			},
			async create(input) {
				const timestamp = nowIso()
				const profile: Profile = {
					id: createEntityId(),
					name: input.name,
					isDefault: input.isDefault ?? false,
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				profiles.set(profile.id, profile)
				if (settings.activeProfileId === null) {
					settings = { ...settings, activeProfileId: profile.id }
				}
				return profile
			},
			async update(id, patch) {
				const existing = profiles.get(id)
				if (!existing) {
					throw new Error(`Profile not found: ${id}`)
				}
				const next: Profile = {
					...existing,
					name: patch.name ?? existing.name,
					isDefault:
						patch.isDefault === undefined
							? existing.isDefault
							: patch.isDefault,
					updatedAt: nowIso(),
				}
				profiles.set(id, next)
				return next
			},
			async delete(id) {
				profiles.delete(id)
				for (const [mid, m] of [...measurements.entries()]) {
					if (m.profileId === id) {
						measurements.delete(mid)
					}
				}
				for (const [hid, h] of [...healthMetrics.entries()]) {
					if (h.profileId === id) {
						healthMetrics.delete(hid)
					}
				}
				for (const [xid, x] of [...medications.entries()]) {
					if (x.profileId === id) {
						medications.delete(xid)
					}
				}
				for (const [iid, i] of [...intakes.entries()]) {
					if (i.profileId === id) {
						intakes.delete(iid)
					}
				}
				for (const [rid, r] of [...reminders.entries()]) {
					if (r.profileId === id) {
						reminders.delete(rid)
					}
				}
				if (settings.activeProfileId === id) {
					settings = { ...settings, activeProfileId: null }
				}
			},
		},
		measurements: {
			async listByProfile(profileId) {
				return [...measurements.values()]
					.filter((m) => m.profileId === profileId)
					.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
			},
			async listByProfileOnDay(profileId, dayIsoDate) {
				return [...measurements.values()]
					.filter(
						(m) =>
							m.profileId === profileId &&
							m.measuredAt.slice(0, 10) === dayIsoDate,
					)
					.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
			},
			async listByProfileInRange(profileId, fromIso, toIso) {
				return [...measurements.values()]
					.filter(
						(m) =>
							m.profileId === profileId &&
							m.measuredAt >= fromIso &&
							m.measuredAt <= toIso,
					)
					.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
			},
			async getById(id) {
				return measurements.get(id) ?? null
			},
			async create(input: CreateMeasurementInput) {
				if (!profiles.has(input.profileId)) {
					throw new Error(`Unknown profile: ${input.profileId}`)
				}
				const measurement = buildMeasurement(input)
				measurements.set(measurement.id, measurement)
				if (!settings.hasCompletedFirstMeasurement) {
					settings = {
						...settings,
						hasCompletedFirstMeasurement: true,
					}
				}
				return measurement
			},
			async update(id, patch: UpdateMeasurementInput) {
				const existing = measurements.get(id)
				if (!existing) {
					throw new Error(`Measurement not found: ${id}`)
				}
				const next = applyMeasurementUpdate(existing, patch)
				measurements.set(id, next)
				return next
			},
			async delete(id) {
				measurements.delete(id)
			},
		},
		healthMetrics: {
			async listByProfile(profileId) {
				return [...healthMetrics.values()]
					.filter((h) => h.profileId === profileId)
					.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
			},
			async create(input) {
				if (!profiles.has(input.profileId)) {
					throw new Error(`Unknown profile: ${input.profileId}`)
				}
				const timestamp = nowIso()
				const row: HealthMetric = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				healthMetrics.set(row.id, row)
				return row
			},
			async delete(id) {
				healthMetrics.delete(id)
			},
		},
		medications: {
			async listByProfile(profileId) {
				return [...medications.values()].filter(
					(m) => m.profileId === profileId,
				)
			},
			async create(input) {
				if (!profiles.has(input.profileId)) {
					throw new Error(`Unknown profile: ${input.profileId}`)
				}
				const timestamp = nowIso()
				const row: Medication = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				medications.set(row.id, row)
				return row
			},
			async update(id, patch) {
				const existing = medications.get(id)
				if (!existing) {
					throw new Error(`Medication not found: ${id}`)
				}
				const next: Medication = {
					...existing,
					...patch,
					id: existing.id,
					profileId: existing.profileId,
					createdAt: existing.createdAt,
					updatedAt: nowIso(),
				}
				medications.set(id, next)
				return next
			},
			async delete(id) {
				medications.delete(id)
				for (const [iid, intake] of [...intakes.entries()]) {
					if (intake.medicationId === id) {
						intakes.delete(iid)
					}
				}
			},
		},
		medicationIntakes: {
			async listByProfile(profileId) {
				return [...intakes.values()]
					.filter((i) => i.profileId === profileId)
					.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
			},
			async listByMedication(medicationId) {
				return [...intakes.values()]
					.filter((i) => i.medicationId === medicationId)
					.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
			},
			async create(input) {
				if (!profiles.has(input.profileId)) {
					throw new Error(`Unknown profile: ${input.profileId}`)
				}
				if (!medications.has(input.medicationId)) {
					throw new Error(`Unknown medication: ${input.medicationId}`)
				}
				const timestamp = nowIso()
				const row: MedicationIntake = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				intakes.set(row.id, row)
				return row
			},
			async delete(id) {
				intakes.delete(id)
			},
		},
		reminders: {
			async listByProfile(profileId) {
				return [...reminders.values()].filter(
					(r) => r.profileId === profileId,
				)
			},
			async create(input) {
				if (!profiles.has(input.profileId)) {
					throw new Error(`Unknown profile: ${input.profileId}`)
				}
				const timestamp = nowIso()
				const row: Reminder = {
					...input,
					id: createEntityId(),
					createdAt: timestamp,
					updatedAt: timestamp,
				}
				reminders.set(row.id, row)
				return row
			},
			async update(id, patch) {
				const existing = reminders.get(id)
				if (!existing) {
					throw new Error(`Reminder not found: ${id}`)
				}
				const next: Reminder = {
					...existing,
					...patch,
					id: existing.id,
					profileId: existing.profileId,
					createdAt: existing.createdAt,
					updatedAt: nowIso(),
				}
				reminders.set(id, next)
				return next
			},
			async delete(id) {
				reminders.delete(id)
			},
		},
		settings: {
			async get() {
				return { ...settings }
			},
			async update(patch) {
				settings = { ...settings, ...patch }
				return { ...settings }
			},
		},
	}
}

/** Test helper: force schema version (simulates pre-migration state). */
export function setMemorySchemaVersionForTests(
	store: DiaryRepositories,
	version: number,
): void {
	;(store as { getSchemaVersion: () => Promise<number> }).getSchemaVersion =
		async () => version
}
