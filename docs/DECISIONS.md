# Decisions

## 2026-08-26 — Production package ID

Status: Accepted

Context: Sibling RuStore apps use the `com.calculatorplatform.*` series
(`wallpaper`, `tile`, `template`). This product is a blood-pressure / pulse diary,
not a calculator, but stays in the same publisher namespace for store account
continuity.

Decision: **`com.calculatorplatform.bpdiary`**

Why:

* Short, stable, ASCII-safe applicationId
* Distinct from existing products
* Reads as “blood pressure diary” without medical-device claims

Consequences: All Android / Expo identity (`android.package`, iOS
`bundleIdentifier`, listing docs, signing) must use this ID. Fixed **before**
Android release configuration and prebuild.

## 2026-08-26 — Expo SDK 57 + TypeScript, Android / RuStore first

Status: Accepted

Context: Proven stack in `wallpaperAppRustore` and `ceramicTilesAppRuStore`.

Decision: React Native + Expo SDK ~57, TypeScript, JDK 17, development builds
(`expo-dev-client`), Continuous Native Generation. No backend, no mandatory
registration.

Consequences: AppMetrica and Yandex Mobile Ads stay behind service interfaces
until Phase 9. Expo Go is not the release runtime target.

## 2026-08-26 — Local persistence: expo-sqlite

Status: Accepted

Context: Diary data is long-lived and valuable (years of measurements,
medications, intakes). Calculator apps could tolerate lighter storage; this
product cannot.

Decision: **`expo-sqlite`** as the canonical local database.

Why:

* Survives process death / restart
* Real CRUD with indexes (profileId, measuredAt)
* `schemaVersion` + ordered migrations
* `withTransaction` for multi-row writes (backup restore, intake + reminder)
* Backup/restore can export validated JSON without inventing a cloud API
* No backend dependency

Alternatives rejected for V1 core:

* AsyncStorage alone — weak for relational queries and migrations
* Raw JSON file only — workable for tiny datasets, weaker for filters/indexes
* Cloud DB — out of product scope

Consequences: Domain repositories talk to a DB executor abstraction.
Unit tests use an in-memory repository implementation; production opens SQLite.
Backup format is versioned JSON (not raw SQLite file copy) so restore can
validate before mutating the DB.

## 2026-08-26 — No Redux / no auth / no medical engine

Status: Accepted

Decision:

* Local React state + repository calls for UI (later phases)
* No authentication system
* Statistics are descriptive aggregates only — never causal medical claims

## 2026-08-26 — Separate entities for BP vs other health metrics

Status: Accepted

Context: Weight, glucose, SpO2, temperature have their own measurement times
and optional semantics. Forcing them into a BP row creates null-heavy records
and awkward editing.

Decision: `Measurement` = blood pressure + pulse (+ optional wellbeing/tags/note).
`HealthMetric` = typed metric rows with their own `measuredAt`.

## 2026-08-26 — Windows Android builds need short GRADLE_USER_HOME

Status: Accepted

Context: Native CMake/ninja fails on Windows when Gradle transforms live under a
long sandbox cache path (`Filename longer than 260 characters`).

Decision: For local Android builds on this machine, use a short cache, e.g.:

```powershell
$env:GRADLE_USER_HOME = 'D:\g'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
```

Sibling calculator apps used the same pattern (short work copies / short Gradle home).

## 2026-08-26 — Phase 3 UX and periodOfDay

Status: Accepted

Decisions:

1. **No bottom tabs in Phase 3** — single diary stack keeps the first-run path
   obvious; tabs can return with Phase 4+ screens.
2. **Today list order: newest first** — matches «последнее измерение» at the top.
3. **periodOfDay includes `night`** — local clock buckets:
   morning 05–11, day 12–16, evening 17–21, night 22–04. Stored as TEXT; no
   schema migration required beyond accepting the new value.
4. **Today filter uses local-day ISO bounds** (`getLocalDayBounds`), not UTC
   `substr(measured_at,1,10)`, so near-midnight entries stay on the correct
   local calendar day.
5. **Hard journal bounds** (reject): systolic 50–300, diastolic 30–200, pulse
   20–250; systolic must be greater than diastolic.
6. **Soft check** (warn once, still allow save): systolic 80–200, diastolic
   40–130, pulse 35–180. Copy is only «Проверьте введённое значение.» — never
   a medical diagnosis.
7. **Empty create form** — no default 120/80 placeholders.
8. **Default profile** auto-created as «Я» on first launch without onboarding.

## 2026-08-26 — Phase 4 history / charts

Status: Accepted

Decisions:

1. **Bottom tabs: Дневник | Графики** — no empty medication/health tabs yet.
2. **Chart library: `react-native-svg`** — custom dual-line chart (systolic +
   diastolic). Avoids heavy chart frameworks; pulse stays optional / off by
   default on the main chart for readability.
3. **Period chips: 7 / 30 / 90 / Все** — shared by summary, chart, tags, history.
4. **History grouped by local day, newest first**; chart series chronological.
5. **Chart downsample** for long histories (`downsampleChartSeries`, ~120 pts
   for 90/all) — architecture ready for later aggregation.
6. **Edit form sticky Save footer** + scrollable delete — Delete remains reachable
   below tags/note on 360dp; Save stays visible with keyboard.
7. **No medical BP categories / color zones** — text averages are primary;
   chart is visual enhancement only.
8. **Active profile only** — graphs/history filter by `profileId`.

## 2026-08-27 — Phase 5 medications / local reminders

Status: Accepted

Decisions:

1. **Frequency V1 = every day only** — `Reminder.weekdays` always
   `[0..6]`. Selected weekdays deferred to keep notification sync simple.
2. **Schedule times are local wall-clock HH:mm** — not UTC instants. Stored as
   `{ hour, minute }` on `Medication.schedule` and mirrored on `Reminder`.
3. **MedicationIntake is a fact** — planned doses are computed; intake rows are
   created only on «Принял». Schema v2 adds `scheduled_hour` /
   `scheduled_minute` so a slot can be matched / undone without inventing
   future rows.
4. **Deactivate over delete** — primary UX is «Прекратить отслеживание»
   (`isActive=false`); hard delete requires confirmation and removes intakes.
5. **Reminders** — one `Reminder` row per schedule slot when «Напоминать» is on.
   `platformNotificationId` holds the expo-notifications id after scheduling.
6. **Permission** — requested only when the user enables reminders (contextual).
   Denial keeps the schedule; UI shows a neutral banner; no aggressive re-prompt.
   Android permissions from `expo-notifications` (debug APK audit):
   `POST_NOTIFICATIONS` (required API 33+), `VIBRATE`, `RECEIVE_BOOT_COMPLETED`
   (library default — reschedule after reboot; we did not add exact-alarm /
   foreground-service ourselves). Badge helper permissions may appear via the
   notifications dependency transitive merge.
7. **Reconciliation** — on medications provider mount: cancel all scheduled
   notifications, then reschedule enabled reminders if permission is granted
   (idempotent; avoids orphans after edit/deactivate/force-stop).
8. **Notification copy** — title «Лекарство по расписанию»; body name ± dosage.
   Never medical urgency language. Tap / cold-start opens `Лекарства` tab via
   notification `data.screen` + `getLastNotificationResponseAsync`.
9. **Splash** — add `expo-splash-screen` so DevLauncher finds
   `SplashScreenManager` (fixes ClassNotFound warning).
10. **Tab icons** — `@expo/vector-icons` Ionicons (heart / stats-chart / medical).
11. **Worklets** — pin `react-native-worklets@0.10.1` for Expo SDK 57 /
    `expo-modules-core` native build compatibility.

## 2026-08-31 — Phase 6 health metrics / family profiles

Status: Accepted

Decisions:

1. **Units (RU journal)** — weight `кг`; glucose `ммоль/л` (UI «Сахар крови»);
   SpO₂ `%` integer; temperature `°C`. Decimal comma/dot accepted in input;
   stored as normalized numbers; display uses comma for decimals.
2. **Hard technical ranges** (reject typos) — weight 1–500 kg; glucose 0.1–50;
   SpO₂ 50–100; temperature 30–45 °C. Soft hint ranges (second confirm,
   «Проверьте введённое значение.»): weight 30–250; glucose 2.5–20;
   SpO₂ 85–100; temperature 35–40. Never medical alarms / norms / BMI.
3. **Default enabled metrics** — weight ON for new/migrated profiles; glucose /
   SpO₂ / temperature OFF. BP + pulse remain always-on via `Measurement`.
   No setup wizard.
4. **`profile_metric_settings` (schema v3)** — per-profile `enabled_kinds_json`.
   Seeded on migration for existing profiles with `["weight"]`. New profiles
   get the same default in the same create transaction.
5. **`activeProfileId`** — persisted in `settings`. After restart, last profile
   opens. If missing/deleted → default or first remaining profile. Not
   React-only state.
6. **Profile delete** — cascading (intakes → reminders → medications →
   health_metrics → profile_metric_settings → measurements → profile).
   Double confirmation in UI when data may exist. Refuses deleting the last
   profile. Active profile falls back to remaining default/first.
7. **Reminder reconciliation** — `cancel-all` then reschedule enabled reminders
   for **all** profiles (not only active). Multi-profile notification title:
   `{Имя} — лекарство по расписанию`. Payload includes `profileId`; tap
   switches active profile then opens Лекарства.
8. **Backup readiness** — `DiaryBackup` includes `profileMetricSettings`
   (optional on older payloads → empty). No Phase 8 export UI yet.
9. **Tabs** — four items: Дневник | Графики | Лекарства | Здоровье (Ionicons
   `fitness-outline`). No fifth settings tab; profiles open from header chip.

## 2026-08-31 — Phase 7 doctor PDF report / share

Status: Accepted

Decisions:

1. **Default period = 14 local days** (inclusive of today). Presets: 7 / 14 /
   30 / 90. Custom period uses YYYY-MM-DD start/end fields (no heavy calendar
   dependency).
2. **Inclusive local-day semantics** — same approach as graphs: start 00:00:00.000
   local → end 23:59:59.999 local. Avoids UTC midnight clipping of night rows.
3. **PDF stack** — `expo-print` (`printToFileAsync` HTML→PDF) + `expo-sharing`
   (system Share Sheet). No Telegram/WhatsApp SDKs.
4. **Domain split** — `buildDoctorReportData` (profile-scoped snapshot) +
   `renderDoctorReportHtml` (escaped HTML). Generate freezes `profileId` before
   async work so UI profile switches cannot mix data.
5. **Measurement table order** — chronological ascending (oldest → newest) in PDF;
   on-screen history remains newest-first.
6. **Medications** — active meds only; show schedule + count of taken marks in
   period. No adherence %.
7. **Temp files** — PDF copied under `cacheDirectory/reports/` with sanitized
   name `davlenie_{profile}_{from}_{to}.pdf`; anonymous print temp deleted
   best-effort. Not deleted while Share Sheet may still need the URI.
8. **Disclaimer** — short neutral footer: user-entered data; not a medical device;
   does not replace a clinician.
9. **Permissions** — no broad storage permissions added for report/share.
10. **Native deps** — keep `react-native-worklets@0.10.1` (expo-modules-core).
    Do not let `react-native-reanimated@4.6` pull worklets 0.12 (breaks native
    link). `.npmrc` uses `legacy-peer-deps`; `react-native.config.js` disables
    reanimated autolinking if it appears.

## 2026-09-01 — Phase 8 backup / restore

Status: Accepted

Decisions:

1. **Backup format** — JSON document: `format: "bpdiary-backup"`, `backupVersion: 1`,
   `schemaVersion` (metadata only), `appVersion`, `createdAt`, entity arrays +
   `settings`. Not a raw SQLite file copy.
2. **Replace semantics** — restore fully replaces the user dataset atomically.
   No merge in V1.
3. **Validation before mutation** — parse → identify format/version → validate
   references/duplicates/domain rules → preview → confirm → transactional import.
4. **Platform notification IDs** — not exported as authoritative state
   (`null` in backup). Pre-restore IDs collected and cancelled after successful
   DB commit; then `reconcileAllProfileNotifications`.
5. **Notification cancel scope** — cancel only reminder rows' platform IDs
   (`cancelManagedPlatformNotifications`), not global `cancelAllScheduledNotificationsAsync`,
   to avoid breaking future notification categories.
6. **Temp backup files** — `cacheDirectory/backups/davlenie_backup_{date}_{time}.json`;
   overwritten on repeat export; not deleted during Share Sheet.
7. **Import picker** — `expo-document-picker` (system picker, no broad storage).
8. **Privacy** — backup never auto-uploaded; no analytics/logging of backup contents.
9. **schemaVersion in backup** — diagnostic only; data imports into current app schema.

