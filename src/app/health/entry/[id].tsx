import { MetricFormScreen } from '@/features/health/metric-form-screen'

/** Edit an existing health metric by id — `/health/entry/[id]`. */
export default function EditHealthMetricRoute() {
	return <MetricFormScreen mode="edit" />
}
