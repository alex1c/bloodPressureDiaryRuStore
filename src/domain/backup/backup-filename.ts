/** Builds a safe ASCII backup filename with local date/time. */
export function buildBackupFileName(createdAt: Date = new Date()): string {
	const y = createdAt.getFullYear()
	const mo = String(createdAt.getMonth() + 1).padStart(2, '0')
	const d = String(createdAt.getDate()).padStart(2, '0')
	const h = String(createdAt.getHours()).padStart(2, '0')
	const mi = String(createdAt.getMinutes()).padStart(2, '0')
	return `davlenie_backup_${y}-${mo}-${d}_${h}${mi}.json`
}
