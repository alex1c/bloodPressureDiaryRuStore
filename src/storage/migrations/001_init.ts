import type { Migration, SqlExecutor } from '../sql-executor'

/**
 * Initial schema: meta + profiles + measurements + health metrics +
 * medications + intakes + reminders + settings.
 */
export const migration001Init: Migration = {
	version: 1,
	name: '001_init',
	async up(db: SqlExecutor): Promise<void> {
		await db.exec(`
			CREATE TABLE IF NOT EXISTS meta (
				key TEXT PRIMARY KEY NOT NULL,
				value TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS profiles (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				is_default INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS measurements (
				id TEXT PRIMARY KEY NOT NULL,
				profile_id TEXT NOT NULL,
				systolic INTEGER NOT NULL,
				diastolic INTEGER NOT NULL,
				pulse INTEGER NOT NULL,
				measured_at TEXT NOT NULL,
				period_of_day TEXT NOT NULL,
				wellbeing TEXT,
				tags_json TEXT NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id)
			);

			CREATE INDEX IF NOT EXISTS idx_measurements_profile_measured
				ON measurements(profile_id, measured_at);

			CREATE TABLE IF NOT EXISTS health_metrics (
				id TEXT PRIMARY KEY NOT NULL,
				profile_id TEXT NOT NULL,
				kind TEXT NOT NULL,
				value REAL NOT NULL,
				unit TEXT,
				measured_at TEXT NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id)
			);

			CREATE INDEX IF NOT EXISTS idx_health_metrics_profile_kind_measured
				ON health_metrics(profile_id, kind, measured_at);

			CREATE TABLE IF NOT EXISTS medications (
				id TEXT PRIMARY KEY NOT NULL,
				profile_id TEXT NOT NULL,
				name TEXT NOT NULL,
				dosage_text TEXT NOT NULL,
				schedule_json TEXT NOT NULL,
				is_active INTEGER NOT NULL DEFAULT 1,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id)
			);

			CREATE TABLE IF NOT EXISTS medication_intakes (
				id TEXT PRIMARY KEY NOT NULL,
				profile_id TEXT NOT NULL,
				medication_id TEXT NOT NULL,
				taken_at TEXT NOT NULL,
				taken INTEGER NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id),
				FOREIGN KEY (medication_id) REFERENCES medications(id)
			);

			CREATE TABLE IF NOT EXISTS reminders (
				id TEXT PRIMARY KEY NOT NULL,
				profile_id TEXT NOT NULL,
				medication_id TEXT,
				title TEXT NOT NULL,
				body TEXT,
				hour INTEGER NOT NULL,
				minute INTEGER NOT NULL,
				weekdays_json TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1,
				platform_notification_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id)
			);

			CREATE TABLE IF NOT EXISTS settings (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				active_profile_id TEXT,
				locale TEXT NOT NULL,
				has_completed_first_measurement INTEGER NOT NULL DEFAULT 0
			);
		`)
	},
}
