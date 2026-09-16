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
import {
	deleteMeasurementReminder,
	filterMeasurementReminders,
	formatReminderHm,
	formatWeekdaysRu,
	setMeasurementReminderEnabled,
	upsertMeasurementReminder,
	WEEKDAY_LABELS_RU,
} from '@/services/measurement-reminders'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/** Display order Mon→Sun for weekday chips. */
const WEEKDAY_UI_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

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
			setLocalError('Введите время в формате ЧЧ:ММ')
			return
		}
		if (editor.weekdays.length === 0) {
			setLocalError('Выберите хотя бы один день недели')
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
					: 'Не удалось сохранить напоминание',
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
		Alert.alert('Удалить напоминание?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
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
					title: 'Напоминания',
					headerBackTitle: 'Назад',
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
				<Text style={styles.sectionTitle}>Измерения давления</Text>
				<Text style={styles.sectionHint}>
					Локальные уведомления в выбранные дни и время.
				</Text>

				{measurementReminders.length === 0 ? (
					<Text style={styles.emptyText}>
						Пока нет напоминаний об измерении.
					</Text>
				) : (
					measurementReminders.map((reminder) => (
						<View key={reminder.id} style={styles.rowCard}>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Изменить напоминание ${formatReminderHm(reminder)}`}
								onPress={() => openEditEditor(reminder)}
								style={styles.rowMain}
							>
								<Text style={styles.rowTime}>
									{formatReminderHm(reminder)}
								</Text>
								<Text style={styles.rowDays}>
									{formatWeekdaysRu(reminder.weekdays)}
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
								accessibilityLabel="Включить напоминание"
							/>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Удалить напоминание"
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
						accessibilityLabel="Добавить напоминание"
						onPress={() => openCreateEditor()}
						disabled={busy}
						style={({ pressed }) => [
							styles.outlineButton,
							pressed && styles.pressed,
							busy && styles.disabled,
						]}
					>
						<Text style={styles.outlineButtonText}>Добавить</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Добавить утро и вечер"
						onPress={() => void handleAddMorningEvening()}
						disabled={busy}
						style={({ pressed }) => [
							styles.outlineButton,
							pressed && styles.pressed,
							busy && styles.disabled,
						]}
					>
						<Text style={styles.outlineButtonText}>Утро и вечер</Text>
					</Pressable>
				</View>

				{editor ? (
					<View style={styles.editorCard}>
						<Text style={styles.editorTitle}>
							{editor.id ? 'Изменить' : 'Новое напоминание'}
						</Text>
						<Text style={styles.fieldLabel}>Время</Text>
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
							accessibilityLabel="Время напоминания"
						/>
						<Text style={styles.fieldLabel}>Дни недели</Text>
						<View style={styles.weekdayRow}>
							{WEEKDAY_UI_ORDER.map((day) => {
								const selected = editor.weekdays.includes(day)
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
										accessibilityLabel={WEEKDAY_LABELS_RU[day]}
									>
										<Text
											style={[
												styles.weekdayChipText,
												selected &&
													styles.weekdayChipTextSelected,
											]}
										>
											{WEEKDAY_LABELS_RU[day]}
										</Text>
									</Pressable>
								)
							})}
						</View>
						<View style={styles.switchRow}>
							<Text style={styles.switchTitle}>Включено</Text>
							<Switch
								value={editor.enabled}
								onValueChange={(enabled) =>
									setEditor((prev) =>
										prev ? { ...prev, enabled } : prev,
									)
								}
								accessibilityLabel="Включено"
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
								<Text style={styles.secondaryBtnText}>Отмена</Text>
							</Pressable>
							<View style={styles.editorSave}>
								<PrimaryButton
									label={busy ? 'Сохранение…' : 'Сохранить'}
									onPress={() => void handleSaveEditor()}
									disabled={busy}
								/>
							</View>
						</View>
					</View>
				) : null}

				{permission === 'denied' ? (
					<Text style={styles.permHint}>
						Системные уведомления отключены. Расписание сохранится.
					</Text>
				) : null}

				<Text style={[styles.sectionTitle, styles.sectionSpaced]}>
					Лекарства
				</Text>
				{activeMeds.length === 0 ? (
					<Text style={styles.emptyText}>
						Нет активных лекарств для напоминаний.
					</Text>
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
											.map((t) =>
												formatReminderHm(t as Reminder),
											)
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
									accessibilityLabel={`Напоминать о ${med.name}`}
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
		minHeight: touchTargetMin,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		marginBottom: spacing.sm,
	},
	rowMain: {
		flex: 1,
	},
	rowTime: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
	},
	rowDays: {
		marginTop: 2,
		fontSize: 13,
		color: colors.textMuted,
	},
	deleteHit: {
		minWidth: 36,
		minHeight: touchTargetMin,
		alignItems: 'center',
		justifyContent: 'center',
	},
	deleteText: {
		fontSize: 24,
		color: colors.danger,
		lineHeight: 28,
	},
	actionsRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.sm,
		marginBottom: spacing.md,
	},
	outlineButton: {
		flex: 1,
		minHeight: touchTargetMin,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	outlineButtonText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	editorCard: {
		marginBottom: spacing.lg,
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
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
		minWidth: 40,
		minHeight: 40,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.chip,
	},
	weekdayChipSelected: {
		backgroundColor: colors.chipSelected,
	},
	weekdayChipText: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		fontWeight: '600',
	},
	weekdayChipTextSelected: {
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
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.md,
		alignItems: 'center',
	},
	secondaryBtn: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
	},
	secondaryBtnText: {
		fontSize: typography.body,
		color: colors.text,
	},
	editorSave: {
		flex: 1,
	},
	permHint: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.md,
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
