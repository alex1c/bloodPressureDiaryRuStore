import type {
	AppSettings,
	CreateMeasurementInput,
	HealthMetric,
	HealthMetricKind,
	Measurement,
	Medication,
	MedicationIntake,
	Profile,
	ProfileMetricSettings,
	Reminder,
	UpdateMeasurementInput,
} from '@/domain/types'
import type { DiaryBackup } from '@/domain/backup/validate-backup'

export interface ProfileRepository {
	list(): Promise<Profile[]>
	getById(id: string): Promise<Profile | null>
	create(input: { name: string; isDefault?: boolean }): Promise<Profile>
	update(
		id: string,
		patch: { name?: string; isDefault?: boolean },
	): Promise<Profile>
	delete(id: string): Promise<void>
}

export interface MeasurementRepository {
	listByProfile(profileId: string): Promise<Measurement[]>
	listByProfileOnDay(
		profileId: string,
		dayIsoDate: string,
	): Promise<Measurement[]>
	/** Inclusive ISO range filter on measuredAt (preferred for local-day queries). */
	listByProfileInRange(
		profileId: string,
		fromIso: string,
		toIso: string,
	): Promise<Measurement[]>
	getById(id: string): Promise<Measurement | null>
	create(input: CreateMeasurementInput): Promise<Measurement>
	update(id: string, patch: UpdateMeasurementInput): Promise<Measurement>
	delete(id: string): Promise<void>
}

export interface HealthMetricRepository {
	listByProfile(profileId: string): Promise<HealthMetric[]>
	listByProfileAndKind(
		profileId: string,
		kind: HealthMetricKind,
	): Promise<HealthMetric[]>
	getById(id: string): Promise<HealthMetric | null>
	create(
		input: Omit<HealthMetric, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<HealthMetric>
	update(
		id: string,
		patch: Partial<
			Pick<HealthMetric, 'value' | 'unit' | 'measuredAt' | 'note' | 'kind'>
		>,
	): Promise<HealthMetric>
	delete(id: string): Promise<void>
}

export interface ProfileMetricSettingsRepository {
	get(profileId: string): Promise<ProfileMetricSettings>
	setEnabledKinds(
		profileId: string,
		enabledKinds: HealthMetricKind[],
	): Promise<ProfileMetricSettings>
}

export interface MedicationRepository {
	listByProfile(profileId: string): Promise<Medication[]>
	create(
		input: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<Medication>
	update(
		id: string,
		patch: Partial<Omit<Medication, 'id' | 'profileId' | 'createdAt'>>,
	): Promise<Medication>
	delete(id: string): Promise<void>
}

export interface MedicationIntakeRepository {
	listByProfile(profileId: string): Promise<MedicationIntake[]>
	listByMedication(medicationId: string): Promise<MedicationIntake[]>
	create(
		input: Omit<MedicationIntake, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<MedicationIntake>
	delete(id: string): Promise<void>
}

export interface ReminderRepository {
	listByProfile(profileId: string): Promise<Reminder[]>
	create(
		input: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<Reminder>
	update(
		id: string,
		patch: Partial<Omit<Reminder, 'id' | 'profileId' | 'createdAt'>>,
	): Promise<Reminder>
	delete(id: string): Promise<void>
}

export interface SettingsRepository {
	get(): Promise<AppSettings>
	update(patch: Partial<AppSettings>): Promise<AppSettings>
}

export interface DiaryRepositories {
	profiles: ProfileRepository
	measurements: MeasurementRepository
	healthMetrics: HealthMetricRepository
	profileMetricSettings: ProfileMetricSettingsRepository
	medications: MedicationRepository
	medicationIntakes: MedicationIntakeRepository
	reminders: ReminderRepository
	settings: SettingsRepository
	/** Current schema version for this store. */
	getSchemaVersion(): Promise<number>
	withTransaction<T>(fn: () => Promise<T>): Promise<T>
	/**
	 * Atomically replaces all user data with a validated backup snapshot.
	 * Must run inside a transaction with rollback on failure.
	 */
	importBackupDataset(backup: DiaryBackup): Promise<void>
}
