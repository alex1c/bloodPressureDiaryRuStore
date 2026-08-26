import { Text, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { MEASUREMENT_TAG_LABELS_RU } from '@/domain/catalog'
import {
	formatRussianLongDate,
	localDayKeyFromIso,
} from '@/domain/dates/local-day'
import type { DayGroup } from '@/domain/statistics/measurement-stats'
import { roundStat } from '@/domain/statistics/measurement-stats'
import type { MeasurementTag } from '@/domain/types'
import { MeasurementRow } from '@/features/diary/components/measurement-list'
import { colors, spacing, typography } from '@/theme'

type HistorySectionProps = {
	groups: DayGroup[]
}

function dayHeading(dayKey: string): string {
	const today = localDayKeyFromIso(new Date().toISOString())
	if (dayKey === today) {
		return 'Сегодня'
	}
	const [y, m, d] = dayKey.split('-').map(Number)
	return formatRussianLongDate(new Date(y!, m! - 1, d!))
}

/** Date-grouped history list; taps reuse the Phase 3 edit route. */
export function HistorySection({ groups }: HistorySectionProps) {
	const router = useRouter()

	if (groups.length === 0) {
		return (
			<View style={styles.empty}>
				<Text style={styles.emptyTitle}>История пуста</Text>
				<Text style={styles.emptyBody}>
					За выбранный период измерений нет.
				</Text>
			</View>
		)
	}

	return (
		<View style={styles.wrap}>
			<Text style={styles.section}>История</Text>
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
	if (items.length === 0) {
		return null
	}

	return (
		<View style={styles.tagWrap}>
			<Text style={styles.section}>По тегам</Text>
			{items.map((item) => (
				<View key={item.tag} style={styles.tagRow}>
					<Text style={styles.tagTitle}>
						{MEASUREMENT_TAG_LABELS_RU[item.tag]}
					</Text>
					<Text style={styles.tagMeta}>
						{item.count}{' '}
						{item.count === 1 ? 'запись' : item.count < 5 ? 'записи' : 'записей'}
					</Text>
					<Text style={styles.tagBody}>
						В записях с тегом «{MEASUREMENT_TAG_LABELS_RU[item.tag]}» среднее
						значение:{' '}
						{item.avgSystolic === null || item.avgDiastolic === null
							? '—'
							: `${roundStat(item.avgSystolic)} / ${roundStat(item.avgDiastolic)}`}
					</Text>
				</View>
			))}
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
