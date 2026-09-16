import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { getAdService } from '@/ads'

/**
 * Reads persisted first-measurement gate for banner eligibility.
 * Refreshes on screen focus so banners appear after the first save
 * without requiring an app restart.
 */
export function useAdPolicy() {
	const [hasCompletedFirstMeasurement, setHasCompletedFirstMeasurement] =
		useState(false)

	useFocusEffect(
		useCallback(() => {
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
		}, []),
	)

	const canShowAds = getAdService().canShowAds({
		hasCompletedFirstMeasurement,
	})

	return {
		hasCompletedFirstMeasurement,
		canShowAds,
	}
}
