// @ts-check
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
	expoConfig,
	{
		ignores: [
			'node_modules/',
			'android/',
			'android_stale_*/',
			'.runtime-smoke/',
			'ios/',
			'dist/',
			'coverage/',
			'scripts/',
			'jest/',
			'.expo/',
		],
	},
])
