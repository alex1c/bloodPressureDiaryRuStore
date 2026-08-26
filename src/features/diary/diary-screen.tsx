import { useCallback } from 'react'
import {
	ActivityIndicator,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatRussianLongDate } from '@/domain/dates/local-day'
import { useDiary } from '@/hooks/use-diary'
import { colors, spacing, typography } from '@/theme'
import {
	LatestMeasurement,
	MeasurementRow,
} from './components/measurement-list'
import { PrimaryButton } from './components/form-controls'

/**
 * Main diary screen — opens on today's measurements with a clear CTA.
 */
export function DiaryScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { ready, error, todayMeasurements, refreshToday } = useDiary()

	useFocusEffect(
		useCallback(() => {
			void refreshToday()
		}, [refreshToday]),
	)

	const latest = todayMeasurements[0] ?? null
	const todayLabel = formatRussianLongDate(new Date())

	function handleAdd() {
		router.push('/measurement/new')
	}

	function handleOpen(id: string) {
		router.push(`/measurement/${id}`)
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
			<View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
				<Text style={styles.errorTitle}>Не удалось открыть дневник</Text>
				<Text style={styles.errorBody}>{error}</Text>
			</View>
		)
	}

	return (
		<View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
			<ScrollView
				contentContainerStyle={{
					paddingBottom: insets.bottom + spacing.xl,
				}}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Text style={styles.appTitle}>Давление</Text>
					<Text style={styles.dateLine}>Сегодня, {todayLabel}</Text>
				</View>

				{latest ? (
					<>
						<LatestMeasurement
							measurement={latest}
							onPress={() => handleOpen(latest.id)}
						/>
						<View style={styles.ctaPad}>
							<PrimaryButton
								label="Добавить измерение"
								onPress={handleAdd}
							/>
						</View>
						<Text style={styles.sectionTitle}>Сегодня</Text>
						{todayMeasurements.map((item) => (
							<MeasurementRow
								key={item.id}
								measurement={item}
								onPress={() => handleOpen(item.id)}
							/>
						))}
					</>
				) : (
					<View style={styles.empty}>
						<Text style={styles.sectionTitle}>Сегодня</Text>
						<Text style={styles.emptyTitle}>Измерений пока нет</Text>
						<Text style={styles.emptyBody}>
							Добавьте первое измерение давления.
						</Text>
						<PrimaryButton
							label="Добавить измерение"
							onPress={handleAdd}
						/>
					</View>
				)}
			</ScrollView>
		</View>
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
	header: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.sm,
	},
	appTitle: {
		fontSize: typography.title,
		fontWeight: '700',
		color: colors.text,
	},
	dateLine: {
		marginTop: spacing.xs,
		fontSize: typography.body,
		color: colors.textMuted,
	},
	ctaPad: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.lg,
	},
	sectionTitle: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		fontSize: typography.section,
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
