import { Text, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { getMeasurementTagLabel } from '@/domain/catalog'
import { localDayKeyFromIso } from '@/domain/dates/local-day'
import type { DayGroup } from '@/domain/statistics/measurement-stats'
import { roundStat } from '@/domain/statistics/measurement-stats'
import type { MeasurementTag } from '@/domain/types'
import { MeasurementRow } from '@/features/diary/components/measurement-list'
import { formatLongDate, useI18n } from '@/i18n'
import { colors, spacing, typography } from '@/theme'

type HistorySectionProps = {
	groups: DayGroup[]
}

/** Date-grouped history list; taps reuse the Phase 3 edit route. */
export function HistorySection({ groups }: HistorySectionProps) {
	const router = useRouter()
	const { t, locale } = useI18n()

	function dayHeading(dayKey: string): string {
		const today = localDayKeyFromIso(new Date().toISOString())
		if (dayKey === today) {
			return t('common.today')
		}
		const [y, m, d] = dayKey.split('-').map(Number)
		return formatLongDate(new Date(y!, m! - 1, d!), locale)
	}

	if (groups.length === 0) {
		return (
			<View style={styles.empty}>
				<Text style={styles.emptyTitle}>{t('graphs.historyEmptyTitle')}</Text>
				<Text style={styles.emptyBody}>{t('graphs.historyEmptyBody')}</Text>
			</View>
		)
	}

	return (
		<View style={styles.wrap}>
			<Text style={styles.section}>{t('graphs.history')}</Text>
			{groups.map((group) => (
				<View key={group.day}>
					<Text style={styles.day}>{dayHeading(group.day)}</Text>
					{group.measurements.map((item) => (
						<MeasurementRow
							key={item.id}
							measurement={item}
							onPress={() => router.push(`/measurement/${item.id}`)}
						/>
					))}
				</View>
			))}
		</View>
	)
}

type TagStatsSectionProps = {
	items: {
		tag: MeasurementTag
		count: number
		avgSystolic: number | null
		avgDiastolic: number | null
	}[]
}

export function TagStatsSection({ items }: TagStatsSectionProps) {
	const { t } = useI18n()

	if (items.length === 0) {
		return null
	}

	return (
		<View style={styles.tagWrap}>
			<Text style={styles.section}>{t('graphs.tags')}</Text>
			{items.map((item) => {
				const label = getMeasurementTagLabel(item.tag, t)
				const bp =
					item.avgSystolic === null || item.avgDiastolic === null
						? '—'
						: `${roundStat(item.avgSystolic)} / ${roundStat(item.avgDiastolic)}`
				const recordsKey =
					item.count === 1
						? 'report.pdf.records.one'
						: item.count < 5
							? 'report.pdf.records.few'
							: 'report.pdf.records.many'
				return (
					<View key={item.tag} style={styles.tagRow}>
						<Text style={styles.tagTitle}>{label}</Text>
						<Text style={styles.tagMeta}>
							{item.count} {t(recordsKey)}
						</Text>
						<Text style={styles.tagBody}>
							{t('graphs.tagAvg', { label, bp })}
						</Text>
					</View>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		marginTop: spacing.md,
		paddingBottom: spacing.xl,
	},
	section: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
	},
	day: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.md,
		marginBottom: spacing.xs,
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.textMuted,
	},
	empty: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.lg,
	},
	emptyTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
	},
	emptyBody: {
		marginTop: spacing.sm,
		fontSize: typography.body,
		color: colors.textMuted,
	},
	tagWrap: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.lg,
		marginBottom: spacing.md,
	},
	tagRow: {
		marginBottom: spacing.md,
		paddingBottom: spacing.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	tagTitle: {
		fontSize: typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	tagMeta: {
		marginTop: 2,
		fontSize: 14,
		color: colors.textMuted,
	},
	tagBody: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
		lineHeight: 22,
	},
})
