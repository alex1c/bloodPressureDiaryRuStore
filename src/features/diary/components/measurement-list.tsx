import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MEASUREMENT_TAG_LABELS_RU } from '@/domain/catalog'
import { formatLocalTime } from '@/domain/dates/local-day'
import type { Measurement } from '@/domain/types'
import { colors, spacing, typography } from '@/theme'

type LatestMeasurementProps = {
	measurement: Measurement
	onPress: () => void
}

export function LatestMeasurement({
	measurement,
	onPress,
}: LatestMeasurementProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Открыть последнее измерение"
			onPress={onPress}
			style={styles.latest}
		>
			<Text style={styles.caption}>Последнее измерение</Text>
			<Text style={styles.bp}>
				{measurement.systolic} / {measurement.diastolic}
			</Text>
			<Text style={styles.pulse}>Пульс {measurement.pulse}</Text>
			<Text style={styles.time}>{formatLocalTime(measurement.measuredAt)}</Text>
		</Pressable>
	)
}

type MeasurementRowProps = {
	measurement: Measurement
	onPress: () => void
}

export function MeasurementRow({ measurement, onPress }: MeasurementRowProps) {
	const tagLabel =
		measurement.tags.length > 0
			? measurement.tags.map((t) => MEASUREMENT_TAG_LABELS_RU[t]).join(' · ')
			: null

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Измерение ${formatLocalTime(measurement.measuredAt)}`}
			onPress={onPress}
			style={styles.row}
		>
			<Text style={styles.rowTime}>{formatLocalTime(measurement.measuredAt)}</Text>
			<View style={styles.rowBody}>
				<Text style={styles.rowBp}>
					{measurement.systolic} / {measurement.diastolic}
				</Text>
				<Text style={styles.rowPulse}>Пульс {measurement.pulse}</Text>
				{tagLabel ? <Text style={styles.rowTags}>{tagLabel}</Text> : null}
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	latest: {
		paddingVertical: spacing.lg,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	caption: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.sm,
	},
	bp: {
		fontSize: typography.bpHero,
		fontWeight: '700',
		color: colors.text,
		letterSpacing: -0.5,
	},
	pulse: {
		marginTop: spacing.sm,
		fontSize: typography.section,
		color: colors.text,
	},
	time: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	row: {
		flexDirection: 'row',
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		gap: spacing.md,
		alignItems: 'flex-start',
	},
	rowTime: {
		width: 56,
		fontSize: typography.body,
		color: colors.textMuted,
		paddingTop: 2,
	},
	rowBody: {
		flex: 1,
	},
	rowBp: {
		fontSize: typography.bpRow,
		fontWeight: '700',
		color: colors.text,
	},
	rowPulse: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	rowTags: {
		marginTop: spacing.xs,
		fontSize: 14,
		color: colors.textMuted,
	},
})
