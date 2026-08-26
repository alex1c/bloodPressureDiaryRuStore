import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StatsPeriodDays } from '@/domain/statistics/measurement-stats'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

const OPTIONS: { value: StatsPeriodDays; label: string }[] = [
	{ value: 7, label: '7 дней' },
	{ value: 30, label: '30 дней' },
	{ value: 90, label: '90 дней' },
	{ value: 'all', label: 'Все' },
]

type PeriodSelectorProps = {
	value: StatsPeriodDays
	onChange: (value: StatsPeriodDays) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
	return (
		<View style={styles.row} accessibilityRole="tablist">
			{OPTIONS.map((option) => {
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
