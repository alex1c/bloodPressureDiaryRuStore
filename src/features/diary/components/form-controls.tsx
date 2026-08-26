import {
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputProps,
	View,
} from 'react-native'
import type { RefObject } from 'react'
import { colors, spacing, touchTargetMin, typography } from '@/theme'
import { filterIntegerInputText } from '@/domain/input/normalize'

type IntegerFieldProps = {
	label: string
	value: string
	onChangeText: (text: string) => void
	inputRef?: RefObject<TextInput | null>
	onSubmitEditing?: TextInputProps['onSubmitEditing']
	returnKeyType?: TextInputProps['returnKeyType']
	autoFocus?: boolean
	accessibilityLabel?: string
}

/**
 * Integer BP/pulse field — keeps string draft state; digits-only filter.
 * Uses number-pad (not decimal-pad) so Android integer entry stays clean.
 */
export function IntegerField({
	label,
	value,
	onChangeText,
	inputRef,
	onSubmitEditing,
	returnKeyType = 'next',
	autoFocus,
	accessibilityLabel,
}: IntegerFieldProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				ref={inputRef}
				value={value}
				onChangeText={(text) => onChangeText(filterIntegerInputText(text))}
				keyboardType="number-pad"
				inputMode="numeric"
				returnKeyType={returnKeyType}
				onSubmitEditing={onSubmitEditing}
				autoFocus={autoFocus}
				selectTextOnFocus
				style={styles.input}
				placeholderTextColor={colors.textMuted}
				accessibilityLabel={accessibilityLabel ?? label}
			/>
		</View>
	)
}

type PrimaryButtonProps = {
	label: string
	onPress: () => void
	disabled?: boolean
	danger?: boolean
}

export function PrimaryButton({
	label,
	onPress,
	disabled,
	danger,
}: PrimaryButtonProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				danger && styles.buttonDanger,
				pressed && !disabled && styles.buttonPressed,
				disabled && styles.buttonDisabled,
			]}
		>
			<Text style={[styles.buttonLabel, danger && styles.buttonLabelDanger]}>
				{label}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	wrap: {
		marginBottom: spacing.md,
	},
	label: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	input: {
		minHeight: touchTargetMin + 8,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: 28,
		fontWeight: '600',
		color: colors.text,
		backgroundColor: colors.surface,
	},
	button: {
		minHeight: touchTargetMin + 8,
		borderRadius: 14,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	buttonPressed: {
		backgroundColor: colors.primaryPressed,
	},
	buttonDanger: {
		backgroundColor: colors.dangerSoft,
		borderWidth: 1,
		borderColor: colors.danger,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonLabel: {
		fontSize: typography.body,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	buttonLabelDanger: {
		color: colors.danger,
	},
})
