import { useEffect, useMemo, useState } from 'react'
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
import {
	formatLocalDayKey,
	formatLocalTime,
	isoFromLocalDateAndTime,
} from '@/domain/dates/local-day'
import {
	ALL_METRIC_KINDS,
	METRIC_HINTS_RU,
	METRIC_LABELS_RU,
	METRIC_UNITS,
	formatMetricValue,
	isOutsideSoftMetricRange,
	parseMetricValue,
} from '@/domain/health/metric-catalog'
import {
	filterDecimalInputText,
	filterIntegerInputText,
} from '@/domain/input/normalize'
import type { HealthMetric, HealthMetricKind } from '@/domain/types'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

type Mode = 'create' | 'edit'

type MetricFormDraft = {
	valueText: string
	dayKey: string
	timeHm: string
	note: string
}

const SOFT_HINT = 'Проверьте введённое значение.'

function isHealthMetricKind(value: string): value is HealthMetricKind {
	return (ALL_METRIC_KINDS as readonly string[]).includes(value)
}

function buildDraftFromNow(): MetricFormDraft {
	const now = new Date()
	return {
		valueText: '',
		dayKey: formatLocalDayKey(now),
		timeHm: formatLocalTime(now.toISOString()),
		note: '',
	}
}

function buildDraftFromMetric(
	kind: HealthMetricKind,
	row: HealthMetric,
): MetricFormDraft {
	return {
		valueText: formatMetricValue(kind, row.value),
		dayKey: formatLocalDayKey(new Date(row.measuredAt)),
		timeHm: formatLocalTime(row.measuredAt),
		note: row.note ?? '',
	}
}

type MetricFormScreenProps = {
	mode: Mode
	/** Required for create; ignored for edit (kind loaded from row). */
	kind?: HealthMetricKind
}

/**
 * Shared create/edit form for a single health metric kind.
 * Soft range check requires a second confirm tap — never a medical alarm.
 */
export function MetricFormScreen({ mode, kind: kindProp }: MetricFormScreenProps) {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string; kind?: string }>()
	const { repos, profile, refreshHealth } = useDiary()

	const kindFromParams =
		typeof params.kind === 'string' && isHealthMetricKind(params.kind)
			? params.kind
			: null

	const [kind, setKind] = useState<HealthMetricKind | null>(
		kindProp ?? kindFromParams,
	)
	const [draft, setDraft] = useState<MetricFormDraft>(buildDraftFromNow)
	const [loaded, setLoaded] = useState(mode === 'create')
	const [error, setError] = useState<string | null>(null)
	const [softHint, setSoftHint] = useState<string | null>(null)
	const [softAccepted, setSoftAccepted] = useState(false)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		if (mode !== 'edit' || !repos || !params.id) {
			return
		}
		let cancelled = false
		void (async () => {
			const row = await repos.healthMetrics.getById(String(params.id))
			if (cancelled) {
				return
			}
			if (!row) {
				setError('Запись не найдена')
				setLoaded(true)
				return
			}
			setKind(row.kind)
			setDraft(buildDraftFromMetric(row.kind, row))
			setLoaded(true)
		})()
		return () => {
			cancelled = true
		}
	}, [mode, repos, params.id])

	const title = kind ? METRIC_LABELS_RU[kind] : 'Показатель'
	const isIntegerKind = kind === 'spo2'

	const canSave = useMemo(
		() => Boolean(repos && profile && kind && loaded && !saving),
		[repos, profile, kind, loaded, saving],
	)

	function patchDraft(partial: Partial<MetricFormDraft>) {
		setDraft((prev) => ({ ...prev, ...partial }))
		setError(null)
		setSoftHint(null)
		setSoftAccepted(false)
	}

	function handleValueChange(text: string) {
		const filtered = isIntegerKind
			? filterIntegerInputText(text)
			: filterDecimalInputText(text)
		patchDraft({ valueText: filtered })
	}

	async function handleSave() {
		if (!repos || !profile || !kind) {
			return
		}

		const parsed = parseMetricValue(kind, draft.valueText)
		if (!parsed.ok) {
			setError(
				parsed.code === 'EMPTY'
					? 'Укажите значение'
					: 'Проверьте значение',
			)
			return
		}

		const measuredAt = isoFromLocalDateAndTime(draft.dayKey, draft.timeHm)
		if (!measuredAt) {
			setError('Проверьте дату и время')
			return
		}

		if (isOutsideSoftMetricRange(kind, parsed.value) && !softAccepted) {
			setSoftHint(SOFT_HINT)
			setSoftAccepted(true)
			return
		}

		const noteTrimmed = draft.note.trim()
		const note = noteTrimmed.length === 0 ? null : noteTrimmed
		const unit = METRIC_UNITS[kind]

		setSaving(true)
		try {
			if (mode === 'create') {
				await repos.healthMetrics.create({
					profileId: profile.id,
					kind,
					value: parsed.value,
					unit,
					measuredAt,
					note,
				})
				analytics.trackHealthMetricCreated(kind)
			} else if (params.id) {
				await repos.healthMetrics.update(String(params.id), {
					value: parsed.value,
					unit,
					measuredAt,
					note,
					kind,
				})
			}
			await refreshHealth()
			router.back()
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Не удалось сохранить запись',
			)
		} finally {
			setSaving(false)
		}
	}

	function handleDelete() {
		if (!repos || !params.id) {
			return
		}
		Alert.alert('Удалить запись?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await repos.healthMetrics.delete(String(params.id))
						await refreshHealth()
						router.back()
					})()
				},
			},
		])
	}

	const footerPad = Math.max(insets.bottom, spacing.sm)

	if (mode === 'create' && !kind) {
		return (
			<>
				<Stack.Screen
					options={{
						headerShown: true,
						title: 'Показатель',
						headerBackTitle: 'Назад',
						headerTintColor: colors.primary,
						headerStyle: { backgroundColor: colors.background },
						headerShadowVisible: false,
					}}
				/>
				<View style={styles.centered}>
					<Text style={styles.error}>Неизвестный показатель</Text>
				</View>
			</>
		)
	}

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
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					contentContainerStyle={{
						paddingHorizontal: spacing.lg,
						paddingTop: spacing.md,
						paddingBottom: spacing.xl * 2 + 72,
					}}
				>
					{!loaded || !kind ? (
						<Text style={styles.muted}>Загрузка…</Text>
					) : (
						<>
							<Text style={styles.fieldLabel}>
								Значение ({METRIC_HINTS_RU[kind]})
							</Text>
							<TextInput
								value={draft.valueText}
								onChangeText={handleValueChange}
								keyboardType={
									isIntegerKind
										? 'number-pad'
										: 'numbers-and-punctuation'
								}
								inputMode={isIntegerKind ? 'numeric' : 'decimal'}
								autoFocus={mode === 'create'}
								selectTextOnFocus
								style={styles.valueInput}
								placeholderTextColor={colors.textMuted}
								accessibilityLabel="Значение"
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
										onChangeText={(dayKey) =>
											patchDraft({ dayKey })
										}
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
										onChangeText={(timeHm) =>
											patchDraft({ timeHm })
										}
										keyboardType="numbers-and-punctuation"
										autoCapitalize="none"
										autoCorrect={false}
										style={styles.datetimeInput}
										accessibilityLabel="Время"
									/>
								</View>
							</View>
							<Text style={styles.hint}>
								Дата и время подставляются автоматически. Можно
								изменить.
							</Text>

							<Text style={styles.fieldLabel}>Заметка</Text>
							<TextInput
								value={draft.note}
								onChangeText={(note) => patchDraft({ note })}
								multiline
								scrollEnabled
								style={styles.note}
								placeholder="Необязательно"
								placeholderTextColor={colors.textMuted}
								accessibilityLabel="Заметка"
							/>

							{error ? <Text style={styles.error}>{error}</Text> : null}
							{softHint ? (
								<Text style={styles.soft}>{softHint}</Text>
							) : null}

							{mode === 'edit' ? (
								<View style={styles.deleteWrap}>
									<PrimaryButton
										label="Удалить запись"
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
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
		paddingHorizontal: spacing.lg,
	},
	muted: {
		fontSize: typography.body,
		color: colors.textMuted,
	},
	fieldLabel: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	valueInput: {
		minHeight: touchTargetMin + 8,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: 28,
		fontWeight: '600',
		color: colors.text,
		backgroundColor: colors.surface,
		marginBottom: spacing.md,
	},
	datetimeRow: {
		flexDirection: 'row',
		gap: spacing.md,
		marginBottom: spacing.xs,
	},
	datetimeHalf: {
		flex: 1,
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
		minHeight: 72,
		maxHeight: 140,
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
