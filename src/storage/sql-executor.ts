/**
 * Low-level SQL executor shared by migrations and SQLite repositories.
 */
export interface SqlExecutor {
	exec(sql: string): Promise<void>
	run(sql: string, params?: SqlParams): Promise<void>
	getAll<T>(sql: string, params?: SqlParams): Promise<T[]>
	getFirst<T>(sql: string, params?: SqlParams): Promise<T | null>
	withTransaction<T>(fn: () => Promise<T>): Promise<T>
}

export type SqlParams = (string | number | null)[]

export interface Migration {
	/** Target schema version after this migration applies (1-based, contiguous). */
	version: number
	name: string
	up: (db: SqlExecutor) => Promise<void>
}
