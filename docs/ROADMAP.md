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

## Phase 7 — Doctor report / share

* PDF report
* Android Share Sheet

## Phase 8 — Backup / restore hardening

* Export / import UI
* Validated restore, conflict/merge policy
* Contract already includes profiles / health metrics / profileMetricSettings

## Phase 9 — Analytics / ads

* AppMetrica
* Very moderate ads (never before first measurement / during entry)

## Phase 10 — Release QA / RuStore

* Production signing
* Listing, privacy, store QA
* Release build verification
