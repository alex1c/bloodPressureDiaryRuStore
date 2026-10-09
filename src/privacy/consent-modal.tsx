/**
 * First-run / settings privacy consent with independent analytics + ads purposes.
 * First-choice switches default OFF. Persist failures keep the dialog open + Retry.
 *
 * Layout: scrollable body + sticky actions above the real bottom safe-area inset
 * so CTAs never sit under Android gesture navigation (e.g. OPPO 1080×2400).
 */

import { useEffect, useState } from 'react'
import {
	Dimensions,
	KeyboardAvoidingView,
	Linking,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { beginBlockingModal, endBlockingModal } from '@/ads/ui-safety-gate'
import { releaseConfig } from '@/config/release'
import { useI18n } from '@/i18n'
import { colors, spacing, typography } from '@/theme'
import { usePrivacyConsent } from './consent-context'
import type { PurposeDecision } from './consent-persistence'

type PrivacyConsentModalProps = {
	forceVisible?: boolean
	onClose?: () => void
}

export function PrivacyConsentModal({
	forceVisible = false,
	onClose,
}: PrivacyConsentModalProps) {
	const { t } = useI18n()
	const insets = useSafeAreaInsets()
	const consent = usePrivacyConsent()
	const [draft, setDraft] = useState<{
		analyticsOn: boolean
		adsOn: boolean
	} | null>(null)
	const [busy, setBusy] = useState(false)

	const visible =
		forceVisible ||
		(consent.ready &&
			consent.pending &&
			consent.requirement.requiresExplicitConsent) ||
		consent.pendingRetry !== null

	useEffect(() => {
		if (!visible) {
			return
		}
		beginBlockingModal()
		return () => {
			endBlockingModal()
		}
	}, [visible])

	if (!visible) {
		return null
	}

	// Session not confirmed: prefill from saved preferences (history only).
	// After confirm / settings edit: seed from active session decisions.
	// Never treat preferences as acting consent until Save in this process.
	const analyticsOn =
		draft?.analyticsOn ??
		(consent.sessionConfirmed
			? consent.analytics === 'granted'
			: consent.preferenceAnalytics === 'granted')
	const adsOn =
		draft?.adsOn ??
		(consent.sessionConfirmed
			? consent.ads === 'granted'
			: consent.preferenceAds === 'granted')

	const toDecision = (on: boolean): PurposeDecision =>
		on ? 'granted' : 'denied'

	const handleSave = async (analytics: boolean, ads: boolean) => {
		if (busy) {
			return
		}
		setBusy(true)
		try {
			await consent.savePurposes({
				analytics: toDecision(analytics),
				ads: toDecision(ads),
			})
			setDraft(null)
			onClose?.()
		} catch {
			// Keep dialog open — persistError + Retry are shown.
		} finally {
			setBusy(false)
		}
	}

	const handleRetry = async () => {
		if (busy) {
			return
		}
		setBusy(true)
		try {
			await consent.retryPersist()
			setDraft(null)
			onClose?.()
		} catch {
			/* stay open */
		} finally {
			setBusy(false)
		}
	}

	// Keep CTAs clear of gesture nav; never rely on a zero inset.
	const bottomPad = Math.max(insets.bottom, spacing.lg) + spacing.md
	const topPad = Math.max(insets.top, spacing.md)
	const windowHeight = Dimensions.get('window').height
	// Explicit max height so ScrollView gets a bounded viewport and can scroll
	// instead of clipping under the sticky action footer.
	const cardMaxHeight = Math.max(
		320,
		windowHeight - topPad - bottomPad - spacing.md,
	)

	return (
		<Modal visible animationType="fade" transparent onRequestClose={() => {}}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View
					style={[
						styles.backdrop,
						{
							paddingTop: topPad,
							paddingBottom: bottomPad,
							paddingLeft: Math.max(insets.left, spacing.lg),
							paddingRight: Math.max(insets.right, spacing.lg),
						},
					]}
					accessibilityViewIsModal
				>
					<View style={[styles.card, { maxHeight: cardMaxHeight }]}>
						{/* Scrollable copy + toggles — long RU / large fonts stay reachable. */}
						<ScrollView
							style={styles.scroll}
							contentContainerStyle={styles.scrollContent}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator
							bounces={false}
							nestedScrollEnabled
						>
							<Text style={styles.title}>{t('privacy.consentTitle')}</Text>
							<Text style={styles.body}>{t('privacy.consentBody')}</Text>
							{!consent.sessionConfirmed ? (
								<Text style={styles.note}>
									{t('privacy.sessionConfirmNote')}
								</Text>
							) : null}
							{!consent.requirement.adsPersonalizationSeparable ? (
								<Text style={styles.note}>{t('privacy.consentAdsNote')}</Text>
							) : null}

							<View style={styles.row}>
								<Text style={styles.rowLabel}>
									{t('privacy.purposeAnalytics')}
								</Text>
								<Switch
									value={analyticsOn}
									onValueChange={(value) =>
										setDraft({ analyticsOn: value, adsOn })
									}
									accessibilityLabel={t('privacy.purposeAnalytics')}
								/>
							</View>
							<View style={styles.row}>
								<Text style={styles.rowLabel}>
									{t('privacy.purposeAds')}
								</Text>
								<Switch
									value={adsOn}
									onValueChange={(value) =>
										setDraft({ analyticsOn, adsOn: value })
									}
									accessibilityLabel={t('privacy.purposeAds')}
								/>
							</View>

							<Pressable
								accessibilityRole="link"
								onPress={() => {
									void Linking.openURL(releaseConfig.privacyPolicyUrl)
								}}
							>
								<Text style={styles.link}>{t('privacy.openPolicy')}</Text>
							</Pressable>

							{consent.persistError ? (
								<Text style={styles.error}>{t('privacy.persistError')}</Text>
							) : null}
						</ScrollView>

						{/* Sticky actions — always above system navigation / banners. */}
						<View style={styles.actions}>
							{consent.pendingRetry ? (
								<Pressable
									accessibilityRole="button"
									disabled={busy}
									style={styles.primary}
									onPress={() => {
										void handleRetry()
									}}
								>
									<Text style={styles.primaryLabel}>
										{t('privacy.persistRetry')}
									</Text>
								</Pressable>
							) : (
								<>
									<Pressable
										accessibilityRole="button"
										disabled={busy}
										style={styles.primary}
										onPress={() => {
											void handleSave(analyticsOn, adsOn)
										}}
									>
										<Text style={styles.primaryLabel}>
											{t('privacy.consentSave')}
										</Text>
									</Pressable>
									<Pressable
										accessibilityRole="button"
										disabled={busy}
										style={styles.secondary}
										onPress={() => {
											void handleSave(false, false)
										}}
									>
										<Text style={styles.secondaryLabel}>
											{t('privacy.consentDecline')}
										</Text>
									</Pressable>
								</>
							)}
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(15, 23, 42, 0.45)',
		justifyContent: 'center',
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: 16,
		paddingTop: spacing.lg,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
		flexDirection: 'column',
		overflow: 'hidden',
	},
	scroll: {
		flexGrow: 1,
		flexShrink: 1,
		minHeight: 120,
	},
	scrollContent: {
		gap: spacing.md,
		paddingBottom: spacing.md,
		flexGrow: 0,
	},
	actions: {
		flexGrow: 0,
		flexShrink: 0,
		gap: spacing.sm,
		paddingTop: spacing.md,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	title: {
		fontSize: typography.title,
		fontWeight: '700',
		color: colors.text,
	},
	body: {
		fontSize: typography.body,
		color: colors.textMuted,
		lineHeight: 22,
	},
	note: {
		fontSize: 13,
		color: colors.textMuted,
		lineHeight: 18,
	},
	error: {
		fontSize: typography.secondary,
		color: colors.danger,
		lineHeight: 20,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.md,
	},
	rowLabel: {
		flex: 1,
		fontSize: typography.body,
		color: colors.text,
	},
	link: {
		fontSize: typography.body,
		color: colors.primary,
		textDecorationLine: 'underline',
	},
	primary: {
		backgroundColor: colors.primary,
		borderRadius: 12,
		paddingVertical: spacing.md,
		alignItems: 'center',
		minHeight: 48,
		justifyContent: 'center',
	},
	primaryLabel: {
		color: '#fff',
		fontWeight: '700',
		fontSize: typography.body,
		textAlign: 'center',
	},
	secondary: {
		paddingVertical: spacing.sm,
		alignItems: 'center',
		minHeight: 44,
		justifyContent: 'center',
	},
	secondaryLabel: {
		color: colors.textMuted,
		fontSize: typography.body,
		textAlign: 'center',
	},
})
