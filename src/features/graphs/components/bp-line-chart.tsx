import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { ChartPoint } from '@/domain/statistics/measurement-stats'
import { colors, spacing, typography } from '@/theme'

type BpLineChartProps = {
	points: ChartPoint[]
	showPulse?: boolean
	periodDays: 7 | 30 | 90 | 'all'
}

/**
 * Lightweight systolic/diastolic line chart via react-native-svg.
 * Text averages remain the primary accessibility surface on Graphs.
 */
export function BpLineChart({
	points,
	showPulse = false,
	periodDays,
}: BpLineChartProps) {
	const { width: windowWidth } = useWindowDimensions()
	const width = Math.max(280, Math.min(windowWidth - spacing.lg * 2, 420))
	const height = 200
	const padL = 36
	const padR = 12
	const padT = 16
	const padB = 28
	const innerW = width - padL - padR
	const innerH = height - padT - padB

	if (points.length === 0) {
		return null
	}

	const values = points.flatMap((p) =>
		showPulse ? [p.systolic, p.diastolic, p.pulse] : [p.systolic, p.diastolic],
	)
	const minV = Math.min(...values) - 5
	const maxV = Math.max(...values) + 5
	const span = Math.max(maxV - minV, 1)
	const times = points.map((p) => new Date(p.measuredAt).getTime())
	const minT = Math.min(...times)
	const maxT = Math.max(...times)
	const timeSpan = Math.max(maxT - minT, 1)

	function xAt(iso: string): number {
		if (points.length === 1) {
			return padL + innerW / 2
		}
		const t = new Date(iso).getTime()
		return padL + ((t - minT) / timeSpan) * innerW
	}

	function yAt(value: number): number {
		return padT + ((maxV - value) / span) * innerH
	}

	function series(key: 'systolic' | 'diastolic' | 'pulse'): string {
		return points
			.map((p) => `${xAt(p.measuredAt)},${yAt(p[key])}`)
			.join(' ')
	}

	const labelIndexes = pickLabelIndexes(points.length, periodDays)
	const gridRatios = [0, 0.5, 1]

	return (
		<View style={styles.wrap} accessibilityLabel="График давления">
			<Svg width={width} height={height}>
				{gridRatios.map((ratio) => {
					const y = padT + ratio * innerH
					return (
						<Line
							key={`g-${ratio}`}
							x1={padL}
							y1={y}
							x2={width - padR}
							y2={y}
							stroke={colors.border}
							strokeWidth={1}
						/>
					)
				})}
				{gridRatios.map((ratio) => {
					const y = padT + ratio * innerH
					const value = Math.round(maxV - ratio * span)
					return (
						<SvgText
							key={`gv-${ratio}`}
							x={4}
							y={y + 4}
							fontSize={11}
							fill={colors.textMuted}
						>
							{String(value)}
						</SvgText>
					)
				})}

				<Polyline
					points={series('systolic')}
					fill="none"
					stroke={colors.primary}
					strokeWidth={2.5}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
				<Polyline
					points={series('diastolic')}
					fill="none"
					stroke="#5B8FA8"
					strokeWidth={2.5}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
				{showPulse ? (
					<Polyline
						points={series('pulse')}
						fill="none"
						stroke={colors.textMuted}
						strokeWidth={1.5}
						strokeDasharray="4 4"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				) : null}

				{points.map((p) => (
					<Circle
						key={`s-${p.measuredAt}`}
						cx={xAt(p.measuredAt)}
						cy={yAt(p.systolic)}
						r={3}
						fill={colors.primary}
					/>
				))}
				{points.map((p) => (
					<Circle
						key={`d-${p.measuredAt}`}
						cx={xAt(p.measuredAt)}
						cy={yAt(p.diastolic)}
						r={3}
						fill="#5B8FA8"
					/>
				))}

				{labelIndexes.map((index) => {
					const point = points[index]
					if (!point) {
						return null
					}
					return (
						<SvgText
							key={`lbl-${point.measuredAt}`}
							x={xAt(point.measuredAt)}
							y={height - 8}
							fontSize={10}
							fill={colors.textMuted}
							textAnchor="middle"
						>
							{formatAxisLabel(point.measuredAt)}
						</SvgText>
					)
				})}
			</Svg>
			<View style={styles.legend}>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { backgroundColor: colors.primary }]} />
					<Text style={styles.legendText}>Верхнее</Text>
				</View>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { backgroundColor: '#5B8FA8' }]} />
					<Text style={styles.legendText}>Нижнее</Text>
				</View>
			</View>
		</View>
	)
}

function pickLabelIndexes(
	count: number,
	periodDays: 7 | 30 | 90 | 'all',
): number[] {
	if (count <= 1) {
		return [0]
	}
	const maxLabels =
		periodDays === 7 ? 4 : periodDays === 30 ? 5 : periodDays === 90 ? 4 : 5
	if (count <= maxLabels) {
		return Array.from({ length: count }, (_, i) => i)
	}
	const indexes = [0]
	for (let i = 1; i < maxLabels - 1; i += 1) {
		indexes.push(Math.round((i * (count - 1)) / (maxLabels - 1)))
	}
	indexes.push(count - 1)
	return [...new Set(indexes)]
}

function formatAxisLabel(iso: string): string {
	const date = new Date(iso)
	return `${date.getDate()}.${date.getMonth() + 1}`
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: 'center',
		marginVertical: spacing.sm,
	},
	legend: {
		flexDirection: 'row',
		gap: spacing.lg,
		marginTop: spacing.xs,
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.xs,
	},
	swatch: {
		width: 12,
		height: 12,
		borderRadius: 2,
	},
	legendText: {
		fontSize: typography.secondary,
		color: colors.textMuted,
	},
})
