import { openDatabaseAsync } from 'expo-sqlite'
import { createSqliteExecutor } from './create-sqlite-executor'
import {
	bootstrapSqliteSchema,
	createSqliteDiaryRepositories,
} from './create-sqlite-diary-repositories'
import type { DiaryRepositories } from '../repositories/types'

const DB_NAME = 'bp_diary.db'

let cached: DiaryRepositories | null = null

/**
 * Opens the on-device SQLite database, applies migrations, returns repositories.
 * Safe to call multiple times — returns the cached handle after first open.
 */
export async function openDiaryDatabase(): Promise<DiaryRepositories> {
	if (cached) {
		return cached
	}

	const sqlite = await openDatabaseAsync(DB_NAME)
	const executor = createSqliteExecutor(sqlite)
	await bootstrapSqliteSchema(executor)
	cached = createSqliteDiaryRepositories(executor)
	return cached
}

/** Test / hot-reload helper. */
export function resetDiaryDatabaseCacheForTests(): void {
	cached = null
}
