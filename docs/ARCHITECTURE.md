# Architecture

## Goals

Simple Android-first Expo app with a durable local domain core. UI stays thin;
persistence and statistics live outside React components.

## Stack

| Layer | Choice |
|-------|--------|
| UI | React Native + Expo Router |
| Language | TypeScript (strict) |
| Native | Expo CNG, `expo-dev-client`, JDK 17 |
| Persistence | **expo-sqlite** |
| State | Local component/hook state + repositories (no Redux) |
| Analytics / ads | Interfaces only until Phase 9 |

Package ID: `com.calculatorplatform.bpdiary` (see `DECISIONS.md`).

## Directory layout

```text
src/
  domain/          # pure types, validation, statistics, backup contract
  storage/         # sqlite, migrations, repositories
  services/        # platform facades (later: share, notifications)
  screens/         # route-level screens (minimal until Phase 3)
  components/      # shared UI primitives (later)
  hooks/           # thin React bindings to repositories
  theme/           # tokens prepared for 360/390dp (minimal now)
  analytics/       # noop / future AppMetrica adapter
  ads/             # noop / future Yandex adapter
  config/          # app identity, constants
  app/             # Expo Router entry
```

## Separation of concerns

| Concern | Lives in | Must not |
|---------|----------|----------|
| UI | `screens/`, `components/` | compute medical stats inline |
| Domain | `domain/` | import React or SQLite |
| Persistence | `storage/` | render UI |
| Platform | `services/`, `analytics/`, `ads/` | own business rules |

## Storage

### Why expo-sqlite

Long-term diary data needs:

* restart-safe persistence
* CRUD + indexes by `profileId` / `measuredAt`
* `schemaVersion` + ordered migrations
* transactions for restore / multi-entity writes
* backend-free backup/restore

See `docs/DECISIONS.md`.

### Schema versioning

* Table `meta(key, value)` stores `schemaVersion`
* Migrations are ordered modules `001_init`, …
* On open: read version → apply pending migrations inside a transaction
* Never skip versions

### Repository pattern

Repositories expose typed async CRUD. Production uses SQLite; tests use an
in-memory implementation of the same interfaces so persistence rules are tested
without native flakiness.

### Nullable / optional semantics

Absence is `null` (or omitted in create DTOs). Do not treat `0`, `''`, or
`undefined` interchangeably when meanings differ (e.g. pulse `0` is invalid;
empty note means “no note”).

## Backup format (contract)

Versioned JSON document (not a raw DB file dump):

```ts
{
  backupVersion: number
  appVersion: string
  createdAt: string // ISO
  profiles: Profile[]
  measurements: Measurement[]
  healthMetrics: HealthMetric[]
  medications: Medication[]
  medicationIntakes: MedicationIntake[]
  reminders: Reminder[]
  settings: AppSettings
}
```

Restore pipeline (future UI, contract now):

1. Read file
2. Check shape
3. Check `backupVersion`
4. Validate entities
5. Only then mutate local DB (transactional replace/merge)

Destructive restore without validation is forbidden.

## Statistics

Pure functions under `domain/statistics`:

* average systolic / diastolic / pulse
* min / max
* date range filter
* morning / evening (period-of-day) filter
* group by day
* group by tag / context

No medical interpretation. Stats use saved numeric values only.

## Input normalization

Android locale keyboards may emit `,` or `.`.

* Weight, glucose, temperature: accept `86,5` and `86.5` via
  `normalizeDecimalInput` / `parseUserDecimalNumber`
* BP and pulse: integer parsers
* Editable UI keeps **string drafts**; parse on submit (proven pattern from
  sibling calculator apps)

## Future seams

* `analytics/` — AppMetrica behind `AnalyticsService`
* `ads/` — Yandex Mobile Ads behind `AdService` with “no ads before first
  measurement” policy hooks
* Reminders — model fields ready for Android local notifications

## Non-goals (architecture)

No backend, no custom auth, no Redux, no medical decision engine.
