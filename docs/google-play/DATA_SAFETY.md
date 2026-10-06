# Google Play Data Safety — evidence matrix

**Package:** `com.calculatorplatform.bpdiary`  
**Prepared:** 2026-10-06  
**Principle:** declarations must match code + SDK vendor guidance. Where vendor detail is required: `VERIFY IN PLAY CONSOLE / VENDOR DOCS`.

## How to read this matrix

- **Collected** = app or embedded SDK obtains the data type on or from the device.
- **Shared** = transmitted off-device to a third party (SDK backends). User Share Sheet exports are **user-initiated**, not developer “sharing” for Data Safety unless Google’s form treats them differently — treat JSON/PDF share as user-controlled export; do not claim developer cloud sync.
- **Ephemeral / on-device only** health diary rows are still “collected” in Google’s sense if the app stores them.

## Summary answers (proposed Console)

| Question | Proposed answer | Evidence |
|----------|-----------------|----------|
| Does the app collect or share required user data types? | **Yes** | Local health diary + AppMetrica + Yandex Ads |
| Is all user data encrypted in transit? | **Yes** for SDK HTTPS traffic — **VERIFY** vendor docs; local SQLite is on-device | Vendor Data Safety guides |
| Can users request deletion? | **Yes — local deletion in app**; no developer account backend | Settings/forms delete paths; uninstall |
| Independent security review? | **No** (unless operator later obtains one) | — |

## Category matrix

| Data category | Collected | Shared | Purpose | Required/Optional | Evidence | Console action |
|---------------|-----------|--------|---------|-------------------|----------|----------------|
| Health info (BP, pulse, metrics, meds, notes, tags) | **Yes** (on-device) | **No** to developer/SDK analytics | App functionality (diary) | Required for core diary features the user chooses to enter | SQLite repos `src/storage/sqlite/`; domain types `src/domain/types.ts`; `FORBIDDEN_ANALYTICS_KEYS` | Declare Health info collected, **not shared**; purpose App functionality |
| Personal info — name (profile display names) | **Yes** (on-device) | **No** | App functionality | Optional (user-chosen labels) | Profiles feature `src/features/profiles/` | Declare Name/other personal info if Console maps profile labels there; not shared |
| App activity (feature events) | **Yes** | **Yes** (AppMetrica) | Analytics | Required for analytics SDK operation when app runs | `src/analytics/events.ts`, `appmetrica-service.ts` | Declare App activity collected + shared with analytics |
| Device or other IDs | **Likely Yes via SDKs** | **Likely Yes** | Analytics; Advertising | Optional per vendor guidance when permission/settings allow | Yandex Ads AD_ID docs; AppMetrica Data Safety guide | Declare Device/other IDs; purposes Analytics + Advertising; **VERIFY** exact vendor rows |
| Diagnostics | **Possibly via SDKs** | **Possibly** | Analytics / crash-like telemetry | Optional | AppMetrica vendor guide | **VERIFY IN VENDOR DOCS** before checking Diagnostics |
| Advertising data / interactions | **Yes** (ad SDK) | **Yes** | Advertising or marketing | Optional (ads load when online; Medications banner always eligible; others gated) | `src/config/ads.ts`, `src/ads/` | Declare Advertising; Contains ads = Yes |
| Approximate/precise location | **No in first-party code** | — | — | — | No location APIs in app source | Do not declare unless vendor default requires — **VERIFY** AppMetrica location tracking is off/default |
| Photos / video / audio / contacts / calendar | **No** | — | — | — | No corresponding APIs | Do not declare |
| Financial info / payment | **No** | — | — | — | No IAP | Do not declare |

## First-party health data flow

| Item | Collected? | Stored locally? | Off-device by app? | Third party? | Encrypted in transit | Optional? | Purpose | Retention / deletion |
|------|------------|-----------------|-------------------|--------------|----------------------|-----------|---------|----------------------|
| Systolic / diastolic / pulse | Yes | SQLite | No (unless user exports) | No | N/A on-device; export via Share Sheet | User-entered | Diary | User delete per row / uninstall / JSON replace |
| Notes / tags | Yes | SQLite | No (unless export) | No | Same | Optional fields | Diary | Same |
| Medications / intakes | Yes | SQLite | No (unless export) | No | Same | Optional feature | Reminders/diary | Delete med / intakes |
| Health metrics | Yes | SQLite | No (unless export) | No | Same | Optional | Diary | Delete metric rows |
| Profiles | Yes | SQLite | No | No | Same | Optional multi-profile | Separation | Delete profile (not last) |
| Reminders copy/schedule | Yes | SQLite + local notifications | No | No | N/A | Optional | Reminders | Delete reminder / disable |

## SDK / technical flow

| Item | Collected? | Stored locally? | Off-device? | Shared? | Evidence |
|------|------------|-----------------|------------|---------|----------|
| AppMetrica events | Yes (sanitized) | SDK caches possible | Yes | Yes → Yandex AppMetrica | `src/analytics/`; no BP values in params |
| Yandex Mobile Ads | Yes (tech + AD_ID when available) | SDK | Yes | Yes → Yandex ads stack | `yandex-mobile-ads` dep; production block IDs in `src/config/ads.ts` |
| Advertising ID | Via Ads SDK (not read in app TS) | OS/SDK | Yes | Yes for ads | Vendor AD_ID doc |

## User-controlled export

| Export | Off-device? | Shared with developer? | Notes |
|--------|------------|------------------------|-------|
| PDF doctor report | Only if user shares | No | Local `expo-print` + Share Sheet |
| JSON backup | Only if user shares | No | Settings export |
| Android Share Sheet targets | User chooses | No | Messenger/email/etc. are user’s choice |

## Android Auto Backup

**Disabled** (`allowBackup=false` + extraction rules). See [AUTO_BACKUP.md](./AUTO_BACKUP.md). Do **not** describe health diary as backed up to Google Auto Backup.

## Account deletion

No accounts / no developer backend. Proposed Console stance:

- Provide in-app deletion instructions (delete records / uninstall).
- Account deletion URL: **not applicable** (no account system) — **VERIFY** current Play Console wording for “no accounts” apps.
