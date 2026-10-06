import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	ScreenWithBottomBanner,
	scrollBottomInsetForBanner,
} from '@/ads/screen-with-bottom-banner'
import {
	getAdService,
	recordGraphsFocus,
	recordGraphsPeriodChange,
} from '@/ads'
import { analytics } from '@/analytics'
import {
	buildChartSeries,
	computeMeasurementStats,
	downsampleChartSeries,
	filterByPeriodOfDay,
	filterByStatsPeriod,
	groupByTag,
	groupHistoryByLocalDay,
	type StatsPeriodDays,
} from '@/domain/statistics/measurement-stats'
import { useAdPolicy } from '@/hooks/use-ad-policy'
import { useDiary } from '@/hooks/use-diary'
import { useI18n } from '@/i18n'
import { colors, spacing, typography } from '@/theme'
import { BpLineChart } from './components/bp-line-chart'
import {
	HistorySection,
	TagStatsSection,
} from './components/history-section'
import { PeriodSelector } from './components/period-selector'
import { StatsSummary } from './components/stats-summary'

const CHART_MAX_POINTS = 120

/**
 * Graphs + history for the active profile only.
 * Descriptive stats — no medical classification.
 * Banner pinned to the bottom of the usable area.
 */
export function GraphsScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { t } = useI18n()
	const { ready, error, profile, profileMeasurements, refreshAll } = useDiary()
	const { canShowAds, hasCompletedFirstMeasurement } = useAdPolicy()
	const [period, setPeriod] = useState<StatsPeriodDays>(7)

	useFocusEffect(
		useCallback(() => {
			void refreshAll()
			recordGraphsFocus()
			analytics.trackGraphsOpened()
		}, [refreshAll]),
	)

	function handlePeriodChange(next: StatsPeriodDays) {
		if (next === period) {
			return
		}
		setPeriod(next)
		analytics.trackGraphPeriodChanged(next)
		recordGraphsPeriodChange()
		getAdService().maybeShowGraphsInterstitial({
			hasCompletedFirstMeasurement,
		})
	}

	const scoped = useMemo(() => {
		if (!profile) {
			return []
		}
		return profileMeasurements.filter((m) => m.profileId === profile.id)
	}, [profile, profileMeasurements])

	const filtered = useMemo(
		() => filterByStatsPeriod(scoped, period, new Date()),
		[scoped, period],
	)

	const stats = useMemo(
		() => computeMeasurementStats(filtered),
		[filtered],
	)
	const morning = useMemo(
		() =>
			computeMeasurementStats(filterByPeriodOfDay(filtered, 'morning')),
		[filtered],
	)
	const evening = useMemo(
		() =>
			computeMeasurementStats(filterByPeriodOfDay(filtered, 'evening')),
		[filtered],
	)

	const chartPoints = useMemo(() => {
		const series = buildChartSeries(filtered)
		const maxPoints =
			period === 'all' || period === 90 ? CHART_MAX_POINTS : 90
		return downsampleChartSeries(series, maxPoints)
	}, [filtered, period])

	const historyGroups = useMemo(
		() => groupHistoryByLocalDay(filtered),
		[filtered],
	)

	const tagItems = useMemo(
		() =>
			groupByTag(filtered).map((g) => ({
				tag: g.tag,
				count: g.stats.count,
				avgSystolic: g.stats.avgSystolic,
				avgDiastolic: g.stats.avgDiastolic,
			})),
		[filtered],
	)

	if (!ready) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top }]}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		)
	}

	if (error) {
		return (
			<View
				style={[
					styles.centered,
					{ paddingTop: insets.top, paddingHorizontal: spacing.lg },
				]}
			>
				<Text style={styles.error}>{error}</Text>
			</View>
		)
	}

	const periodLabel =
		period === 'all'
			? t('graphs.period.all')
			: period === 7
				? t('graphs.period.7')
				: period === 30
					? t('graphs.period.30')
					: period === 90
						? t('graphs.period.90')
						: t('graphs.periodFallback')

	return (
		<View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
			<ScreenWithBottomBanner
				placement="graphsBanner"
				visible={canShowAds}
			>
				<ScrollView
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{
						paddingBottom: scrollBottomInsetForBanner({
							bannerVisible: canShowAds,
						}),
					}}
				>
					<View style={styles.headerRow}>
						<Text style={styles.title}>{t('graphs.title')}</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t('graphs.doctorReport')}
							onPress={() => router.push('/report' as Href)}
							style={({ pressed }) => [
								styles.reportLink,
								pressed && styles.reportLinkPressed,
							]}
						>
							<Text style={styles.reportLinkText}>
								{t('graphs.doctorReport')}
							</Text>
						</Pressable>
					</View>
					<PeriodSelector value={period} onChange={handlePeriodChange} />

					<StatsSummary
						periodLabel={periodLabel}
						stats={stats}
						morning={morning}
						evening={evening}
					/>

					{chartPoints.length === 0 ? (
						<View style={styles.chartEmpty}>
							<Text style={styles.chartEmptyTitle}>
								{t('graphs.chartEmptyTitle')}
							</Text>
							<Text style={styles.chartEmptyBody}>
								{t('graphs.chartEmptyBody')}
							</Text>
						</View>
					) : chartPoints.length === 1 ? (
						<>
							<Text style={styles.chartNote}>
								{t('graphs.chartOnePoint')}
							</Text>
							<BpLineChart points={chartPoints} periodDays={period} />
						</>
					) : (
						<BpLineChart points={chartPoints} periodDays={period} />
					)}

					<TagStatsSection items={tagItems} />
					<HistorySection groups={historyGroups} />
				</ScrollView>
			</ScreenWithBottomBanner>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
	},
	headerRow: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
	},
	title: {
		flexShrink: 1,
		fontSize: typography.title,
		fontWeight: '700',
		color: colors.text,
	},
	reportLink: {
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
	},
	reportLinkPressed: {
		opacity: 0.75,
	},
	reportLinkText: {
		fontSize: typography.secondary,
		fontWeight: '700',
		color: colors.primary,
	},
	error: {
		fontSize: typography.body,
		color: colors.danger,
		textAlign: 'center',
	},
	chartEmpty: {
		marginHorizontal: spacing.lg,
		marginVertical: spacing.lg,
		padding: spacing.lg,
		borderRadius: 12,
		backgroundColor: colors.surface,
	},
	chartEmptyTitle: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
	},
	chartEmptyBody: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	chartNote: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
})
