const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins')

/**
 * Disables Yandex Mobile Ads automatic ContentProvider initialization
 * (`YandexAdsInitializeProvider`) so the SDK does not start network work
 * before the JS consent gate runs MobileAds.initialize().
 *
 * Per Yandex Mobile Ads SDK 8.x docs, application meta-data:
 *   com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION = false
 *
 * Also disables AppMetrica "easy integration" from the ads SDK so Ads cannot
 * auto-activate AppMetrica before our explicit AppMetrica.activate() after consent.
 *
 * @see https://ads.yandex.com/helpcenter/en/dev/android/quick-start
 */

const META_AUTOMATIC_INIT = 'com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION'
const META_APPMETRICA_EASY =
	'com.yandex.mobile.ads.APPMETRICA_EASY_INTEGRATION_ENABLED'

/**
 * Upserts an <meta-data> entry under <application>.
 * @param {import('@expo/config-plugins').AndroidManifest['manifest']['application'][0]} app
 * @param {string} name
 * @param {string} value
 */
function setApplicationMetaData(app, name, value) {
	if (!app['meta-data']) {
		app['meta-data'] = []
	}
	const existing = app['meta-data'].find((item) => item.$?.['android:name'] === name)
	if (existing) {
		existing.$['android:value'] = value
		return
	}
	app['meta-data'].push({
		$: {
			'android:name': name,
			'android:value': value,
		},
	})
}

module.exports = function withYandexAdsManualInit(config) {
	return withAndroidManifest(config, (cfg) => {
		const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults)
		setApplicationMetaData(app, META_AUTOMATIC_INIT, 'false')
		setApplicationMetaData(app, META_APPMETRICA_EASY, 'false')
		return cfg
	})
}
