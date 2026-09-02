import { useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import {
	formatLocalTime,
	formatRussianLongDate,
	localDayKeyFromIso,
} from '@/domain/dates/local-day'
import {
	formatScheduleHm,
	parseScheduleHm,
	uniqueScheduleTimes,
} from '@/domain/medications/schedule'
import type { MedicationScheduleTime } from '@/domain/types'
import { useDiary } from '@/hooks/use-diary'
import { useMedications } from '@/hooks/use-medications'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

type Mode = 'create' | 'edit'

type FormSeed = {
	name: string
	dosageText: string
	times: MedicationScheduleTime[]
	remindEnabled: boolean
	isActive: boolean
}

/**
 * Shared create/edit medication form.
 * Schedule times are local wall-clock HH:mm; V1 frequency is daily only.
 */
export function MedicationFormScreen({ mode }: { mode: Mode }) {
	const params = useLocalSearchParams<{ id?: string }>()
	const { profile } = useDiary()
	const { medications, reminders } = useMedications()

	const existing =
		mode === 'edit'
			? medications.find((m) => m.id === String(params.id))
			: undefined

	if (mode === 'edit' && !existing) {
		return (
			<>
				<Stack.Screen
					options={{
						headerShown: true,
						title: 'Лекарство',
						headerTintColor: colors.primary,
						headerStyle: { backgroundColor: colors.background },
						headerShadowVisible: false,
					}}
				/>
				<View style={styles.centered}>
					{!profile || medications.length === 0 ? (
						<ActivityIndicator color={colors.primary} />
					) : (
						<Text style={styles.muted}>Лекарство не найдено</Text>
					)}
				</View>
			</>
		)
	}

	const seed: FormSeed = existing
		? {
				name: existing.name,
				dosageText: existing.dosageText,
				times:
					existing.schedule.length > 0
						? existing.schedule
						: [{ hour: 8, minute: 0 }],
				remindEnabled: reminders.some(
					(r) => r.medicationId === existing.id && r.enabled,
				),
				isActive: existing.isActive,
			}
		: {
				name: '',
				dosageText: '',
				times: [{ hour: 8, minute: 0 }],
				remindEnabled: true,
				isActive: true,
			}

	return (
		<MedicationFormEditor
			key={existing?.id ?? 'new'}
			mode={mode}
			medicationId={existing?.id}
			seed={seed}
		/>
	)
}

function MedicationFormEditor({
	mode,
	medicationId,
	seed,
}: {
	mode: Mode
	medicationId?: string
	seed: FormSeed
}) {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const {
		intakes,
		reminders,
		saveMedication,
		deactivateMedication,
		deleteMedicationPermanently,
		permission,
	} = useMedications()

	const [name, setName] = useState(seed.name)
	const [dosageText, setDosageText] = useState(seed.dosageText)
	const [times, setTimes] = useState<MedicationScheduleTime[]>(seed.times)
	const [timeDraft, setTimeDraft] = useState('')
	const [remindEnabled, setRemindEnabled] = useState(seed.remindEnabled)
	const [isActive, setIsActive] = useState(seed.isActive)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const recentIntakes = useMemo(() => {
		if (!medicationId) {
			return []
		}
		return intakes
			.filter((i) => i.medicationId === medicationId && i.taken)
			.slice(0, 30)
	}, [intakes, medicationId])

	const medicationReminders = useMemo(() => {
		if (!medicationId) {
			return []
		}
		return reminders.filter((r) => r.medicationId === medicationId)
	}, [reminders, medicationId])

	function handleAddTime() {
		const parsed = parseScheduleHm(timeDraft)
		if (!parsed) {
			setError('Введите время в формате ЧЧ:ММ')
			return
		}
		setError(null)
		setTimes((prev) => uniqueScheduleTimes([...prev, parsed]))
		setTimeDraft('')
	}

	function handleRemoveTime(time: MedicationScheduleTime) {
		setTimes((prev) =>
			prev.filter(
				(t) => !(t.hour === time.hour && t.minute === time.minute),
			),
		)
	}

	async function handleSave() {
		const trimmed = name.trim()
		if (!trimmed) {
			setError('Укажите название лекарства')
			return
		}
		const schedule = uniqueScheduleTimes(times)
		if (schedule.length === 0) {
			setError('Добавьте хотя бы одно время приёма')
			return
		}
		setSaving(true)
		setError(null)
		try {
			await saveMedication({
				id: mode === 'edit' ? medicationId : undefined,
				name: trimmed,
				dosageText,
				schedule,
				isActive,
				remindEnabled: remindEnabled && isActive,
			})
			if (mode === 'create') {
				analytics.trackMedicationCreated()
			} else {
				analytics.trackMedicationUpdated()
			}
			if (remindEnabled && isActive) {
				analytics.trackReminderEnabled()
			}
			router.back()
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Не удалось сохранить лекарство',
			)
		} finally {
			setSaving(false)
		}
	}

	function handleDeactivate() {
		Alert.alert(
			'Прекратить отслеживание?',
			'История отметок сохранится. Напоминания будут отключены.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Прекратить',
					onPress: () => {
						void (async () => {
							await deactivateMedication(String(medicationId))
							analytics.trackMedicationDeactivated()
							router.back()
						})()
					},
				},
			],
		)
	}

	function handleDeleteForever() {
		Alert.alert(
			'Удалить лекарство и историю?',
			'Все отметки приёма этого лекарства будут удалены безвозвратно.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Удалить',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await deleteMedicationPermanently(String(medicationId))
							router.back()
						})()
					},
				},
			],
		)
	}

	const title = mode === 'create' ? 'Новое лекарство' : 'Лекарство'

	return (
		<>
			<Stack.Screen
				options={{
					headerShown: true,
					title,
					headerBackTitle: 'Назад',
					headerTintColor: colors.primary,
					headerStyle: { backgroundColor: colors.background },
					headerShadowVisible: false,
				}}
			/>
			<KeyboardAvoidingView
				style={styles.root}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView
					contentContainerStyle={{
						padding: spacing.lg,
						paddingBottom: insets.bottom + 120,
					}}
					keyboardShouldPersistTaps="handled"
				>
					<Text style={styles.label}>Название</Text>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="Например, Лозартан"
						placeholderTextColor={colors.textMuted}
						style={styles.input}
						accessibilityLabel="Название лекарства"
					/>

					<Text style={styles.label}>Дозировка (необязательно)</Text>
					<TextInput
						value={dosageText}
						onChangeText={setDosageText}
						placeholder="50 мг или 1 таблетка"
						placeholderTextColor={colors.textMuted}
						style={styles.input}
						accessibilityLabel="Дозировка"
					/>

					<Text style={styles.label}>Время приёма (каждый день)</Text>
					<View style={styles.chips}>
						{times.map((t) => (
							<Pressable
								key={formatScheduleHm(t)}
								onPress={() => handleRemoveTime(t)}
								style={styles.timeChip}
								accessibilityLabel={`Удалить время ${formatScheduleHm(t)}`}
							>
								<Text style={styles.timeChipText}>
									{formatScheduleHm(t)} ×
								</Text>
							</Pressable>
						))}
					</View>
					<View style={styles.addTimeRow}>
						<TextInput
							value={timeDraft}
							onChangeText={setTimeDraft}
							placeholder="08:00"
							placeholderTextColor={colors.textMuted}
							keyboardType="numbers-and-punctuation"
							style={[styles.input, styles.timeInput]}
							accessibilityLabel="Новое время"
						/>
						<Pressable
							onPress={handleAddTime}
							style={styles.addTimeBtn}
							accessibilityRole="button"
							accessibilityLabel="Добавить время"
						>
							<Text style={styles.addTimeLabel}>Добавить</Text>
						</Pressable>
					</View>

					<View style={styles.switchRow}>
						<View style={styles.switchCopy}>
							<Text style={styles.switchTitle}>Напоминать</Text>
							<Text style={styles.switchHint}>
								Локальное уведомление в выбранное время
							</Text>
						</View>
						<Switch
							value={remindEnabled}
							onValueChange={setRemindEnabled}
							trackColor={{
								false: colors.border,
								true: colors.chipSelected,
							}}
							thumbColor={
								remindEnabled ? colors.primary : '#f4f4f4'
							}
							accessibilityLabel="Напоминать"
						/>
					</View>

					{permission === 'denied' && remindEnabled ? (
						<Text style={styles.permHint}>
							Системные уведомления отключены. Расписание сохранится.
						</Text>
					) : null}

					{mode === 'edit' ? (
						<View style={styles.switchRow}>
							<View style={styles.switchCopy}>
								<Text style={styles.switchTitle}>Активно</Text>
								<Text style={styles.switchHint}>
									Выключено — не показывать в «Сегодня»
								</Text>
							</View>
							<Switch
								value={isActive}
								onValueChange={setIsActive}
								accessibilityLabel="Активно"
							/>
						</View>
					) : null}

					{error ? <Text style={styles.error}>{error}</Text> : null}

					{mode === 'edit' && recentIntakes.length > 0 ? (
						<View style={styles.history}>
							<Text style={styles.historyTitle}>
								Недавние отметки
							</Text>
							{groupIntakes(recentIntakes).map((group) => (
								<View key={group.dayKey} style={styles.histGroup}>
									<Text style={styles.histDay}>{group.label}</Text>
									{group.items.map((item) => (
										<Text key={item.id} style={styles.histRow}>
											{formatLocalTime(item.takenAt)} — принято
										</Text>
									))}
								</View>
							))}
						</View>
					) : null}

					{mode === 'edit' && medicationReminders.length > 0 ? (
						<Text style={styles.mutedSmall}>
							Напоминания:{' '}
							{medicationReminders
								.filter((r) => r.enabled)
								.map((r) => formatScheduleHm(r))
								.join(', ') || 'нет'}
						</Text>
					) : null}

					{mode === 'edit' ? (
						<>
							<Pressable
								onPress={handleDeactivate}
								style={styles.secondaryAction}
							>
								<Text style={styles.secondaryActionText}>
									Прекратить отслеживание
								</Text>
							</Pressable>
							<Pressable
								onPress={handleDeleteForever}
								style={styles.dangerAction}
							>
								<Text style={styles.dangerActionText}>
									Удалить вместе с историей
								</Text>
							</Pressable>
						</>
					) : null}
				</ScrollView>

				<View
					style={[
						styles.footer,
						{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
					]}
				>
					<PrimaryButton
						label={saving ? 'Сохранение…' : 'Сохранить'}
						onPress={() => void handleSave()}
						disabled={saving}
					/>
				</View>
			</KeyboardAvoidingView>
		</>
	)
}

function groupIntakes(
	items: { id: string; takenAt: string }[],
): { dayKey: string; label: string; items: typeof items }[] {
	const today = localDayKeyFromIso(new Date().toISOString())
	const map = new Map<string, typeof items>()
	for (const item of items) {
		const key = localDayKeyFromIso(item.takenAt)
		const list = map.get(key) ?? []
		list.push(item)
		map.set(key, list)
	}
	return [...map.entries()].map(([dayKey, groupItems]) => {
		const [y, m, d] = dayKey.split('-').map(Number)
		const date = new Date(y!, m! - 1, d!)
		return {
			dayKey,
			label: dayKey === today ? 'Сегодня' : formatRussianLongDate(date),
			items: groupItems,
		}
	})
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.background },
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
	},
	label: {
		marginTop: spacing.md,
		marginBottom: spacing.xs,
		fontSize: typography.secondary,
		fontWeight: '600',
		color: colors.textMuted,
	},
	input: {
		minHeight: touchTargetMin,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.surface,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	timeChip: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: 999,
		backgroundColor: colors.chipSelected,
		minHeight: touchTargetMin - 8,
		justifyContent: 'center',
	},
	timeChipText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	addTimeRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		alignItems: 'center',
	},
	timeInput: {
		flex: 1,
	},
	addTimeBtn: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.chip,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addTimeLabel: {
		fontSize: typography.secondary,
		fontWeight: '700',
		color: colors.primary,
	},
	switchRow: {
		marginTop: spacing.lg,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.md,
	},
	switchCopy: { flex: 1 },
	switchTitle: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
	},
	switchHint: {
		marginTop: 2,
		fontSize: 13,
		color: colors.textMuted,
		lineHeight: 18,
	},
	permHint: {
		marginTop: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	error: {
		marginTop: spacing.md,
		color: colors.danger,
		fontSize: typography.secondary,
	},
	footer: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		backgroundColor: colors.background,
	},
	history: {
		marginTop: spacing.xl,
	},
	historyTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	histGroup: { marginBottom: spacing.md },
	histDay: {
		fontSize: typography.secondary,
		fontWeight: '600',
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	histRow: {
		fontSize: typography.body,
		color: colors.text,
		marginBottom: 4,
	},
	secondaryAction: {
		marginTop: spacing.xl,
		minHeight: touchTargetMin,
		justifyContent: 'center',
	},
	secondaryActionText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	dangerAction: {
		marginTop: spacing.sm,
		minHeight: touchTargetMin,
		justifyContent: 'center',
	},
	dangerActionText: {
		fontSize: typography.secondary,
		color: colors.danger,
	},
	muted: { color: colors.textMuted },
	mutedSmall: {
		marginTop: spacing.md,
		fontSize: 13,
		color: colors.textMuted,
	},
})
