import { useCallback, useEffect, useState } from 'react'
import { beginBlockingModal, endBlockingModal } from '@/ads/ui-safety-gate'
import {
	Alert,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { analytics } from '@/analytics'
import { useDiary } from '@/hooks/use-diary'
import { useI18n } from '@/i18n'
import { colors, spacing, touchTargetMin, typography } from '@/theme'

type ProfileSelectorProps = {
	/** Compact trigger for headers (Diary / Health). */
	compact?: boolean
}

type EditorMode =
	| { type: 'idle' }
	| { type: 'add' }
	| { type: 'rename'; profileId: string; draft: string }

/**
 * Active profile chip + picker modal (switch / add / rename / delete).
 * Switching updates settings.activeProfileId and reloads all profile-scoped data.
 */
export function ProfileSelector({ compact = true }: ProfileSelectorProps) {
	const insets = useSafeAreaInsets()
	const { t } = useI18n()
	const {
		profile,
		profiles,
		switchProfile,
		createProfile,
		renameProfile,
		deleteProfile,
	} = useDiary()
	const [open, setOpen] = useState(false)
	const [editor, setEditor] = useState<EditorMode>({ type: 'idle' })
	const [addDraft, setAddDraft] = useState('')
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		if (!open) {
			return
		}
		beginBlockingModal()
		return () => {
			endBlockingModal()
		}
	}, [open])

	const close = useCallback(() => {
		if (busy) {
			return
		}
		setOpen(false)
		setEditor({ type: 'idle' })
		setAddDraft('')
	}, [busy])

	const handleSelect = useCallback(
		async (id: string) => {
			if (id === profile?.id) {
				close()
				return
			}
			setBusy(true)
			try {
				await switchProfile(id)
				analytics.trackProfileSwitched()
				setOpen(false)
				setEditor({ type: 'idle' })
				setAddDraft('')
			} catch (err) {
				Alert.alert(
					t('profiles.switchFailed'),
					err instanceof Error ? err.message : t('common.tryAgain'),
				)
			} finally {
				setBusy(false)
			}
		},
		[close, profile?.id, switchProfile, t],
	)

	const handleAdd = useCallback(async () => {
		const trimmed = addDraft.trim()
		if (!trimmed) {
			return
		}
		setBusy(true)
		try {
			const created = await createProfile(trimmed)
			analytics.trackProfileCreated()
			setAddDraft('')
			setEditor({ type: 'idle' })
			await switchProfile(created.id)
			setOpen(false)
		} catch (err) {
			Alert.alert(
				t('profiles.createFailed'),
				err instanceof Error ? err.message : t('common.tryAgain'),
			)
		} finally {
			setBusy(false)
		}
	}, [addDraft, createProfile, switchProfile, t])

	const handleRenameSave = useCallback(async () => {
		if (editor.type !== 'rename') {
			return
		}
		const trimmed = editor.draft.trim()
		if (!trimmed) {
			return
		}
		setBusy(true)
		try {
			await renameProfile(editor.profileId, trimmed)
			setEditor({ type: 'idle' })
		} catch (err) {
			Alert.alert(
				t('profiles.renameFailed'),
				err instanceof Error ? err.message : t('common.tryAgain'),
			)
		} finally {
			setBusy(false)
		}
	}, [editor, renameProfile, t])

	const confirmDelete = useCallback(
		(id: string, name: string) => {
			if (profiles.length <= 1) {
				Alert.alert(
					t('profiles.deleteBlockedTitle'),
					t('profiles.deleteBlockedBody'),
				)
				return
			}
			Alert.alert(
				t('profiles.deleteConfirmTitle', { name }),
				t('profiles.deleteConfirmBody'),
				[
					{ text: t('common.cancel'), style: 'cancel' },
					{
						text: t('profiles.deleteConfirmAction'),
						style: 'destructive',
						onPress: () => {
							Alert.alert(
								t('profiles.deleteConfirm2Title'),
								t('profiles.deleteConfirm2Body', { name }),
								[
									{ text: t('common.cancel'), style: 'cancel' },
									{
										text: t('common.delete'),
										style: 'destructive',
										onPress: () => {
											void deleteProfile(id)
												.then(() => {
													setOpen(false)
													setEditor({ type: 'idle' })
												})
												.catch((err) => {
													Alert.alert(
														t('profiles.deleteFailed'),
														err instanceof Error
															? err.message
															: '',
													)
												})
										},
									},
								],
							)
						},
					},
				],
			)
		},
		[deleteProfile, profiles.length, t],
	)

	const label = profile?.name ?? t('profiles.fallback')

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t('profiles.a11y', { name: label })}
				onPress={() => setOpen(true)}
				style={({ pressed }) => [
					compact ? styles.chip : styles.chipWide,
					pressed && styles.chipPressed,
				]}
			>
				<Text
					style={styles.chipText}
					numberOfLines={1}
					ellipsizeMode="tail"
				>
					{label} ▾
				</Text>
			</Pressable>

			<Modal
				visible={open}
				animationType="slide"
				transparent
				onRequestClose={close}
			>
				<Pressable style={styles.backdrop} onPress={close} />
				<View
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + spacing.md },
					]}
				>
					<Text style={styles.sheetTitle}>{t('profiles.title')}</Text>
					<ScrollView keyboardShouldPersistTaps="handled">
						{profiles.map((item) => {
							const selected = item.id === profile?.id
							const renaming =
								editor.type === 'rename' &&
								editor.profileId === item.id
							return (
								<View key={item.id} style={styles.rowBlock}>
									{renaming ? (
										<View style={styles.editBlock}>
											<TextInput
												value={editor.draft}
												onChangeText={(text) =>
													setEditor({
														type: 'rename',
														profileId: item.id,
														draft: text,
													})
												}
												autoFocus
												maxLength={40}
												style={styles.addInput}
											/>
											<View style={styles.addActions}>
												<Pressable
													onPress={() =>
														setEditor({ type: 'idle' })
													}
													style={styles.secondaryBtn}
												>
													<Text
														style={styles.secondaryBtnText}
													>
														{t('common.cancel')}
													</Text>
												</Pressable>
												<Pressable
													onPress={() =>
														void handleRenameSave()
													}
													disabled={
														busy || !editor.draft.trim()
													}
													style={[
														styles.primaryBtn,
														(!editor.draft.trim() ||
															busy) &&
															styles.primaryBtnDisabled,
													]}
												>
													<Text
														style={styles.primaryBtnText}
													>
														{t('common.save')}
													</Text>
												</Pressable>
											</View>
										</View>
									) : (
										<View style={styles.row}>
											<Pressable
												accessibilityRole="button"
												accessibilityLabel={item.name}
												disabled={busy}
												onPress={() =>
													void handleSelect(item.id)
												}
												style={styles.rowMain}
											>
												<Text
													style={[
														styles.rowName,
														selected &&
															styles.rowNameSelected,
													]}
													numberOfLines={1}
												>
													{item.name}
													{selected ? ' ✓' : ''}
												</Text>
											</Pressable>
											<Pressable
												accessibilityLabel={t(
													'profiles.renameA11y',
													{ name: item.name },
												)}
												onPress={() =>
													setEditor({
														type: 'rename',
														profileId: item.id,
														draft: item.name,
													})
												}
												style={styles.rowAction}
											>
												<Text style={styles.rowActionText}>
													{t('profiles.renameShort')}
												</Text>
											</Pressable>
											<Pressable
												accessibilityLabel={t(
													'profiles.deleteA11y',
													{ name: item.name },
												)}
												onPress={() =>
													confirmDelete(item.id, item.name)
												}
												style={styles.rowAction}
											>
												<Text style={styles.rowActionDanger}>
													{t('profiles.deleteShort')}
												</Text>
											</Pressable>
										</View>
									)}
								</View>
							)
						})}

						{editor.type === 'add' ? (
							<View style={styles.editBlock}>
								<TextInput
									value={addDraft}
									onChangeText={setAddDraft}
									placeholder={t('profiles.placeholder')}
									placeholderTextColor={colors.textMuted}
									autoFocus
									style={styles.addInput}
									maxLength={40}
								/>
								<View style={styles.addActions}>
									<Pressable
										onPress={() => {
											setEditor({ type: 'idle' })
											setAddDraft('')
										}}
										style={styles.secondaryBtn}
									>
										<Text style={styles.secondaryBtnText}>
											{t('common.cancel')}
										</Text>
									</Pressable>
									<Pressable
										onPress={() => void handleAdd()}
										disabled={busy || !addDraft.trim()}
										style={[
											styles.primaryBtn,
											(!addDraft.trim() || busy) &&
												styles.primaryBtnDisabled,
										]}
									>
										<Text style={styles.primaryBtnText}>
											{t('profiles.create')}
										</Text>
									</Pressable>
								</View>
							</View>
						) : (
							<Pressable
								accessibilityRole="button"
								onPress={() => setEditor({ type: 'add' })}
								style={styles.addTrigger}
							>
								<Text style={styles.addTriggerText}>
									{t('profiles.addTrigger')}
								</Text>
							</Pressable>
						)}
					</ScrollView>
				</View>
			</Modal>
		</>
	)
}

const styles = StyleSheet.create({
	chip: {
		alignSelf: 'flex-start',
		marginTop: spacing.xs,
		paddingVertical: 4,
		paddingHorizontal: spacing.sm,
		borderRadius: 999,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		maxWidth: 180,
	},
	chipWide: {
		alignSelf: 'flex-start',
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		maxWidth: '100%',
	},
	chipPressed: {
		opacity: 0.85,
	},
	chipText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
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
		maxHeight: '70%',
	},
	sheetTitle: {
		fontSize: typography.section,
		fontWeight: '700',
		color: colors.text,
		marginBottom: spacing.sm,
	},
	rowBlock: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: touchTargetMin,
	},
	rowMain: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingRight: spacing.sm,
	},
	rowName: {
		fontSize: typography.body,
		color: colors.text,
	},
	rowNameSelected: {
		fontWeight: '700',
		color: colors.primary,
	},
	rowAction: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
	},
	rowActionText: {
		fontSize: typography.secondary,
		color: colors.primary,
		fontWeight: '600',
	},
	rowActionDanger: {
		fontSize: typography.secondary,
		color: colors.danger,
		fontWeight: '600',
	},
	addTrigger: {
		minHeight: touchTargetMin,
		justifyContent: 'center',
		marginTop: spacing.sm,
	},
	addTriggerText: {
		fontSize: typography.body,
		fontWeight: '600',
		color: colors.primary,
	},
	editBlock: {
		marginVertical: spacing.sm,
	},
	addInput: {
		minHeight: touchTargetMin,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 12,
		paddingHorizontal: spacing.md,
		fontSize: typography.body,
		color: colors.text,
		backgroundColor: colors.surface,
	},
	addActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	secondaryBtn: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		justifyContent: 'center',
	},
	secondaryBtnText: {
		color: colors.textMuted,
		fontWeight: '600',
	},
	primaryBtn: {
		minHeight: touchTargetMin,
		paddingHorizontal: spacing.md,
		borderRadius: 12,
		backgroundColor: colors.primary,
		justifyContent: 'center',
	},
	primaryBtnDisabled: {
		opacity: 0.5,
	},
	primaryBtnText: {
		color: '#fff',
		fontWeight: '700',
	},
})
