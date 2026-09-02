import { useCallback, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { Stack } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import { appConfig } from '@/config/app-config'
import { buildSupportMailtoUrl, releaseConfig } from '@/config/release'
import {
	buildBackupPreviewSummary,
	collectPlatformNotificationIds,
	mapValidationMessage,
	restoreDiaryBackup,
} from '@/domain/backup/restore-diary-backup'
import { validateDiaryBackup } from '@/domain/backup/validate-backup'
import { formatRussianLongDate } from '@/domain/dates/local-day'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { useMedications } from '@/hooks/use-medications'
import {
	exportDiaryBackupFile,
	readBackupJsonFromUri,
	shareBackupFile,
} from '@/services/backup-file'
import { reconcileAllProfileNotifications } from '@/services/reconcile-medication-reminders'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/**
 * Compact settings screen: backup export/share and restore with preview.
 */
export function SettingsScreen() {
	const insets = useSafeAreaInsets()
	const { ready, error, repos, reloadAfterRestore } = useDiary()
	const { refreshMedications } = useMedications()

	const [exporting, setExporting] = useState(false)
	const [picking, setPicking] = useState(false)
	const [restoring, setRestoring] = useState(false)
	const [actionError, setActionError] = useState<string | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)
	const [pendingRestoreRaw, setPendingRestoreRaw] = useState<unknown | null>(
		null,
	)

	const preview =
		pendingRestoreRaw !== null
			? validateDiaryBackup(pendingRestoreRaw)
			: null
	const previewSummary =
		preview?.ok === true
			? buildBackupPreviewSummary(preview.backup)
			: null

	const clearMessages = useCallback(() => {
		setActionError(null)
		setSuccessMessage(null)
	}, [])

	async function handleExportBackup() {
		if (!repos) {
			return
		}
		clearMessages()
		setExporting(true)
		try {
			const file = await exportDiaryBackupFile(repos)
			await shareBackupFile(file)
			analytics.trackBackupCreated()
		} catch (err) {
			if (__DEV__) {
				console.warn('Backup export failed', err)
			}
			setActionError('Не удалось создать резервную копию.')
		} finally {
			setExporting(false)
		}
	}

	async function handlePickRestoreFile() {
		clearMessages()
		setPendingRestoreRaw(null)
		setPicking(true)
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: 'application/json',
				copyToCacheDirectory: true,
				multiple: false,
			})
			if (result.canceled || !result.assets[0]) {
				return
			}
			const asset = result.assets[0]
			const raw = await readBackupJsonFromUri(asset.uri)
			setPendingRestoreRaw(raw)
		} catch (err) {
			if (__DEV__) {
				console.warn('Backup pick failed', err)
			}
			setActionError('Не удалось прочитать файл.')
		} finally {
			setPicking(false)
		}
	}

	function handleCancelPreview() {
		setPendingRestoreRaw(null)
		clearMessages()
	}

	async function handleOpenPrivacyPolicy() {
		try {
			await Linking.openURL(releaseConfig.privacyPolicyUrl)
		} catch (err) {
			if (__DEV__) {
				console.warn('Privacy link failed', err)
			}
			setActionError('Не удалось открыть политику конфиденциальности.')
		}
	}

	async function handleContactDeveloper() {
		try {
			await Linking.openURL(
				buildSupportMailtoUrl(`${appConfig.displayName} — обратная связь`),
			)
		} catch (err) {
			if (__DEV__) {
				console.warn('Mailto failed', err)
			}
			setActionError('Не удалось открыть почтовое приложение.')
		}
	}

	function handleConfirmRestore() {
		if (!repos || !preview?.ok) {
			return
		}
		Alert.alert(
			'Восстановить резервную копию?',
			'Текущие записи будут заменены. Это действие нельзя отменить.',
			[
				{ text: 'Отмена', style: 'cancel' },
				{
					text: 'Восстановить',
					style: 'destructive',
					onPress: () => {
						void performRestore(pendingRestoreRaw)
					},
				},
			],
		)
	}

	async function performRestore(raw: unknown) {
		if (!repos) {
			return
		}
		setRestoring(true)
		clearMessages()
		analytics.trackBackupRestoreStarted()
		try {
			const oldPlatformIds = await collectPlatformNotificationIds(repos)
			const result = await restoreDiaryBackup(repos, raw)
			if (!result.ok) {
				analytics.trackBackupRestoreFailed()
				setActionError(result.message)
				return
			}
			await reconcileAllProfileNotifications({
				repos,
				extraPlatformIdsToCancel: oldPlatformIds,
			})
			await reloadAfterRestore()
			await refreshMedications()
			setPendingRestoreRaw(null)
			setSuccessMessage('Данные восстановлены')
			analytics.trackBackupRestoreSuccess()
		} catch (err) {
			analytics.trackBackupRestoreFailed()
			if (__DEV__) {
				console.warn('Restore failed', err)
			}
			setActionError('Не удалось восстановить данные. Попробуйте снова.')
		} finally {
			setRestoring(false)
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
					title: 'Настройки',
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
			>
				<Text style={styles.sectionTitle}>Данные</Text>

				<PrimaryButton
					label={
						exporting ? 'Создание…' : 'Создать резервную копию'
					}
					onPress={() => void handleExportBackup()}
					disabled={exporting || restoring}
				/>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Восстановить данные"
					onPress={() => void handlePickRestoreFile()}
					disabled={exporting || picking || restoring}
					style={({ pressed }) => [
						styles.outlineButton,
						pressed && styles.pressed,
						(exporting || picking || restoring) && styles.disabled,
					]}
				>
					<Text style={styles.outlineButtonText}>
						{picking ? 'Выбор файла…' : 'Восстановить данные'}
					</Text>
				</Pressable>

				{preview && !preview.ok ? (
					<Text style={styles.errorText}>
						{mapValidationMessage(preview.message)}
					</Text>
				) : null}

				{previewSummary ? (
					<View style={styles.previewCard}>
						<Text style={styles.previewTitle}>Резервная копия</Text>
						<PreviewRow
							label="Создана"
							value={formatPreviewDate(previewSummary.createdAt)}
						/>
						<PreviewRow
							label="Версия приложения"
							value={previewSummary.appVersion}
						/>
						<PreviewRow
							label="Профили"
							value={String(previewSummary.profileCount)}
						/>
						<PreviewRow
							label="Измерения давления"
							value={String(previewSummary.measurementCount)}
						/>
						<PreviewRow
							label="Лекарства"
							value={String(previewSummary.medicationCount)}
						/>
						<PreviewRow
							label="Записи приёма"
							value={String(previewSummary.intakeCount)}
						/>
						<PreviewRow
							label="Показатели здоровья"
							value={String(previewSummary.healthMetricCount)}
						/>
						<Text style={styles.warning}>
							Текущие данные приложения будут заменены данными из
							резервной копии.
						</Text>
						<View style={styles.previewActions}>
							<Pressable
								accessibilityRole="button"
								onPress={handleCancelPreview}
								style={({ pressed }) => [
									styles.secondaryBtn,
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.secondaryBtnText}>Отмена</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								onPress={handleConfirmRestore}
								disabled={restoring}
								style={({ pressed }) => [
									styles.destructiveBtn,
									pressed && styles.pressed,
									restoring && styles.disabled,
								]}
							>
								<Text style={styles.destructiveBtnText}>
									{restoring ? 'Восстановление…' : 'Восстановить'}
								</Text>
							</Pressable>
						</View>
					</View>
				) : null}

				{actionError ? (
					<Text style={styles.errorText}>{actionError}</Text>
				) : null}
				{successMessage ? (
					<Text style={styles.successText}>{successMessage}</Text>
				) : null}

				<Text style={[styles.sectionTitle, styles.sectionSpaced]}>
					О приложении
				</Text>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Политика конфиденциальности"
					onPress={() => void handleOpenPrivacyPolicy()}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>Политика конфиденциальности</Text>
				</Pressable>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Связаться с разработчиком"
					onPress={() => void handleContactDeveloper()}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>Связаться с разработчиком</Text>
				</Pressable>

				<View style={styles.versionBlock}>
					<Text style={styles.versionLabel}>
						Версия {appConfig.versionName}
					</Text>
				</View>
			</ScrollView>
		</>
	)
}

function PreviewRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.previewRow}>
			<Text style={styles.previewLabel}>{label}</Text>
			<Text style={styles.previewValue}>{value}</Text>
		</View>
	)
}

function formatPreviewDate(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) {
		return iso
	}
	const date = formatRussianLongDate(d)
	const h = String(d.getHours()).padStart(2, '0')
	const m = String(d.getMinutes()).padStart(2, '0')
	return `${date}, ${h}:${m}`
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
		marginBottom: spacing.md,
	},
	sectionSpaced: {
		marginTop: spacing.xl,
	},
	linkRow: {
		minHeight: touchTargetMin,
		justifyContent: 'center',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	linkRowText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	gap: {
		height: spacing.sm,
	},
	outlineButton: {
		minHeight: touchTargetMin,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		marginTop: spacing.sm,
	},
	outlineButtonText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	previewCard: {
		marginTop: spacing.lg,
		padding: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
	},
	previewTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	previewRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: spacing.xs,
		gap: spacing.sm,
	},
	previewLabel: {
		fontSize: typography.body,
		color: colors.textMuted,
		flex: 1,
	},
	previewValue: {
		fontSize: typography.body,
		color: colors.text,
		fontWeight: '600',
		textAlign: 'right',
	},
	warning: {
		fontSize: typography.body,
		color: colors.textMuted,
		marginTop: spacing.md,
	},
	previewActions: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.md,
	},
	secondaryBtn: {
		flex: 1,
		minHeight: touchTargetMin,
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
	destructiveBtn: {
		flex: 1,
		minHeight: touchTargetMin,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		backgroundColor: colors.danger,
	},
	destructiveBtnText: {
		fontSize: typography.body,
		color: '#FFFFFF',
		fontWeight: '600',
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
		marginTop: spacing.md,
	},
	successText: {
		fontSize: typography.body,
		color: colors.primary,
		marginTop: spacing.md,
		fontWeight: '600',
	},
	versionBlock: {
		marginTop: spacing.xl,
		paddingTop: spacing.lg,
		borderTopWidth: 1,
		borderTopColor: colors.border,
	},
	versionLabel: {
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
})
