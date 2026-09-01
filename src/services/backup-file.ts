import * as Sharing from 'expo-sharing'
import {
	cacheDirectory,
	copyAsync,
	deleteAsync,
	getInfoAsync,
	makeDirectoryAsync,
	readAsStringAsync,
	writeAsStringAsync,
} from 'expo-file-system/legacy'
import { buildDiaryBackup } from '@/domain/backup/build-backup'
import { buildBackupFileName } from '@/domain/backup/backup-filename'
import type { DiaryRepositories } from '@/storage/repositories/types'

export type ExportedBackupFile = {
	uri: string
	fileName: string
}

/**
 * Builds a validated JSON backup, writes it to cache/backups/, and returns the uri.
 */
export async function exportDiaryBackupFile(
	repos: DiaryRepositories,
): Promise<ExportedBackupFile> {
	const backup = await buildDiaryBackup(repos)
	const fileName = buildBackupFileName(new Date(backup.createdAt))
	const json = JSON.stringify(backup, null, 2)

	const base = cacheDirectory
	if (!base) {
		throw new Error('Cache directory unavailable')
	}

	await ensureBackupsDir(base)
	const target = `${base}backups/${fileName}`
	const existing = await getInfoAsync(target)
	if (existing.exists) {
		await deleteAsync(target, { idempotent: true })
	}
	await writeAsStringAsync(target, json, { encoding: 'utf8' })
	return { uri: target, fileName }
}

/** Opens Android Share Sheet for a backup JSON file. */
export async function shareBackupFile(file: ExportedBackupFile): Promise<void> {
	const available = await Sharing.isAvailableAsync()
	if (!available) {
		throw new Error('Sharing is not available on this device')
	}
	await Sharing.shareAsync(file.uri, {
		mimeType: 'application/json',
		dialogTitle: 'Поделиться резервной копией',
		UTI: 'public.json',
	})
}

/** Reads UTF-8 JSON from a document-picker or cache uri. */
export async function readBackupJsonFromUri(uri: string): Promise<unknown> {
	const text = await readAsStringAsync(uri, { encoding: 'utf8' })
	return JSON.parse(text) as unknown
}

/** Copies a picked backup into app cache for re-import (optional convenience). */
export async function copyPickedBackupToCache(
	sourceUri: string,
	fileName: string,
): Promise<string> {
	const base = cacheDirectory
	if (!base) {
		return sourceUri
	}
	await ensureBackupsDir(base)
	const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
	const target = `${base}backups/import_${safeName}`
	const existing = await getInfoAsync(target)
	if (existing.exists) {
		await deleteAsync(target, { idempotent: true })
	}
	await copyAsync({ from: sourceUri, to: target })
	return target
}

async function ensureBackupsDir(base: string): Promise<void> {
	const dir = `${base}backups`
	const info = await getInfoAsync(dir)
	if (!info.exists) {
		await makeDirectoryAsync(dir, { intermediates: true })
	}
}
