# Android Auto Backup decision

**Date:** 2026-10-06  
**Status:** Accepted and implemented in config (no user data wipe).

## What Phase 0 found

Expo / Android default is `android:allowBackup="true"` unless overridden.  
With that default, app databases under the app data directory (including the expo-sqlite diary DB) are eligible for Android Auto Backup to the user’s Google account backup set.

## What can enter Auto Backup (before this change)

| Domain | Likely content | Risk |
|--------|----------------|------|
| `database` | SQLite health diary (BP, pulse, meds, notes, profiles, reminders) | High — sensitive health diary |
| `sharedpref` | App preferences / SDK prefs | Medium |
| `file` / cache | Temp PDF / JSON backup caches | Medium |

Evidence:

- Persistence: `expo-sqlite` repositories under `src/storage/sqlite/`
- No prior `allowBackup: false` in `app.config.ts` (Phase 0 / pre-Phase-3)
- Official behavior: https://developer.android.com/identity/data/autobackup

## Existing user-controlled backup

The product already ships explicit JSON export/restore (Settings) via Share Sheet / document picker. That path is intentional, auditable, and disclosed in privacy policy.

## Decision

**Disable Android Auto Backup for this package** and exclude sensitive domains from data-extraction / full-backup rules.

### Why this is safe for RuStore users

- Does **not** delete local on-device diary data.
- Does **not** change the SQLite schema or JSON backup format.
- Only stops **future** automatic cloud Auto Backup / reduces OEM transfer copies of app data.
- Users who need transfer keep JSON export/restore.

### Implementation

1. `app.config.ts` → `android.allowBackup: false`
2. Config plugin `plugins/with-disable-auto-backup.js` writes:
   - `bpdiary_data_extraction_rules.xml`
   - `bpdiary_full_backup_content.xml`
   and sets matching manifest attributes on prebuild.

## Data Safety implication

After this change, health diary data should be declared as **collected / stored on device**, **not** shared via Android Auto Backup. User-initiated JSON/PDF share remains a user-controlled export (not developer collection to a backend).

## Residual VERIFY

Some OEMs may still perform device-to-device migration quirks on API 31+ even when `allowBackup=false`. Extraction rules exclude database/file domains as defense-in-depth. Full OEM behavior: **VERIFY IN PLAY CONSOLE / DEVICE QA** if reviewers ask.
