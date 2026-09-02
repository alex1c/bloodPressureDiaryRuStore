import { useCallback, useRef } from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import {
	formatIntakeTakenClock,
	formatScheduleHm,
} from '@/domain/medications/schedule'
import type { PlannedDose } from '@/domain/medications/schedule'
import { useMedications } from '@/hooks/use-medications'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/**
 * Medications tab — today's doses first, then active medication list.
 */
export function MedicationsScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const {
		medications,
		todayDoses,
		permission,
		refreshMedications,
		markTaken,
		undoTaken,
	} = useMedications()
	const permissionTracked = useRef(false)

	useFocusEffect(
		useCallback(() => {
			void refreshMedications()
			if (permission === 'denied' && !permissionTracked.current) {
				permissionTracked.current = true
				analytics.trackReminderPermissionDenied()
			}
		}, [refreshMedications, permission]),
	)

	const active = medications.filter((m) => m.isActive)
	const inactive = medications.filter((m) => !m.isActive)

	async function handleTaken(dose: PlannedDose) {
		await markTaken(dose)
		analytics.trackMedicationIntakeMarked()
	}

	function handleUndo(dose: PlannedDose) {
		if (!dose.intake) {
			return
		}
		Alert.alert('Отменить отметку о приёме?', undefined, [
			{ text: 'Нет', style: 'cancel' },
			{
				text: 'Отменить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await undoTaken(dose.intake!.id)
						analytics.trackMedicationIntakeUndone()
					})()
				},
			},
		])
	}

	return (
		<View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
			<ScrollView
				contentContainerStyle={{
					paddingBottom: insets.bottom + spacing.xl,
				}}
			>
				<View style={styles.header}>
					<Text style={styles.title}>Лекарства</Text>
					<Text style={styles.subtitle}>
						Расписание и отметки — без медицинских назначений.
					</Text>
				</View>

				{permission === 'denied' ? (
					<View style={styles.banner}>
						<Text style={styles.bannerText}>
							Системные уведомления отключены. Расписание сохранено;
							напоминания на устройстве не показываются.
						</Text>
					</View>
				) : null}

				<Text style={styles.section}>Сегодня</Text>
				{todayDoses.length === 0 ? (
					<View style={styles.emptyBlock}>
						<Text style={styles.emptyTitle}>На сегодня приёмов нет</Text>
						<Text style={styles.emptyBody}>
							Добавьте лекарство с временем приёма.
						</Text>
					</View>
				) : (
					todayDoses.map((dose) => (
						<TodayDoseCard
							key={`${dose.medicationId}-${dose.hour}-${dose.minute}`}
							dose={dose}
							onTaken={() => void handleTaken(dose)}
							onUndo={() => handleUndo(dose)}
							onOpen={() =>
								router.push(`/medication/${dose.medicationId}`)
							}
						/>
					))
				)}

				<View style={styles.ctaPad}>
					<PrimaryButton
						label="Добавить лекарство"
						onPress={() => router.push('/medication/new')}
					/>
				</View>

				<Text style={styles.section}>Мои лекарства</Text>
				{active.length === 0 ? (
					<Text style={styles.muted}>Активных лекарств пока нет.</Text>
				) : (
					active.map((med) => (
						<Pressable
							key={med.id}
							accessibilityRole="button"
							accessibilityLabel={med.name}
							onPress={() => router.push(`/medication/${med.id}`)}
							style={({ pressed }) => [
								styles.medRow,
								pressed && styles.pressed,
							]}
						>
							<Text style={styles.medName} numberOfLines={2}>
								{med.name}
							</Text>
							{med.dosageText ? (
								<Text style={styles.medDosage}>{med.dosageText}</Text>
							) : null}
							<Text style={styles.medTimes}>
								{med.schedule
									.map((t) => formatScheduleHm(t))
									.join(' · ')}
							</Text>
						</Pressable>
					))
				)}

				{inactive.length > 0 ? (
					<>
						<Text style={[styles.section, styles.inactiveSection]}>
							Неактивные
						</Text>
						{inactive.map((med) => (
							<Pressable
								key={med.id}
								onPress={() => router.push(`/medication/${med.id}`)}
								style={styles.medRowInactive}
							>
								<Text style={styles.medNameMuted}>{med.name}</Text>
							</Pressable>
						))}
					</>
				) : null}
			</ScrollView>
		</View>
	)
}

function TodayDoseCard({
	dose,
	onTaken,
	onUndo,
	onOpen,
}: {
	dose: PlannedDose
	onTaken: () => void
	onUndo: () => void
	onOpen: () => void
}) {
	const timeLabel = formatScheduleHm({
		hour: dose.hour,
		minute: dose.minute,
	})

	return (
		<View style={styles.card}>
			<Pressable onPress={onOpen} accessibilityRole="button">
				<Text style={styles.cardTime}>{timeLabel}</Text>
				<Text style={styles.cardName} numberOfLines={2}>
					{dose.medicationName}
				</Text>
				{dose.dosageText ? (
					<Text style={styles.cardDosage}>{dose.dosageText}</Text>
				) : null}
			</Pressable>

			{dose.status === 'taken' && dose.intake ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Отменить отметку о приёме"
					onPress={onUndo}
					style={styles.takenBtn}
				>
					<Text style={styles.takenText}>
						✓ Принято {formatIntakeTakenClock(dose.intake)}
					</Text>
					<Text style={styles.takenHint}>Нажмите, чтобы отменить</Text>
				</Pressable>
			) : (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Принял"
					onPress={onTaken}
					style={({ pressed }) => [
						styles.takeBtn,
						pressed && styles.takeBtnPressed,
					]}
				>
					<Text style={styles.takeBtnLabel}>Принял</Text>
				</Pressable>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	title: {
		fontSize: typography.title,
		fontWeight: '700',
		color: colors.text,
	},
	subtitle: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
		lineHeight: 22,
	},
	banner: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.chip,
	},
	bannerText: {
		fontSize: typography.secondary,
		color: colors.textMuted,
		lineHeight: 22,
	},
	section: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.md,
		marginBottom: spacing.sm,
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
	},
	inactiveSection: {
		marginTop: spacing.xl,
		color: colors.textMuted,
	},
	emptyBlock: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	emptyTitle: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.text,
	},
	emptyBody: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	ctaPad: {
		paddingHorizontal: spacing.lg,
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
	},
	card: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.md,
		padding: spacing.md,
		borderRadius: 14,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	cardTime: {
		fontSize: 26,
		fontWeight: '700',
		color: colors.text,
	},
	cardName: {
		marginTop: spacing.xs,
		fontSize: 20,
		fontWeight: '600',
		color: colors.text,
	},
	cardDosage: {
		marginTop: 2,
		fontSize: typography.body,
		color: colors.textMuted,
	},
	takeBtn: {
		marginTop: spacing.md,
		minHeight: touchTargetMin + 8,
		borderRadius: 12,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.md,
	},
	takeBtnPressed: {
		backgroundColor: colors.primaryPressed,
	},
	takeBtnLabel: {
		fontSize: 18,
		fontWeight: '700',
		color: '#FFFFFF',
	},
	takenBtn: {
		marginTop: spacing.md,
		minHeight: touchTargetMin,
		justifyContent: 'center',
	},
	takenText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	takenHint: {
		marginTop: 2,
		fontSize: 13,
		color: colors.textMuted,
	},
	medRow: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	medRowInactive: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
	},
	pressed: {
		opacity: 0.85,
	},
	medName: {
		fontSize: 18,
		fontWeight: '600',
		color: colors.text,
	},
	medNameMuted: {
		fontSize: typography.body,
		color: colors.textMuted,
	},
	medDosage: {
		marginTop: 2,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
	medTimes: {
		marginTop: spacing.xs,
		fontSize: typography.secondary,
		color: colors.primary,
		fontWeight: '600',
	},
	muted: {
		paddingHorizontal: spacing.lg,
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
})
