import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatLocalTime } from '@/domain/dates/local-day'
import type { Measurement, MeasurementTag } from '@/domain/types'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { colors, spacing, typography } from '@/theme'

const TAG_KEYS: Record<MeasurementTag, MessageKey> = {
	normal: 'tag.normal',
	headache: 'tag.headache',
	lack_of_sleep: 'tag.lack_of_sleep',
	stress: 'tag.stress',
	coffee: 'tag.coffee',
	physical_activity: 'tag.physical_activity',
}

type LatestMeasurementProps = {
	measurement: Measurement
	onPress: () => void
}

export function LatestMeasurement({
	measurement,
	onPress,
}: LatestMeasurementProps) {
	const { t } = useI18n()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t('diary.latestA11y')}
			onPress={onPress}
			style={styles.latest}
		>
			<Text style={styles.caption}>{t('diary.latestCaption')}</Text>
			<Text style={styles.bp}>
				{measurement.systolic} / {measurement.diastolic}
			</Text>
			<Text style={styles.pulse}>
				{t('diary.pulseLabel', { pulse: measurement.pulse })}
			</Text>
			<Text style={styles.time}>{formatLocalTime(measurement.measuredAt)}</Text>
		</Pressable>
	)
}

type MeasurementRowProps = {
	measurement: Measurement
	onPress: () => void
}

export function MeasurementRow({ measurement, onPress }: MeasurementRowProps) {
	const { t } = useI18n()
	const time = formatLocalTime(measurement.measuredAt)
	const tagLabel =
		measurement.tags.length > 0
			? measurement.tags.map((tag) => t(TAG_KEYS[tag])).join(' · ')
			: null

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t('diary.rowA11y', { time })}
			onPress={onPress}
			style={styles.row}
		>
			<Text style={styles.rowTime}>{time}</Text>
			<View style={styles.rowBody}>
				<Text style={styles.rowBp}>
					{measurement.systolic} / {measurement.diastolic}
				</Text>
				<Text style={styles.rowPulse}>
					{t('diary.pulseLabel', { pulse: measurement.pulse })}
				</Text>
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
		marginTop: spacing.xs,
		fontSize: typography.body,
		color: colors.textMuted,
	},
	time: {
		marginTop: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	row: {
		flexDirection: 'row',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		gap: spacing.md,
	},
	rowTime: {
		width: 52,
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.textMuted,
	},
	rowBody: {
		flex: 1,
	},
	rowBp: {
		fontSize: typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	rowPulse: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	rowTags: {
		marginTop: 4,
		fontSize: typography.secondary,
		color: colors.primary,
	},
})
