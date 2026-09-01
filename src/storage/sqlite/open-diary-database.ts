import { openDatabaseAsync } from 'expo-sqlite'
import { createSqliteExecutor } from './create-sqlite-executor'
import {
	bootstrapSqliteSchema,
	createSqliteDiaryRepositories,
} from './create-sqlite-diary-repositories'
import type { DiaryRepositories } from '../repositories/types'

const DB_NAME = 'bp_diary.db'

let cached: DiaryRepositories | null = null
let opening: Promise<DiaryRepositories> | null = null

/**
 * Opens the on-device SQLite database, applies migrations, returns repositories.
 * Safe to call multiple times — returns the cached handle after first open.
 */
export async function openDiaryDatabase(): Promise<DiaryRepositories> {
	if (cached) {
		return cached
	}

	if (!opening) {
		opening = (async () => {
			const sqlite = await openDatabaseAsync(DB_NAME)
			const executor = createSqliteExecutor(sqlite)
			await bootstrapSqliteSchema(executor)
			const repositories = createSqliteDiaryRepositories(executor)
			cached = repositories
			return repositories
		})().finally(() => {
			opening = null
		})
	}
	return opening
}

/** Test / hot-reload helper. */
export function resetDiaryDatabaseCacheForTests(): void {
	cached = null
	opening = null
}
