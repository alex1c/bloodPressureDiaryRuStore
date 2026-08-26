import { MIGRATIONS } from './migrations'
import {
	CURRENT_SCHEMA_VERSION,
	META_SCHEMA_VERSION_KEY,
} from './schema-version'
import type { SqlExecutor } from './sql-executor'

/**
 * Reads schemaVersion from meta (0 when missing) and applies pending migrations
 * inside a single transaction.
 */
export async function applyMigrations(db: SqlExecutor): Promise<number> {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY NOT NULL,
			value TEXT NOT NULL
		);
	`)

	const row = await db.getFirst<{ value: string }>(
		'SELECT value FROM meta WHERE key = ?',
		[META_SCHEMA_VERSION_KEY],
	)
	let current = row ? Number(row.value) : 0
	if (!Number.isFinite(current) || current < 0) {
		current = 0
	}

	const pending = MIGRATIONS.filter((m) => m.version > current)
	if (pending.length === 0) {
		return current
	}

	await db.withTransaction(async () => {
		for (const migration of pending) {
			if (migration.version !== current + 1) {
				throw new Error(
					`Migration gap: have schema ${current}, next is ${migration.version}`,
				)
			}
			await migration.up(db)
			current = migration.version
			await db.run(
				`INSERT INTO meta (key, value) VALUES (?, ?)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
				[META_SCHEMA_VERSION_KEY, String(current)],
			)
		}
	})

	if (current !== CURRENT_SCHEMA_VERSION) {
		throw new Error(
			`Schema ended at ${current}, expected ${CURRENT_SCHEMA_VERSION}`,
		)
	}

	return current
}

export function listMigrationVersions(): number[] {
	return MIGRATIONS.map((m) => m.version)
}
