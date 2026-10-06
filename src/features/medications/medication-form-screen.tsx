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
import { formatLongDate, useI18n } from '@/i18n'
import type { AppLocale } from '@/i18n/locale'
import {
	markMedicationRemindPrompted,
	shouldOfferMedicationRemindPrompt,
} from '@/services/reminder-prompt-persistence'
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
	const { t } = useI18n()

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
						title: t('meds.form.editTitle'),
						headerTintColor: colors.primary,
						headerStyle: { backgroundColor: colors.background },
						headerShadowVisible: false,
					}}
				/>
				<View style={styles.centered}>
					{!profile || medications.length === 0 ? (
						<ActivityIndicator color={colors.primary} />
					) : (
						<Text style={styles.muted}>{t('meds.notFound')}</Text>
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
	const { t, locale } = useI18n()
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
			setError(t('meds.form.timeFormatError'))
			return
		}
		setError(null)
		setTimes((prev) => uniqueScheduleTimes([...prev, parsed]))
		setTimeDraft('')
	}

	function handleRemoveTime(time: MedicationScheduleTime) {
		setTimes((prev) =>
			prev.filter(
				(slot) => !(slot.hour === time.hour && slot.minute === time.minute),
			),
		)
	}

	async function handleSave() {
		const trimmed = name.trim()
		if (!trimmed) {
			setError(t('meds.form.nameRequiredFull'))
			return
		}
		const schedule = uniqueScheduleTimes(times)
		if (schedule.length === 0) {
			setError(t('meds.form.timeRequiredFull'))
			return
		}
		setSaving(true)
		setError(null)
		try {
			const wasCreate = mode === 'create'
			const startedWithoutRemind = wasCreate && !remindEnabled
			const saved = await saveMedication({
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

			if (
				startedWithoutRemind &&
				isActive &&
				(await shouldOfferMedicationRemindPrompt(saved.id))
			) {
				await markMedicationRemindPrompted(saved.id)
				await new Promise<void>((resolve) => {
					Alert.alert(
						t('meds.form.remindPromptTitle'),
						undefined,
						[
							{
								text: t('meds.form.remindPromptLater'),
								style: 'cancel',
								onPress: () => resolve(),
							},
							{
								text: t('meds.form.remindPromptEnable'),
								onPress: () => {
									void (async () => {
										await saveMedication({
											id: saved.id,
											name: trimmed,
											dosageText,
											schedule,
											isActive: true,
											remindEnabled: true,
										})
										analytics.trackReminderEnabled()
										resolve()
									})()
								},
							},
						],
						{ cancelable: false },
					)
				})
			}

			router.back()
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('meds.form.saveFailed'),
			)
		} finally {
			setSaving(false)
		}
	}

	function handleDeactivate() {
		Alert.alert(
			t('meds.form.deactivateConfirmTitle'),
			t('meds.form.deactivateConfirmBody'),
			[
				{ text: t('common.cancel'), style: 'cancel' },
				{
					text: t('meds.form.deactivateConfirmAction'),
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
			t('meds.form.deleteForeverTitle'),
			t('meds.form.deleteForeverBody'),
			[
				{ text: t('common.cancel'), style: 'cancel' },
				{
					text: t('common.delete'),
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

	const title =
		mode === 'create' ? t('meds.form.newTitle') : t('meds.form.editTitle')

	return (
		<>
			<Stack.Screen
				options={{
					headerShown: true,
					title,
					headerBackTitle: t('common.back'),
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
					<Text style={styles.label}>{t('meds.form.name')}</Text>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder={t('meds.form.namePlaceholder')}
						placeholderTextColor={colors.textMuted}
						style={styles.input}
						accessibilityLabel={t('meds.form.nameA11y')}
					/>

					<Text style={styles.label}>{t('meds.form.dosageOptional')}</Text>
					<TextInput
						value={dosageText}
						onChangeText={setDosageText}
						placeholder={t('meds.form.dosagePlaceholder')}
						placeholderTextColor={colors.textMuted}
						style={styles.input}
						accessibilityLabel={t('meds.form.dosage')}
					/>

					<Text style={styles.label}>{t('meds.form.times')}</Text>
					<View style={styles.chips}>
						{times.map((slot) => (
							<Pressable
								key={formatScheduleHm(slot)}
								onPress={() => handleRemoveTime(slot)}
								style={styles.timeChip}
								accessibilityLabel={t('meds.form.removeTimeA11y', {
									time: formatScheduleHm(slot),
								})}
							>
								<Text style={styles.timeChipText}>
									{formatScheduleHm(slot)} ×
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
							accessibilityLabel={t('meds.form.newTimeA11y')}
						/>
						<Pressable
							onPress={handleAddTime}
							style={styles.addTimeBtn}
							accessibilityRole="button"
							accessibilityLabel={t('meds.form.addTime')}
						>
							<Text style={styles.addTimeLabel}>{t('health.addEntry')}</Text>
						</Pressable>
					</View>

					<View style={styles.switchRow}>
						<View style={styles.switchCopy}>
							<Text style={styles.switchTitle}>{t('meds.form.remind')}</Text>
							<Text style={styles.switchHint}>{t('meds.form.remindHint')}</Text>
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
							accessibilityLabel={t('meds.form.remind')}
						/>
					</View>

					{permission === 'denied' && remindEnabled ? (
						<Text style={styles.permHint}>
							{t('meds.form.permissionHint')}
						</Text>
					) : null}

					{mode === 'edit' ? (
						<View style={styles.switchRow}>
							<View style={styles.switchCopy}>
								<Text style={styles.switchTitle}>{t('meds.form.active')}</Text>
								<Text style={styles.switchHint}>
									{t('meds.form.activeHint')}
								</Text>
							</View>
							<Switch
								value={isActive}
								onValueChange={setIsActive}
								accessibilityLabel={t('meds.form.active')}
							/>
						</View>
					) : null}

					{error ? <Text style={styles.error}>{error}</Text> : null}

					{mode === 'edit' && recentIntakes.length > 0 ? (
						<View style={styles.history}>
							<Text style={styles.historyTitle}>
								{t('meds.form.recentIntakes')}
							</Text>
							{groupIntakes(recentIntakes, locale, t('common.today')).map(
								(group) => (
									<View key={group.dayKey} style={styles.histGroup}>
										<Text style={styles.histDay}>{group.label}</Text>
										{group.items.map((item) => (
											<Text key={item.id} style={styles.histRow}>
												{formatLocalTime(item.takenAt)} —{' '}
												{t('meds.form.takenLabel')}
											</Text>
										))}
									</View>
								),
							)}
						</View>
					) : null}

					{mode === 'edit' && medicationReminders.length > 0 ? (
						<Text style={styles.mutedSmall}>
							{t('meds.form.remindersLabel', {
								list:
									medicationReminders
										.filter((r) => r.enabled)
										.map((r) => formatScheduleHm(r))
										.join(', ') || t('meds.form.remindersNone'),
							})}
						</Text>
					) : null}

					{mode === 'edit' ? (
						<>
							<Pressable
								onPress={handleDeactivate}
								style={styles.secondaryAction}
							>
								<Text style={styles.secondaryActionText}>
									{t('meds.form.stopTracking')}
								</Text>
							</Pressable>
							<Pressable
								onPress={handleDeleteForever}
								style={styles.dangerAction}
							>
								<Text style={styles.dangerActionText}>
									{t('meds.form.deleteWithHistory')}
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
						label={saving ? t('common.saving') : t('common.save')}
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
	locale: AppLocale,
	todayLabel: string,
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
			label: dayKey === today ? todayLabel : formatLongDate(date, locale),
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
