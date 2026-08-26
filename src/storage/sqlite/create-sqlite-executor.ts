import type { SQLiteDatabase } from 'expo-sqlite'
import type { SqlExecutor, SqlParams } from '../sql-executor'

/**
 * Adapts expo-sqlite database to the shared SqlExecutor used by migrations.
 */
export function createSqliteExecutor(db: SQLiteDatabase): SqlExecutor {
	return {
		async exec(sql: string): Promise<void> {
			await db.execAsync(sql)
		},
		async run(sql: string, params: SqlParams = []): Promise<void> {
			await db.runAsync(sql, params)
		},
		async getAll<T>(sql: string, params: SqlParams = []): Promise<T[]> {
			return db.getAllAsync<T>(sql, params)
		},
		async getFirst<T>(sql: string, params: SqlParams = []): Promise<T | null> {
			const row = await db.getFirstAsync<T>(sql, params)
			return row ?? null
		},
		async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
			let result!: T
			await db.withTransactionAsync(async () => {
				result = await fn()
			})
			return result
		},
	}
}
