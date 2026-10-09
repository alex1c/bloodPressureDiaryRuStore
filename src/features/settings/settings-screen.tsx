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
import { Stack, useRouter, type Href } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import { appConfig } from '@/config/app-config'
import { REMINDERS_ROUTE } from '@/config/routes'
import { buildSupportMailtoUrl, releaseConfig } from '@/config/release'
import {
	buildBackupPreviewSummary,
	collectPlatformNotificationIds,
	mapValidationMessage,
	restoreDiaryBackup,
} from '@/domain/backup/restore-diary-backup'
import { validateDiaryBackup } from '@/domain/backup/validate-backup'
import { PrimaryButton } from '@/features/diary/components/form-controls'
import { useDiary } from '@/hooks/use-diary'
import { useMedications } from '@/hooks/use-medications'
import {
	formatDateTime,
	LOCALE_PREFERENCES,
	useI18n,
	type LocalePreference,
} from '@/i18n'
import {
	exportDiaryBackupFile,
	readBackupJsonFromUri,
	shareBackupFile,
} from '@/services/backup-file'
import { reconcileAllProfileNotifications } from '@/services/reconcile-medication-reminders'
import { PrivacyConsentModal } from '@/privacy'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

/**
 * Compact settings screen: language, backup export/share and restore with preview.
 */
export function SettingsScreen() {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { ready, error, repos, reloadAfterRestore } = useDiary()
	const { refreshMedications } = useMedications()
	const {
		t,
		locale,
		preference,
		setLocalePreference,
		reloadLocaleFromSettings,
	} = useI18n()

	const [exporting, setExporting] = useState(false)
	const [picking, setPicking] = useState(false)
	const [restoring, setRestoring] = useState(false)
	const [actionError, setActionError] = useState<string | null>(null)
	const [successMessage, setSuccessMessage] = useState<string | null>(null)
	const [pendingRestoreRaw, setPendingRestoreRaw] = useState<unknown | null>(
		null,
	)
	const [privacyChoicesOpen, setPrivacyChoicesOpen] = useState(false)

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
			setActionError(t('settings.exportFailed'))
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
			setActionError(t('settings.readFailed'))
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
			setActionError(t('settings.privacyFailed'))
		}
	}

	async function handleContactDeveloper() {
		try {
			await Linking.openURL(
				buildSupportMailtoUrl(
					t('settings.contactSubject', { app: appConfig.displayName }),
				),
			)
		} catch (err) {
			if (__DEV__) {
				console.warn('Mailto failed', err)
			}
			setActionError(t('settings.mailFailed'))
		}
	}

	function handleConfirmRestore() {
		if (!repos || !preview?.ok) {
			return
		}
		Alert.alert(
			t('settings.restoreConfirmTitle'),
			t('settings.restoreConfirmBody'),
			[
				{ text: t('common.cancel'), style: 'cancel' },
				{
					text: t('settings.restoreAction'),
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
			// Apply restored locale immediately (repos identity does not change).
			await reloadLocaleFromSettings()
			await refreshMedications()
			setPendingRestoreRaw(null)
			setSuccessMessage(t('settings.restoreSuccess'))
			analytics.trackBackupRestoreSuccess()
		} catch (err) {
			analytics.trackBackupRestoreFailed()
			if (__DEV__) {
				console.warn('Restore failed', err)
			}
			setActionError(t('settings.restoreFailed'))
		} finally {
			setRestoring(false)
		}
	}

	async function handleLocaleSelect(next: LocalePreference) {
		if (next === preference) {
			return
		}
		await setLocalePreference(next)
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
					title: t('settings.title'),
					headerBackTitle: t('common.back'),
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
				<Text style={styles.sectionTitle}>{t('settings.language')}</Text>
				{LOCALE_PREFERENCES.map((pref) => {
					const selected = preference === pref
					const labelKey =
						pref === 'system'
							? 'settings.language.system'
							: (`settings.language.${pref}` as const)
					return (
						<Pressable
							key={pref}
							accessibilityRole="radio"
							accessibilityState={{ selected }}
							accessibilityLabel={t(labelKey)}
							onPress={() => {
								void handleLocaleSelect(pref)
							}}
							style={({ pressed }) => [
								styles.langRow,
								selected && styles.langRowSelected,
								pressed && styles.pressed,
							]}
						>
							<Text
								style={[
									styles.langRowText,
									selected && styles.langRowTextSelected,
								]}
							>
								{t(labelKey)}
							</Text>
							{selected ? (
								<Text style={styles.langCheck}>✓</Text>
							) : null}
						</Pressable>
					)
				})}

				<Text style={[styles.sectionTitle, styles.sectionSpaced]}>
					{t('settings.reminders')}
				</Text>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t('settings.reminders')}
					onPress={() => router.push(REMINDERS_ROUTE as Href)}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>{t('settings.reminders')}</Text>
				</Pressable>

				<Text style={[styles.sectionTitle, styles.sectionSpaced]}>
					{t('settings.data')}
				</Text>

				<PrimaryButton
					label={
						exporting ? t('settings.exporting') : t('settings.exportBackup')
					}
					onPress={() => void handleExportBackup()}
					disabled={exporting || restoring}
				/>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t('settings.restore')}
					onPress={() => void handlePickRestoreFile()}
					disabled={exporting || picking || restoring}
					style={({ pressed }) => [
						styles.outlineButton,
						pressed && styles.pressed,
						(exporting || picking || restoring) && styles.disabled,
					]}
				>
					<Text style={styles.outlineButtonText}>
						{picking ? t('settings.picking') : t('settings.restore')}
					</Text>
				</Pressable>

				{preview && !preview.ok ? (
					<Text style={styles.errorText}>
						{mapValidationMessage(preview.message)}
					</Text>
				) : null}

				{previewSummary ? (
					<View style={styles.previewCard}>
						<Text style={styles.previewTitle}>
							{t('settings.backupPreview')}
						</Text>
						<PreviewRow
							label={t('settings.backup.created')}
							value={formatPreviewDate(previewSummary.createdAt, locale)}
						/>
						<PreviewRow
							label={t('settings.backup.appVersion')}
							value={previewSummary.appVersion}
						/>
						<PreviewRow
							label={t('settings.backup.profiles')}
							value={String(previewSummary.profileCount)}
						/>
						<PreviewRow
							label={t('settings.backup.measurements')}
							value={String(previewSummary.measurementCount)}
						/>
						<PreviewRow
							label={t('settings.backup.medications')}
							value={String(previewSummary.medicationCount)}
						/>
						<PreviewRow
							label={t('settings.backup.intakes')}
							value={String(previewSummary.intakeCount)}
						/>
						<PreviewRow
							label={t('settings.backup.health')}
							value={String(previewSummary.healthMetricCount)}
						/>
						<Text style={styles.warning}>{t('settings.backup.warning')}</Text>
						<View style={styles.previewActions}>
							<Pressable
								accessibilityRole="button"
								onPress={handleCancelPreview}
								style={({ pressed }) => [
									styles.secondaryBtn,
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.secondaryBtnText}>
									{t('common.cancel')}
								</Text>
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
									{restoring
										? t('settings.restoring')
										: t('settings.restoreAction')}
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
					{t('settings.about')}
				</Text>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t('settings.privacy')}
					onPress={() => void handleOpenPrivacyPolicy()}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>{t('settings.privacy')}</Text>
				</Pressable>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t('settings.privacyChoices')}
					onPress={() => setPrivacyChoicesOpen(true)}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>
						{t('settings.privacyChoices')}
					</Text>
				</Pressable>

				{privacyChoicesOpen ? (
					<PrivacyConsentModal
						forceVisible
						onClose={() => setPrivacyChoicesOpen(false)}
					/>
				) : null}

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t('settings.contact')}
					onPress={() => void handleContactDeveloper()}
					style={({ pressed }) => [
						styles.linkRow,
						pressed && styles.pressed,
					]}
				>
					<Text style={styles.linkRowText}>{t('settings.contact')}</Text>
				</Pressable>

				<View style={styles.versionBlock}>
					<Text style={styles.versionLabel}>
						{t('common.version', { version: appConfig.versionName })}
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

function formatPreviewDate(
	iso: string,
	locale: ReturnType<typeof useI18n>['locale'],
): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) {
		return iso
	}
	return formatDateTime(d, locale)
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
	langRow: {
		minHeight: touchTargetMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	langRowSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.chipSelected,
	},
	langRowText: {
		fontSize: typography.body,
		color: colors.text,
	},
	langRowTextSelected: {
		fontWeight: '700',
		color: colors.primary,
	},
	langCheck: {
		fontSize: typography.body,
		fontWeight: '700',
		color: colors.primary,
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
