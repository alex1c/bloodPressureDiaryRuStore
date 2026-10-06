import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	ScreenWithBottomBanner,
	scrollBottomInsetForBanner,
} from '@/ads/screen-with-bottom-banner'
import { localDayKeyFromIso } from '@/domain/dates/local-day'
import {
	ALL_METRIC_KINDS,
	computePeriodDelta,
	computePreviousDelta,
	dayHeadingForKey,
	formatMetricWithUnitT,
	getMetricLabel,
	getMetricUnit,
	normalizeEnabledKinds,
} from '@/domain/health/metric-catalog'
import type { HealthMetric, HealthMetricKind } from '@/domain/types'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { ProfileSelector } from '@/features/profiles/profile-selector'
import { useAdPolicy } from '@/hooks/use-ad-policy'
import { useDiary } from '@/hooks/use-diary'
import { useI18n } from '@/i18n'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/**
 * Health tab — compact list of enabled metrics with last value and deltas.
 * No BMI, charts, or medical interpretation.
 */
export function HealthScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { t } = useI18n()
	const {
		ready,
		error,
		enabledMetricKinds,
		healthMetrics,
		refreshHealth,
		setEnabledMetricKinds,
	} = useDiary()
	const { canShowAds } = useAdPolicy()

	const [pickerOpen, setPickerOpen] = useState(false)
	const [draftKinds, setDraftKinds] = useState<HealthMetricKind[]>([])
	const [savingKinds, setSavingKinds] = useState(false)

	useFocusEffect(
		useCallback(() => {
			void refreshHealth()
		}, [refreshHealth]),
	)

	function openPicker() {
		setDraftKinds([...enabledMetricKinds])
		setPickerOpen(true)
	}

	function toggleDraftKind(kind: HealthMetricKind) {
		setDraftKinds((prev) => {
			if (prev.includes(kind)) {
				return prev.filter((k) => k !== kind)
			}
			return normalizeEnabledKinds([...prev, kind])
		})
	}

	async function savePicker() {
		setSavingKinds(true)
		try {
			await setEnabledMetricKinds(normalizeEnabledKinds(draftKinds))
			setPickerOpen(false)
		} finally {
			setSavingKinds(false)
		}
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
			<View
				style={[
					styles.centered,
					{
						paddingTop: insets.top,
						paddingHorizontal: spacing.lg,
					},
				]}
			>
				<Text style={styles.errorTitle}>{t('health.openFailed')}</Text>
				<Text style={styles.errorBody}>{error}</Text>
			</View>
		)
	}

	const hasKinds = enabledMetricKinds.length > 0
	const bannerVisible = canShowAds && !pickerOpen

	return (
		<ScreenWithBottomBanner
			placement="healthBanner"
			visible={bannerVisible}
			style={{ paddingTop: insets.top + spacing.md }}
		>
			<ScrollView
				contentContainerStyle={{
					paddingBottom: scrollBottomInsetForBanner({
						bannerVisible,
					}),
				}}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Text style={styles.appTitle}>{t('health.title')}</Text>
					<ProfileSelector />
				</View>

				{!hasKinds ? (
					<View style={styles.empty}>
						<Text style={styles.emptyTitle}>{t('health.emptyTitle')}</Text>
						<Text style={styles.emptyBody}>{t('health.emptyBody')}</Text>
						<PrimaryButton
							label={t('health.chooseMetrics')}
							onPress={openPicker}
						/>
					</View>
				) : (
					<>
						{enabledMetricKinds.map((kind) => (
							<MetricSummaryCard
								key={kind}
								kind={kind}
								metrics={healthMetrics}
								onOpenHistory={() =>
									router.push(`/health/${kind}` as Href)
								}
								onAdd={() =>
									router.push(`/health/${kind}/new` as Href)
								}
							/>
						))}

						<View style={styles.ctaPad}>
							<PrimaryButton
								label={t('health.whatToTrack')}
								onPress={openPicker}
							/>
						</View>
					</>
				)}
			</ScrollView>

			<Modal
				visible={pickerOpen}
				animationType="slide"
				transparent
				onRequestClose={() => {
					if (!savingKinds) {
						setPickerOpen(false)
					}
				}}
			>
				<Pressable
					style={styles.backdrop}
					onPress={() => {
						if (!savingKinds) {
							setPickerOpen(false)
						}
					}}
				/>
				<View
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + spacing.md },
					]}
				>
					<Text style={styles.sheetTitle}>{t('health.whatToTrack')}</Text>
					<Text style={styles.sheetHint}>{t('health.pickerHint')}</Text>
					{ALL_METRIC_KINDS.map((kind) => {
						const on = draftKinds.includes(kind)
						const label = getMetricLabel(kind, t)
						return (
							<Pressable
								key={kind}
								accessibilityRole="button"
								accessibilityState={{ selected: on }}
								accessibilityLabel={label}
								onPress={() => toggleDraftKind(kind)}
								style={[styles.kindRow, on && styles.kindRowOn]}
							>
								<Text
									style={[
										styles.kindLabel,
										on && styles.kindLabelOn,
									]}
								>
									{label}
								</Text>
								<Text style={styles.kindUnit}>
									{getMetricUnit(kind, t)}
									{on ? ' ✓' : ''}
								</Text>
							</Pressable>
						)
					})}
					<View style={styles.sheetCta}>
						<PrimaryButton
							label={savingKinds ? t('common.saving') : t('common.done')}
							onPress={() => {
								void savePicker()
							}}
							disabled={savingKinds}
						/>
					</View>
				</View>
			</Modal>
		</ScreenWithBottomBanner>
	)
}

type MetricSummaryCardProps = {
	kind: HealthMetricKind
	metrics: HealthMetric[]
	onOpenHistory: () => void
	onAdd: () => void
}

function MetricSummaryCard({
	kind,
	metrics,
	onOpenHistory,
	onAdd,
}: MetricSummaryCardProps) {
	const { t, locale } = useI18n()
	const ofKind = metrics.filter((m) => m.kind === kind)
	const latest = ofKind[0] ?? null
	const unit = getMetricUnit(kind, t)
	const periodDelta = computePeriodDelta(kind, ofKind, 30, new Date(), {
		unitLabel: unit,
		periodSuffix: t('health.deltaDaysSuffix', { days: 30 }),
	})
	const previousDelta = computePreviousDelta(kind, ofKind, unit)
	const delta = periodDelta ?? previousDelta
	const label = getMetricLabel(kind, t)

	const dateLabel = latest
		? dayHeadingForKey(localDayKeyFromIso(latest.measuredAt), new Date(), {
				locale,
				todayLabel: t('common.today'),
			})
		: null

	return (
		<View style={styles.card}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${t('health.history')}`}
				onPress={onOpenHistory}
				style={({ pressed }) => [
					styles.cardMain,
					pressed && styles.cardPressed,
				]}
			>
				<Text style={styles.cardTitle}>{label}</Text>
				{latest ? (
					<>
						<Text style={styles.cardValue}>
							{formatMetricWithUnitT(kind, latest.value, t)}
						</Text>
						<Text style={styles.cardMeta}>{dateLabel}</Text>
						{delta && delta.direction !== 'same' ? (
							<Text style={styles.cardDelta}>{delta.formatted}</Text>
						) : null}
					</>
				) : (
					<Text style={styles.cardEmpty}>{t('health.noHistory')}</Text>
				)}
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${t('health.addEntry')} ${label}`}
				onPress={onAdd}
				style={({ pressed }) => [
					styles.cardAdd,
					pressed && styles.cardPressed,
				]}
			>
				<Text style={styles.cardAddText}>{t('health.addPlus')}</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
	},
	header: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	appTitle: {
		fontSize: typography.title,
		fontWeight: '700',
		color: colors.text,
	},
	empty: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
	},
	emptyTitle: {
		marginTop: spacing.md,
		fontSize: 22,
		fontWeight: '600',
		color: colors.text,
	},
	emptyBody: {
		marginTop: spacing.sm,
		marginBottom: spacing.lg,
		fontSize: typography.body,
		lineHeight: 24,
		color: colors.textMuted,
	},
	card: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		overflow: 'hidden',
	},
	cardMain: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	cardPressed: {
		opacity: 0.9,
	},
	cardTitle: {
		fontSize: typography.secondary,
		fontWeight: '700',
		color: colors.textMuted,
	},
	cardValue: {
		marginTop: spacing.xs,
		fontSize: typography.bpRow,
		fontWeight: '700',
		color: colors.text,
	},
	cardMeta: {
		marginTop: 4,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	cardDelta: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.primary,
		fontWeight: '600',
	},
	cardEmpty: {
		marginTop: spacing.xs,
		fontSize: typography.body,
		color: colors.textMuted,
	},
	cardAdd: {
		minHeight: touchTargetMin - 4,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	cardAddText: {
		fontSize: typography.secondary,
		fontWeight: '600',
		color: colors.primary,
	},
	ctaPad: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.md,
	},
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	sheet: {
		backgroundColor: colors.background,
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: spacing.md,
		paddingHorizontal: spacing.lg,
		maxHeight: '75%',
	},
	sheetTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.xs,
	},
	sheetHint: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		marginBottom: spacing.md,
		lineHeight: 22,
	},
	kindRow: {
		minHeight: touchTargetMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.sm,
		borderRadius: 12,
		marginBottom: spacing.xs,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
	},
	kindRowOn: {
		backgroundColor: colors.chipSelected,
		borderColor: colors.primary,
	},
	kindLabel: {
		fontSize: typography.body,
		color: colors.text,
	},
	kindLabelOn: {
		fontWeight: '700',
		color: colors.primary,
	},
	kindUnit: {
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	sheetCta: {
		marginTop: spacing.md,
	},
	errorTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
		textAlign: 'center',
	},
	errorBody: {
		fontSize: typography.body,
		color: colors.textMuted,
		textAlign: 'center',
	},
})
