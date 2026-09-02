import { useEffect, useState } from 'react'
import { getAdService } from '@/ads'

/**
 * Reads persisted first-measurement gate for banner eligibility.
 * Keeps ad policy out of individual screen components.
 */
export function useAdPolicy() {
	const [hasCompletedFirstMeasurement, setHasCompletedFirstMeasurement] =
		useState(false)

	useEffect(() => {
		let cancelled = false

		void (async () => {
			try {
				const { openDiaryDatabase } = await import(
					'@/storage/sqlite/open-diary-database'
				)
				const repos = await openDiaryDatabase()
				const settings = await repos.settings.get()
				if (!cancelled) {
					setHasCompletedFirstMeasurement(
						settings.hasCompletedFirstMeasurement,
					)
				}
			} catch {
				if (!cancelled) {
					setHasCompletedFirstMeasurement(false)
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [])

	const canShowAds = getAdService().canShowAds({
		hasCompletedFirstMeasurement,
	})

	return {
		hasCompletedFirstMeasurement,
		canShowAds,
	}
}
