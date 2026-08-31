import type { Migration } from '../sql-executor'

/**
 * Per-profile enabled health metric kinds (weight / glucose / spo2 / temperature).
 * Existing Phase 5 profiles get weight enabled by default; other kinds stay off.
 */
export const migration003ProfileMetricSettings: Migration = {
	version: 3,
	name: '003_profile_metric_settings',
	async up(db) {
		await db.exec(`
			CREATE TABLE IF NOT EXISTS profile_metric_settings (
				profile_id TEXT PRIMARY KEY NOT NULL,
				enabled_kinds_json TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (profile_id) REFERENCES profiles(id)
			);
		`)

		const profiles = await db.getAll<{ id: string }>(
			'SELECT id FROM profiles',
		)
		const timestamp = new Date().toISOString()
		const defaultKinds = JSON.stringify(['weight'])
		for (const profile of profiles) {
			await db.run(
				`INSERT OR IGNORE INTO profile_metric_settings
					(profile_id, enabled_kinds_json, updated_at)
				 VALUES (?, ?, ?)`,
				[profile.id, defaultKinds, timestamp],
			)
		}
	},
}
