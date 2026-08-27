import type { Migration } from '../sql-executor'

/**
 * Links each intake to the planned local clock slot (hour/minute).
 * Existing Phase 4 DBs upgrade without touching measurements/profiles.
 */
export const migration002IntakeScheduleSlot: Migration = {
	version: 2,
	name: '002_intake_schedule_slot',
	async up(db) {
		await db.exec(`
			ALTER TABLE medication_intakes
				ADD COLUMN scheduled_hour INTEGER NOT NULL DEFAULT 0;
		`)
		await db.exec(`
			ALTER TABLE medication_intakes
				ADD COLUMN scheduled_minute INTEGER NOT NULL DEFAULT 0;
		`)
	},
}
