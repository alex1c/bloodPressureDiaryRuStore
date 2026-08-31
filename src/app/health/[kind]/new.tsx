import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ALL_METRIC_KINDS } from '@/domain/health/metric-catalog'
import type { HealthMetricKind } from '@/domain/types'
import { MetricFormScreen } from '@/features/health/metric-form-screen'
import { colors, spacing, typography } from '@/theme'

function isHealthMetricKind(value: string): value is HealthMetricKind {
	return (ALL_METRIC_KINDS as readonly string[]).includes(value)
}

/** Create a new reading for `/health/[kind]/new`. */
export default function NewHealthMetricRoute() {
	const params = useLocalSearchParams<{ kind?: string }>()
	const kind =
		typeof params.kind === 'string' && isHealthMetricKind(params.kind)
			? params.kind
			: null

	if (!kind) {
		return (
			<View
				style={{
					flex: 1,
					justifyContent: 'center',
					padding: spacing.lg,
					backgroundColor: colors.background,
				}}
			>
				<Text
					style={{
						fontSize: typography.body,
						color: colors.textMuted,
						textAlign: 'center',
					}}
				>
					Неизвестный показатель
				</Text>
			</View>
		)
	}

	return <MetricFormScreen mode="create" kind={kind} />
}
