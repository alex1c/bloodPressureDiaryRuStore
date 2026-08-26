/**
 * Creates a unique entity id.
 * Uses crypto.randomUUID when available; otherwise a timestamp+random fallback.
 */
export function createEntityId(): string {
	const cryptoApi = globalThis.crypto
	if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
		return cryptoApi.randomUUID()
	}
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Current time as ISO-8601 string. */
export function nowIso(): string {
	return new Date().toISOString()
}
