import { MeasurementFormScreen } from '@/features/diary/measurement-form-screen'

/** Create measurement — empty integer fields, auto date/time. */
export default function NewMeasurementRoute() {
	return <MeasurementFormScreen mode="create" />
}
