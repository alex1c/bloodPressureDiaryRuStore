import {
	getLiveInterstitialUiState,
	reportNavigationPathname,
	resetUiSafetyGateForTests,
	setGraphsScreenFocused,
	setKeyboardStateForTests,
	beginBlockingModal,
	endBlockingModal,
} from '@/ads/ui-safety-gate'

describe('ui safety gate (Graphs-only)', () => {
	beforeEach(() => {
		resetUiSafetyGateForTests()
	})

	it('blocks when Graphs is not focused', () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(false)
		const ui = getLiveInterstitialUiState('/graphs')
		expect(ui.uiStateConfirmed).toBe(false)
		expect(ui.onSensitiveScreen).toBe(true)
	})

	it('allows only when Graphs focused, keyboard known closed, no modal', () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		const ui = getLiveInterstitialUiState('/graphs')
		expect(ui.uiStateConfirmed).toBe(true)
		expect(ui.onSensitiveScreen).toBe(false)
	})

	it('blocks when keyboard state forced unknown', () => {
		setGraphsScreenFocused(true)
		setKeyboardStateForTests({ visible: false, known: false })
		const ui = getLiveInterstitialUiState('/graphs')
		expect(ui.keyboardKnown).toBe(false)
		expect(ui.uiStateConfirmed).toBe(false)
		expect(ui.hasKeyboardOrInputFlow).toBe(true)
	})

	it('blocks when keyboard is visible', () => {
		setGraphsScreenFocused(true)
		setKeyboardStateForTests({ visible: true, known: true })
		const ui = getLiveInterstitialUiState('/graphs')
		expect(ui.uiStateConfirmed).toBe(false)
		expect(ui.hasKeyboardOrInputFlow).toBe(true)
	})

	it('blocks unknown pathname', () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		const ui = getLiveInterstitialUiState(null)
		expect(ui.uiStateConfirmed).toBe(false)
	})

	it('blocks when modal open', () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		beginBlockingModal()
		const ui = getLiveInterstitialUiState('/graphs')
		expect(ui.uiStateConfirmed).toBe(false)
		endBlockingModal()
	})

	it('uses last reported pathname for fresh probes', () => {
		setKeyboardStateForTests({ visible: false, known: true })
		setGraphsScreenFocused(true)
		reportNavigationPathname('/graphs')
		expect(getLiveInterstitialUiState().uiStateConfirmed).toBe(true)
		reportNavigationPathname('/settings')
		expect(getLiveInterstitialUiState().uiStateConfirmed).toBe(false)
	})
})
