const { withGradleProperties } = require('@expo/config-plugins')

/** Keep the pinned Expo 57/worklets native libraries buildable after CNG prebuild. */
module.exports = function withWorkletsPackaging(config) {
	return withGradleProperties(config, (config) => {
		const properties = config.modResults
		const key = 'android.packagingOptions.pickFirsts'
		const value = '**/libworklets.so'
		const existing = properties.find((item) => item.type === 'property' && item.key === key)
		if (existing) {
			const values = existing.value.split(',').map((item) => item.trim()).filter(Boolean)
			if (!values.includes(value)) values.push(value)
			existing.value = values.join(',')
		} else {
			properties.push({ type: 'property', key, value })
		}
		return config
	})
}
