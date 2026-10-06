import { useCallback, useMemo } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import {
	Stack,
	useFocusEffect,
	useLocalSearchParams,
	useRouter,
	type Href,
} from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatLocalTime } from '@/domain/dates/local-day'
import {
	ALL_METRIC_KINDS,
	dayHeadingForKey,
	formatMetricWithUnitT,
	getMetricLabel,
	groupMetricsByLocalDay,
} from '@/domain/health/metric-catalog'
import type { HealthMetricKind } from '@/domain/types'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { useI18n } from '@/i18n'
import { colors, spacing, typography } from '@/theme'

function isHealthMetricKind(value: string): value is HealthMetricKind {
	return (ALL_METRIC_KINDS as readonly string[]).includes(value)
}

/**
 * History list for one metric kind, grouped by local calendar day.
 * Charts intentionally omitted in V1 — keep the list scannable.
 */
export function MetricHistoryScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const params = useLocalSearchParams<{ kind?: string }>()
	const { ready, healthMetrics, refreshHealth } = useDiary()
	const { t, locale } = useI18n()

	const kind =
		typeof params.kind === 'string' && isHealthMetricKind(params.kind)
			? params.kind
			: null

	useFocusEffect(
		useCallback(() => {
			void refreshHealth()
		}, [refreshHealth]),
	)

	const groups = useMemo(() => {
		if (!kind) {
			return []
		}
		const ofKind = healthMetrics.filter((m) => m.kind === kind)
		return groupMetricsByLocalDay(ofKind)
	}, [healthMetrics, kind])

	const title = kind ? getMetricLabel(kind, t) : t('health.metric.generic')

	if (!kind) {
		return (
			<>
				<Stack.Screen
					options={{
						headerShown: true,
						title: t('health.metric.generic'),
						headerBackTitle: t('common.back'),
						headerTintColor: colors.primary,
						headerStyle: { backgroundColor: colors.background },
						headerShadowVisible: false,
					}}
				/>
				<View style={styles.centered}>
					<Text style={styles.muted}>{t('health.metric.unknown')}</Text>
				</View>
			</>
		)
	}

	if (!ready) {
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
				<View style={styles.centered}>
					<ActivityIndicator color={colors.primary} size="large" />
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
					headerBackTitle: t('common.back'),
					headerTintColor: colors.primary,
					headerStyle: { backgroundColor: colors.background },
					headerShadowVisible: false,
				}}
			/>
			<View style={styles.root}>
				<ScrollView
					contentContainerStyle={{
						paddingBottom: insets.bottom + spacing.xl,
						paddingTop: spacing.md,
					}}
				>
					<View style={styles.ctaPad}>
						<PrimaryButton
							label={t('health.addEntry')}
							onPress={() =>
								router.push(`/health/${kind}/new` as Href)
							}
						/>
					</View>

					{groups.length === 0 ? (
						<View style={styles.empty}>
							<Text style={styles.emptyTitle}>{t('health.noHistory')}</Text>
							<Text style={styles.emptyBody}>
								{t('health.emptyHistoryBody')}
							</Text>
						</View>
					) : (
						groups.map((group) => (
							<View key={group.dayKey}>
								<Text style={styles.dayHeading}>
									{dayHeadingForKey(group.dayKey, new Date(), {
										locale,
										todayLabel: t('common.today'),
									})}
								</Text>
								{group.items.map((item) => (
									<Pressable
										key={item.id}
										accessibilityRole="button"
										accessibilityLabel={`${formatMetricWithUnitT(kind, item.value, t)}, ${formatLocalTime(item.measuredAt)}`}
										onPress={() =>
											router.push(
												`/health/entry/${item.id}` as Href,
											)
										}
										style={({ pressed }) => [
											styles.row,
											pressed && styles.rowPressed,
										]}
									>
										<Text style={styles.rowTime}>
											{formatLocalTime(item.measuredAt)}
										</Text>
										<View style={styles.rowBody}>
											<Text style={styles.rowValue}>
												{formatMetricWithUnitT(kind, item.value, t)}
											</Text>
											{item.note ? (
												<Text
													style={styles.rowNote}
													numberOfLines={2}
												>
													{item.note}
												</Text>
											) : null}
										</View>
									</Pressable>
								))}
							</View>
						))
					)}
				</ScrollView>
			</View>
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
	ctaPad: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	empty: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.lg,
	},
	emptyTitle: {
		fontSize: 22,
		fontWeight: '600',
		color: colors.text,
	},
	emptyBody: {
		marginTop: spacing.sm,
		fontSize: typography.body,
		color: colors.textMuted,
		lineHeight: 24,
	},
	dayHeading: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.md,
		marginBottom: spacing.xs,
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
	},
	row: {
		flexDirection: 'row',
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.lg,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		gap: spacing.md,
		alignItems: 'flex-start',
	},
	rowPressed: {
		opacity: 0.85,
	},
	rowTime: {
		width: 56,
		fontSize: typography.body,
		color: colors.textMuted,
		paddingTop: 2,
	},
	rowBody: {
		flex: 1,
	},
	rowValue: {
		fontSize: typography.bpRow,
		fontWeight: '700',
		color: colors.text,
	},
	rowNote: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	muted: {
		fontSize: typography.body,
		color: colors.textMuted,
	},
})
