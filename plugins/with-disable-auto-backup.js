const {
	AndroidConfig,
	withAndroidManifest,
	withDangerousMod,
} = require('@expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

/**
 * Disables Android Auto Backup for health-diary SQLite / prefs.
 *
 * Rationale: the app already provides user-controlled JSON backup/export.
 * Leaving the platform default (allowBackup=true) could copy health data into
 * Google Auto Backup without an explicit user action — undesirable for
 * Data Safety clarity. Setting allowBackup=false does not wipe local data.
 *
 * dataExtractionRules / fullBackupContent exclude sensitive domains as a
 * defense-in-depth layer for API 31+ OEM device-transfer edge cases.
 */

const EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Health diary data must not enter cloud Auto Backup or OEM device-transfer
  copies. User-controlled JSON export remains the supported backup path.
-->
<data-extraction-rules>
	<cloud-backup>
		<exclude domain="database" path="." />
		<exclude domain="sharedpref" path="." />
		<exclude domain="file" path="." />
		<exclude domain="root" path="." />
		<exclude domain="external" path="." />
	</cloud-backup>
	<device-transfer>
		<exclude domain="database" path="." />
		<exclude domain="sharedpref" path="." />
		<exclude domain="file" path="." />
		<exclude domain="root" path="." />
		<exclude domain="external" path="." />
	</device-transfer>
</data-extraction-rules>
`

const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<!-- Pre-API-31 Auto Backup exclusions (paired with allowBackup=false). -->
<full-backup-content>
	<exclude domain="database" path="." />
	<exclude domain="sharedpref" path="." />
	<exclude domain="file" path="." />
	<exclude domain="root" path="." />
	<exclude domain="external" path="." />
</full-backup-content>
`

module.exports = function withDisableAutoBackup(config) {
	config = withDangerousMod(config, [
		'android',
		async (cfg) => {
			const resXml = path.join(
				cfg.modRequest.platformProjectRoot,
				'app',
				'src',
				'main',
				'res',
				'xml',
			)
			fs.mkdirSync(resXml, { recursive: true })
			fs.writeFileSync(
				path.join(resXml, 'bpdiary_data_extraction_rules.xml'),
				EXTRACTION_RULES,
				'utf8',
			)
			fs.writeFileSync(
				path.join(resXml, 'bpdiary_full_backup_content.xml'),
				FULL_BACKUP_CONTENT,
				'utf8',
			)
			return cfg
		},
	])

	config = withAndroidManifest(config, (cfg) => {
		const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
			cfg.modResults,
		)
		app.$['android:allowBackup'] = 'false'
		app.$['android:fullBackupContent'] = '@xml/bpdiary_full_backup_content'
		app.$['android:dataExtractionRules'] =
			'@xml/bpdiary_data_extraction_rules'
		return cfg
	})

	return config
}
