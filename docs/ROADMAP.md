# Roadmap

Lean phases. Do not turn this into an enterprise process.

## Phase 0–2 — Foundation / data / domain ✅

* Expo + TypeScript Android project
* Package ID, docs, git hygiene
* Domain entities + validation
* SQLite persistence + migrations
* Statistics pure functions
* Decimal / integer input normalization
* Backup validation contract
* Meaningful unit tests
* Smoke: lint, typecheck, tests, Android debug assemble

## Phase 3 — Core measurement UX ✅

* Today diary screen (empty + latest + list)
* Add / edit / delete measurement
* Auto date/time + automatic periodOfDay (incl. night)
* Optional tags/note
* Real SQLite persistence across restart
* 360/390dp-friendly layout (functional)
* Android emulator smoke (create/edit/delete/restart)

## Phase 4 — History / statistics / graphs ✅

* Bottom tabs: Дневник | Графики
* Period selector 7 / 30 / 90 / Все
* Average + min/max summary (descriptive only)
* Morning / evening averages
* SVG line chart (systolic / diastolic)
* Tag factual averages
* History grouped by local day → existing edit route
* Edit form: sticky Save + scrollable Delete
* Profile-scoped queries

## Phase 5 — Medications / reminders ✅

* Tab Лекарства + Ionicons tab icons
* Daily schedule (multiple local HH:mm times)
* Today planned doses + «Принял» / undo
* Deactivate preserves history; optional hard delete
* Local reminders via expo-notifications + reconciliation
* Contextual notification permission
* Diary compact medication summary
* Schema v2: intake scheduled hour/minute
* expo-splash-screen (DevLauncher ClassNotFound fix)

## Phase 6 — Health metrics / profiles ✅

* Tab Здоровье (4 tabs: Дневник | Графики | Лекарства | Здоровье)
* Weight / glucose / SpO₂ / temperature (opt-in per profile)
* Metric history + create/edit/delete
* Family profiles + activeProfileId persistence
* Reminder reconciliation across all profiles
* Schema v3: `profile_metric_settings`

## Phase 7 — Doctor report / share ✅

* Entry from Графики → «Отчёт врачу»
* Periods 7 / 14 (default) / 30 / 90 + custom local day keys
* Preview summary + PDF via `expo-print` HTML
* Share Sheet via `expo-sharing`
* Profile-scoped snapshot builder + HTML escaping

## Phase 8 — Backup / restore ✅

* Settings entry: Дневник → «Ещё» (stack screen, no fifth tab)
* Versioned JSON export (`bpdiary-backup`, backupVersion 1, schemaVersion metadata)
* System Share Sheet export + document picker import
* Preview counts + destructive confirmation
* Full replace restore (not merge) in one transaction
* Platform notification IDs stripped on export; reconciled after restore
* Managed notification cancel (not global cancel-all)

## Phase 9 — Analytics / ads

Status: **Implemented** (release integration gate)

* AppMetrica API key: `233587e7-4552-4959-a6f4-5f06eb451319`
* Yandex Mobile Ads (Дневник давления):
  * Diary banner `R-M-19857656-1`
  * Graphs banner `R-M-19857656-2`
  * Health banner `R-M-19857656-3`
  * Interstitial `R-M-19857656-4` (graphs period-change trigger only; session ≥4; 24h cooldown)
* Privacy: **health values are never sent as analytics event parameters**
* Dev/debug uses Yandex demo ad units; production IDs only in release builds
* `npm run validate:release-config` guards tracked IDs before release prep

## Phase 10 — Release QA / RuStore

* Production signing
* Listing, privacy, store QA
* Release build verification
