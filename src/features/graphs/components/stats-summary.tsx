import { StyleSheet, Text, View } from 'react-native'
import {
	roundStat,
	type MeasurementStats,
} from '@/domain/statistics/measurement-stats'
import { useI18n } from '@/i18n'
import { colors, spacing, typography } from '@/theme'

type StatsSummaryProps = {
	periodLabel: string
	stats: MeasurementStats
	morning: MeasurementStats
	evening: MeasurementStats
}

function formatBp(sys: number | null, dia: number | null): string {
	if (sys === null || dia === null) {
		return '—'
	}
	return `${roundStat(sys)} / ${roundStat(dia)}`
}

function formatPulse(pulse: number | null): string {
	if (pulse === null) {
		return '—'
	}
	return String(roundStat(pulse))
}

/** Compact descriptive summary — never a medical classification. */
export function StatsSummary({
	periodLabel,
	stats,
	morning,
	evening,
}: StatsSummaryProps) {
	const { t } = useI18n()

	if (stats.count === 0) {
		return (
			<View style={styles.block}>
				<Text style={styles.title}>{t('graphs.statsEmptyTitle')}</Text>
				<Text style={styles.body}>{t('graphs.statsEmptyBody')}</Text>
			</View>
		)
	}

	return (
		<View style={styles.block}>
			<Text style={styles.caption}>
				{t('graphs.statsAvgFor', { period: periodLabel })}
			</Text>
			<Text style={styles.hero}>
				{formatBp(stats.avgSystolic, stats.avgDiastolic)}
			</Text>
			<Text style={styles.pulse}>
				{t('diary.pulseLabel', {
					pulse: formatPulse(stats.avgPulse),
				})}
			</Text>
			<Text style={styles.range}>
				{t('graphs.statsRange', {
					min: formatBp(stats.minSystolic, stats.minDiastolic),
					max: formatBp(stats.maxSystolic, stats.maxDiastolic),
				})}
			</Text>
			<Text style={styles.meta}>
				{t('graphs.statsCount', { count: stats.count })}
			</Text>

			<View style={styles.split}>
				<View style={styles.splitCol}>
					<Text style={styles.splitTitle}>{t('graphs.stats.morning')}</Text>
					{morning.count === 0 ? (
						<Text style={styles.splitEmpty}>{t('common.noData')}</Text>
					) : (
						<>
							<Text style={styles.splitBp}>
								{formatBp(morning.avgSystolic, morning.avgDiastolic)}
							</Text>
							<Text style={styles.splitPulse}>
								{t('diary.pulseLabel', {
									pulse: formatPulse(morning.avgPulse),
								})}
							</Text>
						</>
					)}
				</View>
				<View style={styles.splitCol}>
					<Text style={styles.splitTitle}>{t('graphs.stats.evening')}</Text>
					{evening.count === 0 ? (
						<Text style={styles.splitEmpty}>{t('common.noData')}</Text>
					) : (
						<>
							<Text style={styles.splitBp}>
								{formatBp(evening.avgSystolic, evening.avgDiastolic)}
							</Text>
							<Text style={styles.splitPulse}>
								{t('diary.pulseLabel', {
									pulse: formatPulse(evening.avgPulse),
								})}
							</Text>
						</>
					)}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	block: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	title: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
	},
	body: {
		marginTop: spacing.sm,
		fontSize: typography.body,
		color: colors.textMuted,
		lineHeight: 24,
	},
	caption: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	hero: {
		fontSize: 36,
		fontWeight: '700',
		color: colors.text,
		letterSpacing: -0.5,
	},
	pulse: {
		marginTop: spacing.xs,
		fontSize: typography.section,
		color: colors.text,
	},
	range: {
		marginTop: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	meta: {
		marginTop: spacing.xs,
		fontSize: 14,
		color: colors.textMuted,
	},
	split: {
		flexDirection: 'row',
		gap: spacing.md,
		marginTop: spacing.lg,
	},
	splitCol: {
		flex: 1,
		paddingVertical: spacing.sm,
	},
	splitTitle: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	splitBp: {
		fontSize: 20,
		fontWeight: '700',
		color: colors.text,
	},
	splitPulse: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	splitEmpty: {
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
})
