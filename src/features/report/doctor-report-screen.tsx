import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { Stack, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import { getActiveStoreId } from '@/config/active-store'
import { formatLocalDayKey } from '@/domain/dates/local-day'
import {
	DEFAULT_REPORT_PERIOD_DAYS,
	buildDoctorReportData,
	type DoctorReportData,
	type ReportPeriodPreset,
	type ReportPeriodSelection,
} from '@/domain/report/build-doctor-report'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { useI18n } from '@/i18n'
import {
	generateDoctorPdf,
	shareDoctorPdf,
	type GeneratedDoctorPdf,
} from '@/services/doctor-report-pdf'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/**
 * Doctor report setup: period + preview + PDF generate/share for active profile.
 */
export function DoctorReportScreen() {
	const insets = useSafeAreaInsets()
	const { t, locale } = useI18n()
	const { ready, error, repos, profile, refreshAll } = useDiary()

	const [presetDays, setPresetDays] = useState<ReportPeriodPreset | 'custom'>(
		DEFAULT_REPORT_PERIOD_DAYS,
	)
	const [customFrom, setCustomFrom] = useState(() => {
		const d = new Date()
		d.setDate(d.getDate() - 13)
		return formatLocalDayKey(d)
	})
	const [customTo, setCustomTo] = useState(() => formatLocalDayKey(new Date()))
	const [preview, setPreview] = useState<DoctorReportData | null>(null)
	const [previewLoading, setPreviewLoading] = useState(false)
	const [generating, setGenerating] = useState(false)
	const [sharing, setSharing] = useState(false)
	const [pdf, setPdf] = useState<GeneratedDoctorPdf | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)

	const presets = useMemo(
		() =>
			[
				{ days: 7 as const, label: t('report.period.7') },
				{ days: 14 as const, label: t('report.period.14') },
				{ days: 30 as const, label: t('report.period.30') },
				{ days: 90 as const, label: t('report.period.90') },
			] as const,
		[t],
	)

	const selection: ReportPeriodSelection = useMemo(() => {
		if (presetDays === 'custom') {
			return {
				kind: 'custom',
				fromDayKey: customFrom,
				toDayKey: customTo,
			}
		}
		return { kind: 'preset', days: presetDays }
	}, [presetDays, customFrom, customTo])

	const loadPreview = useCallback(async () => {
		if (!repos || !profile) {
			return
		}
		setPreviewLoading(true)
		setActionError(null)
		setPdf(null)
		try {
			const data = await buildDoctorReportData({
				repos,
				profileId: profile.id,
				selection,
				locale,
			})
			setPreview(data)
		} catch (err) {
			setPreview(null)
			setActionError(
				err instanceof Error
					? err.message
					: t('report.prepareFailed'),
			)
		} finally {
			setPreviewLoading(false)
		}
	}, [repos, profile, selection, locale, t])

	useFocusEffect(
		useCallback(() => {
			void refreshAll()
			void loadPreview()
			analytics.trackDoctorReportOpened()
		}, [refreshAll, loadPreview]),
	)

	async function handleGenerate() {
		if (!repos || !profile || !preview) {
			return
		}
		if (!preview.hasAnyData) {
			return
		}
		setGenerating(true)
		setActionError(null)
		// Freeze profileId at generate time — do not read live React state mid-flight.
		const frozenProfileId = preview.profileId
		try {
			const snapshot = await buildDoctorReportData({
				repos,
				profileId: frozenProfileId,
				selection,
				locale,
			})
			if (!snapshot.hasAnyData) {
				setActionError(t('report.previewEmpty'))
				setPdf(null)
				return
			}
			const generated = await generateDoctorPdf(snapshot, {
				locale,
				storeId: getActiveStoreId(),
			})
			setPdf(generated)
			setPreview(snapshot)
			analytics.trackDoctorReportPdfCreated({
				reportPeriod: snapshot.periodLabel,
				hasMeasurements: snapshot.measurements.length > 0,
			})
		} catch (err) {
			if (__DEV__) {
				console.warn('Doctor PDF generation failed', err)
			}
			setActionError(t('report.createFailed'))
			setPdf(null)
		} finally {
			setGenerating(false)
		}
	}

	async function handleShare() {
		if (!pdf) {
			return
		}
		setSharing(true)
		setActionError(null)
		try {
			await shareDoctorPdf(pdf)
			if (preview) {
				analytics.trackDoctorReportShared({
					reportPeriod: preview.periodLabel,
					hasMeasurements: preview.measurements.length > 0,
				})
			}
		} catch (err) {
			if (__DEV__) {
				console.warn('Doctor PDF share failed', err)
			}
			Alert.alert(
				t('report.shareFailedTitle'),
				t('report.shareFailedBody'),
			)
		} finally {
			setSharing(false)
		}
	}

	if (!ready) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top }]}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		)
	}

	if (error || !profile) {
		return (
			<View style={[styles.centered, { paddingHorizontal: spacing.lg }]}>
				<Text style={styles.errorText}>
					{error ?? t('report.noProfile')}
				</Text>
			</View>
		)
	}

	const canGenerate = Boolean(preview?.hasAnyData) && !generating && !previewLoading

	return (
		<>
			<Stack.Screen
				options={{
					headerShown: true,
					title: t('report.title'),
					headerBackTitle: t('common.back'),
					headerTintColor: colors.primary,
					headerStyle: { backgroundColor: colors.background },
					headerShadowVisible: false,
				}}
			/>
			<ScrollView
				style={styles.root}
				contentContainerStyle={{
					paddingHorizontal: spacing.lg,
					paddingBottom: insets.bottom + spacing.xl,
					paddingTop: spacing.md,
				}}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.profileLine}>
					{t('report.profileLine', { name: profile.name })}
				</Text>

				<Text style={styles.sectionLabel}>{t('report.period')}</Text>
				<View style={styles.chips}>
					{presets.map((p) => {
						const selected = presetDays === p.days
						return (
							<Pressable
								key={p.days}
								accessibilityRole="button"
								accessibilityState={{ selected }}
								onPress={() => setPresetDays(p.days)}
								style={[
									styles.chip,
									selected && styles.chipSelected,
								]}
							>
								<Text
									style={[
										styles.chipText,
										selected && styles.chipTextSelected,
									]}
								>
									{p.label}
								</Text>
							</Pressable>
						)
					})}
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected: presetDays === 'custom' }}
						onPress={() => setPresetDays('custom')}
						style={[
							styles.chip,
							presetDays === 'custom' && styles.chipSelected,
						]}
					>
						<Text
							style={[
								styles.chipText,
								presetDays === 'custom' && styles.chipTextSelected,
							]}
						>
							{t('report.customPeriod')}
						</Text>
					</Pressable>
				</View>

				{presetDays === 'custom' ? (
					<View style={styles.customRow}>
						<View style={styles.customHalf}>
							<Text style={styles.fieldLabel}>{t('report.from')}</Text>
							<TextInput
								value={customFrom}
								onChangeText={setCustomFrom}
								autoCapitalize="none"
								autoCorrect={false}
								placeholder={t('report.datePlaceholder')}
								placeholderTextColor={colors.textMuted}
								style={styles.dateInput}
								accessibilityLabel={t('report.fromA11y')}
							/>
						</View>
						<View style={styles.customHalf}>
							<Text style={styles.fieldLabel}>{t('report.to')}</Text>
							<TextInput
								value={customTo}
								onChangeText={setCustomTo}
								autoCapitalize="none"
								autoCorrect={false}
								placeholder={t('report.datePlaceholder')}
								placeholderTextColor={colors.textMuted}
								style={styles.dateInput}
								accessibilityLabel={t('report.toA11y')}
							/>
						</View>
					</View>
				) : null}

				<Pressable
					onPress={() => void loadPreview()}
					style={styles.refreshPreview}
					accessibilityRole="button"
				>
					<Text style={styles.refreshPreviewText}>
						{t('report.refreshPreview')}
					</Text>
				</Pressable>

				<Text style={styles.sectionLabel}>{t('report.summary')}</Text>
				{previewLoading ? (
					<ActivityIndicator color={colors.primary} />
				) : preview ? (
					<View style={styles.previewCard}>
						<Text style={styles.previewTitle}>
							{t('report.forPeriod', { period: preview.periodLabel })}
						</Text>
						{preview.bp.count === 0 ? (
							<Text style={styles.previewMuted}>
								{t('report.pdf.noBp')}
							</Text>
						) : (
							<>
								<Text style={styles.previewLine}>
									{t('report.bpCount', { count: preview.bp.count })}
								</Text>
								<Text style={styles.previewStrong}>
									{t('report.avgBpLine', {
										sys: preview.bp.avgSystolic ?? '—',
										dia: preview.bp.avgDiastolic ?? '—',
									})}
								</Text>
								<Text style={styles.previewLine}>
									{t('report.avgPulseLine', {
										pulse: preview.bp.avgPulse ?? '—',
									})}
								</Text>
								{preview.bp.morning ? (
									<Text style={styles.previewLine}>
										{t('graphs.stats.morning')}:{' '}
										{String(preview.bp.morning.avgSystolic ?? '—')} /{' '}
										{String(preview.bp.morning.avgDiastolic ?? '—')}
									</Text>
								) : null}
								{preview.bp.evening ? (
									<Text style={styles.previewLine}>
										{t('graphs.stats.evening')}:{' '}
										{String(preview.bp.evening.avgSystolic ?? '—')} /{' '}
										{String(preview.bp.evening.avgDiastolic ?? '—')}
									</Text>
								) : null}
							</>
						)}
						{preview.medications.length > 0 ? (
							<Text style={styles.previewMeta}>
								{t('report.medsCount', {
									count: preview.medications.length,
								})}
							</Text>
						) : null}
						{preview.health.length > 0 ? (
							<Text style={styles.previewMeta}>
								{t('report.healthCount', {
									count: preview.health.length,
								})}
							</Text>
						) : null}
						{!preview.hasAnyData ? (
							<Text style={styles.previewMuted}>
								{t('report.noPdfData')}
							</Text>
						) : null}
					</View>
				) : (
					<Text style={styles.previewMuted}>
						{t('report.summaryUnavailable')}
					</Text>
				)}

				{actionError ? (
					<Text style={styles.errorText}>{actionError}</Text>
				) : null}

				<View style={styles.actions}>
					<PrimaryButton
						label={
							generating ? t('report.creating') : t('report.createPdf')
						}
						onPress={() => {
							void handleGenerate()
						}}
						disabled={!canGenerate}
					/>
					{pdf ? (
						<View style={styles.sharePad}>
							<Text style={styles.pdfReady}>
								{t('report.pdfReady', { name: pdf.fileName })}
							</Text>
							<PrimaryButton
								label={
									sharing ? t('report.sharing') : t('report.share')
								}
								onPress={() => {
									void handleShare()
								}}
								disabled={sharing}
							/>
						</View>
					) : null}
				</View>
			</ScrollView>
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
	},
	profileLine: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
		marginBottom: spacing.md,
	},
	sectionLabel: {
		fontSize: typography.secondary,
		fontWeight: '700',
		color: colors.textMuted,
		marginBottom: spacing.sm,
		marginTop: spacing.sm,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	chip: {
		minHeight: touchTargetMin - 8,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	chipSelected: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipText: {
		fontSize: typography.secondary,
		fontWeight: '600',
		color: colors.text,
	},
	chipTextSelected: {
		color: '#fff',
	},
	customRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	customHalf: {
		flex: 1,
	},
	fieldLabel: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.xs,
	},
	dateInput: {
		minHeight: touchTargetMin,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.surface,
	},
	refreshPreview: {
		marginTop: spacing.md,
		marginBottom: spacing.sm,
		alignSelf: 'flex-start',
	},
	refreshPreviewText: {
		color: colors.primary,
		fontWeight: '600',
		fontSize: typography.secondary,
	},
	previewCard: {
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	previewTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	previewStrong: {
		fontSize: typography.body,
		fontWeight: '700',
		color: colors.text,
		marginTop: spacing.xs,
	},
	previewLine: {
		fontSize: typography.body,
		color: colors.text,
		marginTop: 4,
	},
	previewMeta: {
		marginTop: spacing.sm,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	previewMuted: {
		fontSize: typography.body,
		color: colors.textMuted,
		marginTop: spacing.xs,
	},
	actions: {
		marginTop: spacing.lg,
	},
	sharePad: {
		marginTop: spacing.md,
	},
	pdfReady: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.sm,
	},
	errorText: {
		marginTop: spacing.md,
		fontSize: typography.body,
		color: colors.danger,
	},
})
