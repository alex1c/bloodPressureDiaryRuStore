import { useEffect, useMemo, useRef, useState } from 'react'
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import type { Measurement, MeasurementTag } from '@/domain/types'
import {
	formatLocalDayKey,
	formatLocalTime,
} from '@/domain/dates/local-day'
import { useDiary } from '@/hooks/use-diary'
import { colors, spacing, typography } from '@/theme'
import { IntegerField, PrimaryButton } from './components/form-controls'
import { TagChips } from './components/tag-chips'
import {
	measurementFormErrorMessage,
	parseMeasurementForm,
	type MeasurementFormDraft,
} from './input/parse-measurement-form'

type Mode = 'create' | 'edit'

function buildDraftFromNow(): MeasurementFormDraft {
	const now = new Date()
	return {
		systolicText: '',
		diastolicText: '',
		pulseText: '',
		dayKey: formatLocalDayKey(now),
		timeHm: formatLocalTime(now.toISOString()),
		tags: [],
		note: '',
	}
}

function buildDraftFromMeasurement(m: Measurement): MeasurementFormDraft {
	return {
		systolicText: String(m.systolic),
		diastolicText: String(m.diastolic),
		pulseText: String(m.pulse),
		dayKey: formatLocalDayKey(new Date(m.measuredAt)),
		timeHm: formatLocalTime(m.measuredAt),
		tags: [...m.tags],
		note: m.note ?? '',
	}
}

type MeasurementFormScreenProps = {
	mode: Mode
}

/**
 * Shared add/edit form.
 * Save stays pinned above the keyboard; delete remains reachable via scroll.
 */
export function MeasurementFormScreen({ mode }: MeasurementFormScreenProps) {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const { repos, profile, refreshToday, refreshAll } = useDiary()

	const diastolicRef = useRef<TextInput>(null)
	const pulseRef = useRef<TextInput>(null)
	const noteRef = useRef<TextInput>(null)
	const scrollRef = useRef<ScrollView>(null)

	const [draft, setDraft] = useState<MeasurementFormDraft>(buildDraftFromNow)
	const [loaded, setLoaded] = useState(mode === 'create')
	const [error, setError] = useState<string | null>(null)
	const [softHint, setSoftHint] = useState<string | null>(null)
	const [softAccepted, setSoftAccepted] = useState(false)
	const [saving, setSaving] = useState(false)

	const title = mode === 'create' ? 'Новое измерение' : 'Измерение'

	useEffect(() => {
		if (mode !== 'edit' || !repos || !params.id) {
			return
		}
		let cancelled = false
		void (async () => {
			const row = await repos.measurements.getById(String(params.id))
			if (cancelled) {
				return
			}
			if (!row) {
				setError('Запись не найдена')
				setLoaded(true)
				return
			}
			setDraft(buildDraftFromMeasurement(row))
			setLoaded(true)
		})()
		return () => {
			cancelled = true
		}
	}, [mode, repos, params.id])

	const canSave = useMemo(
		() => Boolean(repos && profile && loaded && !saving),
		[repos, profile, loaded, saving],
	)

	function patchDraft(partial: Partial<MeasurementFormDraft>) {
		setDraft((prev) => ({ ...prev, ...partial }))
		setError(null)
		setSoftHint(null)
		setSoftAccepted(false)
	}

	function handleToggleTag(tag: MeasurementTag) {
		setDraft((prev) => {
			const has = prev.tags.includes(tag)
			return {
				...prev,
				tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
			}
		})
	}

	async function persistRefresh() {
		await refreshToday()
		await refreshAll()
	}

	async function handleSave() {
		if (!repos || !profile) {
			return
		}
		const parsed = parseMeasurementForm(draft)
		if (!parsed.ok) {
			setError(measurementFormErrorMessage(parsed.code))
			return
		}

		if (parsed.softCheckMessage && !softAccepted) {
			setSoftHint(parsed.softCheckMessage)
			setSoftAccepted(true)
			return
		}

		setSaving(true)
		try {
			if (mode === 'create') {
				await repos.measurements.create({
					profileId: profile.id,
					systolic: parsed.systolic,
					diastolic: parsed.diastolic,
					pulse: parsed.pulse,
					measuredAt: parsed.measuredAt,
					periodOfDay: parsed.periodOfDay,
					tags: parsed.tags,
					note: parsed.note,
					wellbeing: null,
				})
				analytics.trackMeasurementCreated({
					hasTags: parsed.tags.length > 0,
					hasNote: Boolean(parsed.note?.trim()),
				})
			} else if (params.id) {
				await repos.measurements.update(String(params.id), {
					systolic: parsed.systolic,
					diastolic: parsed.diastolic,
					pulse: parsed.pulse,
					measuredAt: parsed.measuredAt,
					periodOfDay: parsed.periodOfDay,
					tags: parsed.tags,
					note: parsed.note,
				})
				analytics.trackMeasurementUpdated({
					hasTags: parsed.tags.length > 0,
					hasNote: Boolean(parsed.note?.trim()),
				})
			}
			await persistRefresh()
			router.back()
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Не удалось сохранить измерение',
			)
		} finally {
			setSaving(false)
		}
	}

	function handleDelete() {
		if (!repos || !params.id) {
			return
		}
		Alert.alert('Удалить измерение?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await repos.measurements.delete(String(params.id))
						analytics.trackMeasurementDeleted()
						await persistRefresh()
						router.back()
					})()
				},
			},
		])
	}

	const footerPad = Math.max(insets.bottom, spacing.sm)

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
				keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
			>
				<ScrollView
					ref={scrollRef}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					contentContainerStyle={{
						paddingHorizontal: spacing.lg,
						paddingTop: spacing.md,
						// Extra space so delete clears the sticky Save footer on 360dp.
						paddingBottom: spacing.xl * 2 + 72,
					}}
				>
					{!loaded ? (
						<Text style={styles.muted}>Загрузка…</Text>
					) : (
						<>
							<IntegerField
								label="Верхнее"
								value={draft.systolicText}
								onChangeText={(systolicText) => patchDraft({ systolicText })}
								onSubmitEditing={() => diastolicRef.current?.focus()}
								autoFocus={mode === 'create'}
							/>
							<IntegerField
								label="Нижнее"
								value={draft.diastolicText}
								onChangeText={(diastolicText) => patchDraft({ diastolicText })}
								inputRef={diastolicRef}
								onSubmitEditing={() => pulseRef.current?.focus()}
							/>
							<IntegerField
								label="Пульс"
								value={draft.pulseText}
								onChangeText={(pulseText) => patchDraft({ pulseText })}
								inputRef={pulseRef}
								returnKeyType="done"
								onSubmitEditing={() => {
									void handleSave()
								}}
							/>

							<View style={styles.datetimeRow}>
								<View style={styles.datetimeHalf}>
									<Text style={styles.fieldLabel}>Дата</Text>
									<TextInput
										value={draft.dayKey}
										onChangeText={(dayKey) => patchDraft({ dayKey })}
										autoCapitalize="none"
										autoCorrect={false}
										style={styles.datetimeInput}
										accessibilityLabel="Дата"
									/>
								</View>
								<View style={styles.datetimeHalf}>
									<Text style={styles.fieldLabel}>Время</Text>
									<TextInput
										value={draft.timeHm}
										onChangeText={(timeHm) => patchDraft({ timeHm })}
										keyboardType="numbers-and-punctuation"
										autoCapitalize="none"
										autoCorrect={false}
										style={styles.datetimeInput}
										accessibilityLabel="Время"
									/>
								</View>
							</View>
							<Text style={styles.hint}>
								Дата и время подставляются автоматически. Можно изменить.
							</Text>

							<TagChips selected={draft.tags} onToggle={handleToggleTag} />

							<Text style={styles.fieldLabel}>Заметка</Text>
							<TextInput
								ref={noteRef}
								value={draft.note}
								onChangeText={(note) => patchDraft({ note })}
								multiline
								scrollEnabled
								style={styles.note}
								placeholder="Необязательно"
								placeholderTextColor={colors.textMuted}
								accessibilityLabel="Заметка"
								onFocus={() => {
									// Keep note + actions reachable above the keyboard.
									setTimeout(() => {
										scrollRef.current?.scrollToEnd({ animated: true })
									}, 100)
								}}
							/>

							{error ? <Text style={styles.error}>{error}</Text> : null}
							{softHint ? <Text style={styles.soft}>{softHint}</Text> : null}

							{mode === 'edit' ? (
								<View style={styles.deleteWrap}>
									<PrimaryButton
										label="Удалить измерение"
										onPress={handleDelete}
										danger
									/>
								</View>
							) : null}
						</>
					)}
				</ScrollView>

				<View style={[styles.footer, { paddingBottom: footerPad }]}>
					<PrimaryButton
						label={
							saving
								? 'Сохранение…'
								: softHint && softAccepted
									? 'Сохранить всё равно'
									: 'Сохранить'
						}
						onPress={() => {
							void handleSave()
						}}
						disabled={!canSave}
					/>
				</View>
			</KeyboardAvoidingView>
		</>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	muted: {
		fontSize: typography.body,
		color: colors.textMuted,
	},
	datetimeRow: {
		flexDirection: 'row',
		gap: spacing.md,
		marginBottom: spacing.xs,
	},
	datetimeHalf: {
		flex: 1,
	},
	fieldLabel: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	datetimeInput: {
		minHeight: 48,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.surface,
	},
	hint: {
		fontSize: 14,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	note: {
		minHeight: 88,
		maxHeight: 160,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.surface,
		textAlignVertical: 'top',
		marginBottom: spacing.md,
	},
	error: {
		color: colors.danger,
		fontSize: typography.secondary,
		marginBottom: spacing.sm,
	},
	soft: {
		color: colors.textMuted,
		fontSize: typography.secondary,
		marginBottom: spacing.sm,
	},
	deleteWrap: {
		marginTop: spacing.md,
		marginBottom: spacing.lg,
	},
	footer: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.sm,
	},
})
