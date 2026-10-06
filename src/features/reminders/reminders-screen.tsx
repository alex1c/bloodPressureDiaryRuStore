import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from 'react-native'
import { Stack, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DAILY_WEEKDAYS, parseScheduleHm } from '@/domain/medications/schedule'
import type { Reminder } from '@/domain/types'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { useMedications } from '@/hooks/use-medications'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/dictionaries'
import {
	deleteMeasurementReminder,
	filterMeasurementReminders,
	formatReminderHm,
	setMeasurementReminderEnabled,
	upsertMeasurementReminder,
} from '@/services/measurement-reminders'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/** Display order Mon→Sun for weekday chips. */
const WEEKDAY_UI_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const WEEKDAY_KEYS: Record<number, MessageKey> = {
	0: 'weekday.0',
	1: 'weekday.1',
	2: 'weekday.2',
	3: 'weekday.3',
	4: 'weekday.4',
	5: 'weekday.5',
	6: 'weekday.6',
}

type EditorState = {
	id: string | null
	timeHm: string
	weekdays: number[]
	enabled: boolean
}

/**
 * Reminder settings: blood-pressure slots + per-medication toggles.
 * Matches settings-screen styling; permission is requested only on enable.
 */
export function RemindersScreen() {
	const insets = useSafeAreaInsets()
	const { t } = useI18n()
	const { ready, error, repos, profile } = useDiary()
	const {
		medications,
		reminders,
		refreshMedications,
		saveMedication,
		permission,
	} = useMedications()

	const [busy, setBusy] = useState(false)
	const [editor, setEditor] = useState<EditorState | null>(null)
	const [localError, setLocalError] = useState<string | null>(null)

	useFocusEffect(
		useCallback(() => {
			void refreshMedications()
		}, [refreshMedications]),
	)

	const measurementReminders = useMemo(
		() =>
			filterMeasurementReminders(reminders).sort(
				(a, b) =>
					a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
			),
		[reminders],
	)

	const activeMeds = useMemo(
		() => medications.filter((m) => m.isActive),
		[medications],
	)

	function formatWeekdays(weekdays: number[]): string {
		if (
			[0, 1, 2, 3, 4, 5, 6].every((d) => weekdays.includes(d))
		) {
			return t('reminders.everyDay')
		}
		return WEEKDAY_UI_ORDER.filter((d) => weekdays.includes(d))
			.map((d) => t(WEEKDAY_KEYS[d]!))
			.join(', ')
	}

	function openCreateEditor(defaults?: { hour: number; minute: number }) {
		const hour = defaults?.hour ?? 8
		const minute = defaults?.minute ?? 0
		setLocalError(null)
		setEditor({
			id: null,
			timeHm: formatReminderHm({
				hour,
				minute,
			}),
			weekdays: [...DAILY_WEEKDAYS],
			enabled: true,
		})
	}

	function openEditEditor(reminder: Reminder) {
		setLocalError(null)
		setEditor({
			id: reminder.id,
			timeHm: formatReminderHm(reminder),
			weekdays: [...reminder.weekdays],
			enabled: reminder.enabled,
		})
	}

	async function handleSaveEditor() {
		if (!repos || !profile || !editor) {
			return
		}
		const parsed = parseScheduleHm(editor.timeHm)
		if (!parsed) {
			setLocalError(t('common.timeFormatError'))
			return
		}
		if (editor.weekdays.length === 0) {
			setLocalError(t('reminders.weekdaysRequired'))
			return
		}

		setBusy(true)
		setLocalError(null)
		try {
			await upsertMeasurementReminder({
				repos,
				profileId: profile.id,
				id: editor.id ?? undefined,
				hour: parsed.hour,
				minute: parsed.minute,
				weekdays: [...editor.weekdays].sort((a, b) => a - b),
				enabled: editor.enabled,
			})
			setEditor(null)
			await refreshMedications()
		} catch (err) {
			setLocalError(
				err instanceof Error
					? err.message
					: t('reminders.saveFailed'),
			)
		} finally {
			setBusy(false)
		}
	}

	async function handleToggleMeasurement(
		reminder: Reminder,
		enabled: boolean,
	) {
		if (!repos || !profile) {
			return
		}
		setBusy(true)
		try {
			await setMeasurementReminderEnabled({
				repos,
				profileId: profile.id,
				id: reminder.id,
				enabled,
			})
			await refreshMedications()
		} finally {
			setBusy(false)
		}
	}

	function handleDeleteMeasurement(reminder: Reminder) {
		Alert.alert(t('reminders.deleteConfirmTitle'), undefined, [
			{ text: t('common.cancel'), style: 'cancel' },
			{
				text: t('common.delete'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						if (!repos || !profile) {
							return
						}
						setBusy(true)
						try {
							await deleteMeasurementReminder({
								repos,
								profileId: profile.id,
								id: reminder.id,
							})
							if (editor?.id === reminder.id) {
								setEditor(null)
							}
							await refreshMedications()
						} finally {
							setBusy(false)
						}
					})()
				},
			},
		])
	}

	async function handleAddMorningEvening() {
		if (!repos || !profile) {
			return
		}
		setBusy(true)
		try {
			const existingKeys = new Set(
				measurementReminders.map((r) => formatReminderHm(r)),
			)
			for (const slot of [
				{ hour: 8, minute: 0 },
				{ hour: 20, minute: 0 },
			]) {
				const key = formatReminderHm(slot)
				if (existingKeys.has(key)) {
					continue
				}
				await upsertMeasurementReminder({
					repos,
					profileId: profile.id,
					hour: slot.hour,
					minute: slot.minute,
					weekdays: [...DAILY_WEEKDAYS],
					enabled: true,
				})
			}
			await refreshMedications()
		} finally {
			setBusy(false)
		}
	}

	async function handleToggleMedicationRemind(
		medicationId: string,
		enabled: boolean,
	) {
		const med = medications.find((m) => m.id === medicationId)
		if (!med) {
			return
		}
		setBusy(true)
		try {
			await saveMedication({
				id: med.id,
				name: med.name,
				dosageText: med.dosageText,
				schedule: med.schedule,
				isActive: med.isActive,
				remindEnabled: enabled,
			})
		} finally {
			setBusy(false)
		}
	}

	function toggleEditorWeekday(day: number) {
		setEditor((prev) => {
			if (!prev) {
				return prev
			}
			const has = prev.weekdays.includes(day)
			return {
				...prev,
				weekdays: has
					? prev.weekdays.filter((d) => d !== day)
					: [...prev.weekdays, day],
			}
		})
	}

	if (!ready) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top }]}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		)
	}

	if (error) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top }]}>
				<Text style={styles.errorText}>{error}</Text>
			</View>
		)
	}

	return (
		<>
			<Stack.Screen
				options={{
					headerShown: true,
					title: t('reminders.title'),
					headerBackTitle: t('common.back'),
				}}
			/>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{
						paddingTop: spacing.md,
						paddingBottom: insets.bottom + spacing.xl,
					},
				]}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.sectionTitle}>
					{t('reminders.measurementTitle')}
				</Text>
				<Text style={styles.sectionHint}>{t('reminders.sectionHint')}</Text>

				{measurementReminders.length === 0 ? (
					<Text style={styles.emptyText}>
						{t('reminders.emptyMeasurement')}
					</Text>
				) : (
					measurementReminders.map((reminder) => (
						<View key={reminder.id} style={styles.rowCard}>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t('reminders.editA11y', {
									time: formatReminderHm(reminder),
								})}
								onPress={() => openEditEditor(reminder)}
								style={styles.rowMain}
							>
								<Text style={styles.rowTime}>
									{formatReminderHm(reminder)}
								</Text>
								<Text style={styles.rowDays}>
									{formatWeekdays(reminder.weekdays)}
								</Text>
							</Pressable>
							<Switch
								value={reminder.enabled}
								disabled={busy}
								onValueChange={(value) =>
									void handleToggleMeasurement(reminder, value)
								}
								trackColor={{
									false: colors.border,
									true: colors.chipSelected,
								}}
								thumbColor={
									reminder.enabled ? colors.primary : '#f4f4f4'
								}
								accessibilityLabel={t('reminders.enableA11y')}
							/>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t('reminders.deleteA11y')}
								onPress={() => handleDeleteMeasurement(reminder)}
								style={styles.deleteHit}
							>
								<Text style={styles.deleteText}>×</Text>
							</Pressable>
						</View>
					))
				)}

				<View style={styles.actionsRow}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t('reminders.add')}
						onPress={() => openCreateEditor()}
						disabled={busy}
						style={({ pressed }) => [
							styles.outlineButton,
							pressed && styles.pressed,
							busy && styles.disabled,
						]}
					>
						<Text style={styles.outlineButtonText}>
							{t('health.addEntry')}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t('reminders.addMorningEveningA11y')}
						onPress={() => void handleAddMorningEvening()}
						disabled={busy}
						style={({ pressed }) => [
							styles.outlineButton,
							pressed && styles.pressed,
							busy && styles.disabled,
						]}
					>
						<Text style={styles.outlineButtonText}>
							{t('reminders.addMorningEvening')}
						</Text>
					</Pressable>
				</View>

				{editor ? (
					<View style={styles.editorCard}>
						<Text style={styles.editorTitle}>
							{editor.id
								? t('reminders.editTitle')
								: t('reminders.newTitle')}
						</Text>
						<Text style={styles.fieldLabel}>{t('reminders.timeLabel')}</Text>
						<TextInput
							value={editor.timeHm}
							onChangeText={(timeHm) =>
								setEditor((prev) =>
									prev ? { ...prev, timeHm } : prev,
								)
							}
							placeholder="08:00"
							placeholderTextColor={colors.textMuted}
							keyboardType="numbers-and-punctuation"
							style={styles.input}
							accessibilityLabel={t('reminders.timeA11y')}
						/>
						<Text style={styles.fieldLabel}>
							{t('reminders.weekdaysLabel')}
						</Text>
						<View style={styles.weekdayRow}>
							{WEEKDAY_UI_ORDER.map((day) => {
								const selected = editor.weekdays.includes(day)
								const label = t(WEEKDAY_KEYS[day]!)
								return (
									<Pressable
										key={day}
										onPress={() => toggleEditorWeekday(day)}
										style={[
											styles.weekdayChip,
											selected && styles.weekdayChipSelected,
										]}
										accessibilityRole="button"
										accessibilityState={{ selected }}
										accessibilityLabel={label}
									>
										<Text
											style={[
												styles.weekdayChipText,
												selected &&
													styles.weekdayChipTextSelected,
											]}
										>
											{label}
										</Text>
									</Pressable>
								)
							})}
						</View>
						<View style={styles.switchRow}>
							<Text style={styles.switchTitle}>{t('reminders.enabled')}</Text>
							<Switch
								value={editor.enabled}
								onValueChange={(enabled) =>
									setEditor((prev) =>
										prev ? { ...prev, enabled } : prev,
									)
								}
								accessibilityLabel={t('reminders.enabled')}
							/>
						</View>
						{localError ? (
							<Text style={styles.errorText}>{localError}</Text>
						) : null}
						<View style={styles.editorActions}>
							<Pressable
								onPress={() => {
									setEditor(null)
									setLocalError(null)
								}}
								style={({ pressed }) => [
									styles.secondaryBtn,
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.secondaryBtnText}>
									{t('common.cancel')}
								</Text>
							</Pressable>
							<View style={styles.editorSave}>
								<PrimaryButton
									label={busy ? t('common.saving') : t('common.save')}
									onPress={() => void handleSaveEditor()}
									disabled={busy}
								/>
							</View>
						</View>
					</View>
				) : null}

				{permission === 'denied' ? (
					<Text style={styles.permHint}>
						{t('reminders.permissionHint')}
					</Text>
				) : null}

				<Text style={[styles.sectionTitle, styles.sectionSpaced]}>
					{t('meds.title')}
				</Text>
				{activeMeds.length === 0 ? (
					<Text style={styles.emptyText}>{t('reminders.emptyMeds')}</Text>
				) : (
					activeMeds.map((med) => {
						const remindOn = reminders.some(
							(r) => r.medicationId === med.id && r.enabled,
						)
						return (
							<View key={med.id} style={styles.rowCard}>
								<View style={styles.rowMain}>
									<Text style={styles.rowTime}>{med.name}</Text>
									<Text style={styles.rowDays}>
										{med.schedule
											.map((slot) => formatReminderHm(slot))
											.join(', ')}
									</Text>
								</View>
								<Switch
									value={remindOn}
									disabled={busy}
									onValueChange={(value) =>
										void handleToggleMedicationRemind(
											med.id,
											value,
										)
									}
									trackColor={{
										false: colors.border,
										true: colors.chipSelected,
									}}
									thumbColor={
										remindOn ? colors.primary : '#f4f4f4'
									}
									accessibilityLabel={t('reminders.medToggleA11y', {
										name: med.name,
									})}
								/>
							</View>
						)
					})
				)}
			</ScrollView>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: spacing.lg,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sectionTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	sectionSpaced: {
		marginTop: spacing.xl,
	},
	sectionHint: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	emptyText: {
		fontSize: typography.body,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	rowCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	rowMain: {
		flex: 1,
	},
	rowTime: {
		fontSize: typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	rowDays: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	deleteHit: {
		minWidth: touchTargetMin - 8,
		minHeight: touchTargetMin - 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	deleteText: {
		fontSize: 22,
		color: colors.danger,
		fontWeight: '600',
	},
	actionsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginTop: spacing.sm,
		marginBottom: spacing.md,
	},
	outlineButton: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	outlineButtonText: {
		fontSize: typography.secondary,
		fontWeight: '700',
		color: colors.primary,
	},
	editorCard: {
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		marginBottom: spacing.md,
	},
	editorTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	fieldLabel: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
		marginTop: spacing.sm,
	},
	input: {
		minHeight: touchTargetMin,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.background,
	},
	weekdayRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	weekdayChip: {
		minHeight: touchTargetMin - 8,
		minWidth: touchTargetMin - 8,
		paddingHorizontal: spacing.sm,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.chip,
	},
	weekdayChipSelected: {
		backgroundColor: colors.chipSelected,
		borderColor: colors.primary,
	},
	weekdayChipText: {
		fontSize: typography.secondary,
		color: colors.text,
	},
	weekdayChipTextSelected: {
		fontWeight: '700',
		color: colors.primary,
	},
	switchRow: {
		marginTop: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	switchTitle: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
	},
	editorActions: {
		marginTop: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	secondaryBtn: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	secondaryBtnText: {
		color: colors.textMuted,
		fontWeight: '600',
	},
	editorSave: {
		flex: 1,
	},
	permHint: {
		marginTop: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	pressed: {
		opacity: 0.85,
	},
	disabled: {
		opacity: 0.5,
	},
	errorText: {
		fontSize: typography.body,
		color: colors.danger,
		marginTop: spacing.sm,
	},
})
