/**
 * Calm, medically neutral palette — readable at 360/390dp.
 * Avoid hospital-red / heart-icon aesthetics.
 */
export const colors = {
	background: '#F4F7FA',
	surface: '#FFFFFF',
	text: '#1B2430',
	textMuted: '#5C6B7A',
	primary: '#2B6CB0',
	primaryPressed: '#1F5288',
	border: '#D7E0EA',
	danger: '#B42318',
	dangerSoft: '#FEF3F2',
	chip: '#EEF3F8',
	chipSelected: '#D6E6F5',
	focus: '#2B6CB0',
} as const

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
} as const

export const typography = {
	title: 28,
	section: 20,
	body: 17,
	secondary: 15,
	bpHero: 44,
	bpRow: 22,
} as const

/** Minimum touch target for primary actions (dp). */
export const touchTargetMin = 48
