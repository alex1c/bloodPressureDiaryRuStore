# Google Play Data Safety — evidence matrix (1.1.1)

> **Final Console values (2026-10-09):** use
> [GOOGLE_PLAY_DATA_SAFETY_FINAL.md](./GOOGLE_PLAY_DATA_SAFETY_FINAL.md).
> This file remains historical evidence notes.

**Package:** `com.calculatorplatform.bpdiary`
**Prepared:** 2026-10-08 (revised after Codex audit #2); pointer updated 2026-10-09

**Principle:** declare only what the app / shipped SDKs actually collect or share
off-device. Do not mark unverified vendor categories as confirmed. Do not treat
on-device SQLite as “collected” for Console “Data collected” when it never leaves
the device under developer control.

## Definitions (Console)

- **Collected** = data transmitted off the device by the app or embedded SDK, or
  processed in a way Google’s form treats as collection for the listed type.
- **Shared** = transmitted to a third party (here: Yandex AppMetrica / Yandex
  Mobile Ads backends), after the user allows the corresponding purpose.
- **On-device only** (local diary rows) = **not** declared as collected/shared for
  Data Safety when no developer/SDK off-device transfer occurs.

## Proposed Console answers (owner checklist)

| Console question | Proposed answer | Rationale |
|------------------|-----------------|-----------|
| Does your app collect or share any of the required user data types? | **Yes** | Optional AppMetrica + Yandex Ads after consent may process device/app IDs, Advertising ID, IP, and technical diagnostics |
| Is all user data encrypted in transit? | **Yes** for HTTPS SDK traffic — **VERIFY** current vendor docs for shipped SDK versions | Local SQLite is not “in transit” |
| Do you provide a way for users to request that their data is deleted? | **In-app deletion / uninstall only** | **Do not** claim a developer-operated server-side deletion request workflow; there is no account backend |
| Account deletion URL | **Not applicable** (no accounts) | VERIFY current Console wording |
| Independent security review? | **No** | Unless obtained later |

## Category matrix (external transfers only)

| Data category | Collected / Shared | Purpose | Evidence | Console notes |
|---------------|--------------------|---------|----------|---------------|
| Health info (BP, pulse, metrics, meds, notes, tags) | **No off-device** | App functionality (local) | SQLite; medical AppMetrica events blocked | **Do not** mark as collected solely because of local SQLite |
| Personal info — profile display names | **No off-device** | Local UI only | Profiles feature | Not shared |
| App activity (allowlisted technical events) | **Yes → AppMetrica** if analytics purpose granted | Analytics | `src/analytics/allowlist.ts` | Not “anonymous”; may tie to technical IDs |
| Device or other IDs | **Likely Yes → SDKs** if purpose granted | Analytics / Advertising | AppMetrica + Yandex Ads | **VERIFY** vendor Data Safety guides for  AppMetrica 4.2 / Yandex Ads 8.3 |
| Advertising ID (GAID) | **Likely Yes → Yandex Ads** if ads purpose granted | Advertising | Yandex Mobile Ads | Declare when ads enabled |
| Approximate location | **Not sent by first-party code**; AppMetrica location tracking disabled | — | `locationTracking: false` | Approximate via IP at vendor backend = **VERIFY vendor**, do not claim precise location |
| Diagnostics / crash-like telemetry | **Possibly via AppMetrica** if analytics granted | Analytics | No separate Crashlytics/Sentry in this app | Mark only after **VERIFY** vendor docs — do not promise crash reporting if not confirmed |
| Photos / contacts / financial / payment | **No** | — | No APIs / no IAP | Do not declare |

## Important corrections

1. **Local SQLite ≠ collected.** Health diary rows that never leave the device
   through the developer or optional SDKs are not Data Safety “collected” health
   data for off-device sharing.
2. **Local delete ≠ server deletion request.** In-app delete/uninstall removes
   local data only. Third-party retention follows Yandex policies.
3. **Do not label analytics as fully anonymous** when technical identifiers / IP
   may apply.
4. **Unverified SDK categories stay VERIFY** until the owner confirms vendor
   guides for the exact shipped versions.
5. **Do not promise protections** (e.g. “no network before consent”) as proven
   until physical Android QA confirms no early SDK traffic after
   `AUTOMATIC_SDK_INITIALIZATION=false`.

## Consent (purposes)

Independent in-app purposes:

- Technical analytics (AppMetrica)
- Advertising (Yandex Mobile Ads)

Yandex Ads does not expose a guaranteed non-personalized-only mode in this
integration; denying ads blocks all Yandex load/show. Google AdMob and other
mediation partners are not shipped. See
[INTERNATIONAL_CONSENT.md](./INTERNATIONAL_CONSENT.md).

Native Yandex auto-init is disabled via
`com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION=false` (Expo plugin +
AndroidManifest). Physical QA must still confirm no optional SDK network before
consent.

## Android Auto Backup

**Disabled.** See [AUTO_BACKUP.md](./AUTO_BACKUP.md).

## User-controlled export

| Export | Off-device? | Shared with developer? |
|--------|------------|------------------------|
| PDF doctor report | Only if user shares | No |
| JSON backup | Only if user shares | No |
