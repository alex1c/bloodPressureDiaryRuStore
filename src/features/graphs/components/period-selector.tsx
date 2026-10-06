import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StatsPeriodDays } from '@/domain/statistics/measurement-stats'
import { useI18n } from '@/i18n'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

type PeriodSelectorProps = {
	value: StatsPeriodDays
	onChange: (value: StatsPeriodDays) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
	const { t } = useI18n()
	const options: { value: StatsPeriodDays; label: string }[] = [
		{ value: 7, label: t('graphs.period.7') },
		{ value: 30, label: t('graphs.period.30') },
		{ value: 90, label: t('graphs.period.90') },
		{ value: 'all', label: t('graphs.period.allShort') },
	]

	return (
		<View style={styles.row} accessibilityRole="tablist">
			{options.map((option) => {
				const selected = option.value === value
				return (
					<Pressable
						key={String(option.value)}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						accessibilityLabel={option.label}
						onPress={() => onChange(option.value)}
						style={[styles.chip, selected && styles.chipOn]}
					>
						<Text style={[styles.label, selected && styles.labelOn]}>
							{option.label}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	chip: {
		minHeight: touchTargetMin - 4,
		paddingHorizontal: spacing.md,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.chip,
		alignItems: 'center',
		justifyContent: 'center',
	},
	chipOn: {
		backgroundColor: colors.chipSelected,
		borderColor: colors.primary,
	},
	label: {
		fontSize: typography.secondary,
		color: colors.text,
	},
	labelOn: {
		fontWeight: '700',
		color: colors.primary,
	},
})
