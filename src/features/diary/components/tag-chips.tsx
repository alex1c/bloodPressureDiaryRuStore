import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
	MEASUREMENT_TAG_LABELS_RU,
	MEASUREMENT_TAGS,
} from '@/domain/catalog'
import type { MeasurementTag } from '@/domain/types'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

type TagChipsProps = {
	selected: MeasurementTag[]
	onToggle: (tag: MeasurementTag) => void
}

/** Secondary quick tags — optional, multi-select. */
export function TagChips({ selected, onToggle }: TagChipsProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.caption}>Контекст (необязательно)</Text>
			<View style={styles.row}>
				{MEASUREMENT_TAGS.map((tag) => {
					const isOn = selected.includes(tag)
					return (
						<Pressable
							key={tag}
							accessibilityRole="button"
							accessibilityState={{ selected: isOn }}
							accessibilityLabel={MEASUREMENT_TAG_LABELS_RU[tag]}
							onPress={() => onToggle(tag)}
							style={[styles.chip, isOn && styles.chipOn]}
						>
							<Text style={[styles.chipText, isOn && styles.chipTextOn]}>
								{MEASUREMENT_TAG_LABELS_RU[tag]}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		marginTop: spacing.sm,
		marginBottom: spacing.md,
	},
	caption: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.sm,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	chip: {
		minHeight: touchTargetMin - 4,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: 999,
		backgroundColor: colors.chip,
		borderWidth: 1,
		borderColor: colors.border,
		justifyContent: 'center',
	},
	chipOn: {
		backgroundColor: colors.chipSelected,
		borderColor: colors.primary,
	},
	chipText: {
		fontSize: typography.secondary,
		color: colors.text,
	},
	chipTextOn: {
		fontWeight: '600',
		color: colors.primary,
	},
})
