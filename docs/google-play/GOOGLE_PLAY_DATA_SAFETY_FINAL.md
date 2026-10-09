# Google Play Data Safety — final Console matrix (1.1.1 / versionCode 5)

**Package:** `com.calculatorplatform.bpdiary`
**Prepared:** 2026-10-09
**SDK versions (resolved):** `yandex-mobile-ads@8.3.0`, `@appmetrica/react-native-analytics@4.2.0`
**Privacy policy URL (target):** https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html

**Principle:** Declare off-device collection/sharing by the app and embedded SDKs after the user allows optional purposes. Local SQLite health diary rows that never leave the device under developer/SDK control are **not** marked as collected Health info.

---

## Top-level Console answers

| Console question | Recommended value | Basis |
|------------------|-------------------|--------|
| Does your app collect or share any of the required user data types? | **Yes** | Optional AppMetrica + Yandex Mobile Ads after consent |
| Is all collected user data encrypted in transit? | **Yes** | Yandex Ads: HTTPS/TLS; AppMetrica: AES-128 in transit (vendor Data Safety guides, checked 2026-10-09) |
| Users can request that data is deleted? | **Yes — in-app / uninstall for local data**; do **not** claim a developer-operated server deletion that clears Yandex backends | No account backend; local delete/uninstall only. Vendor SDKs document their own deletion tools; this app does not expose a Yandex server-wipe request UI |
| Account deletion URL | **Not applicable** (no accounts) | Code: no auth/cloud diary |
| Independent security review? | **No** | Unless obtained later |
| Contains ads? | **Yes** | Yandex Mobile Ads |
| Advertising ID used? | **Yes** | Ads SDK declares `AD_ID` (vendor: from SDK 4.5.0+) |

---

## Category matrix (recommended Console values)

Legend for **Collected / Shared**: values assume the corresponding optional purpose may be granted (worst-case truthful disclosure for an international listing). All SDK categories below are **Optional** (user can refuse analytics and/or ads).

| Google Play category | Collected | Shared | Required / Optional | Purpose(s) | Recommended Console value | Basis / source |
|----------------------|-----------|--------|---------------------|------------|---------------------------|----------------|
| **Health info** (BP, pulse, metrics, meds, notes, tags) | No (off-device) | No | — | Local app functionality only | **Do not declare as collected/shared** | Local SQLite; AppMetrica forbidden keys; Yandex Ads Data Safety: Health info = No; AppMetrica Data Safety: Health info = No |
| **Fitness info** | No | No | — | — | **No** | Not used |
| **Approximate location** | No* | No* | — | — | **No** for this configuration | Ads: No unless `locationConsent` (we do not enable). AppMetrica: No unless Location tracking (we set `locationTracking: false`). *IP-based geo at vendor edge is **VERIFY WITH VENDOR** if Console reviewers treat IP as approximate location — do not invent Yes without vendor confirmation |
| **Precise location** | No | No | — | — | **No** | Same as above; no fine location consent path |
| **App interactions** | Yes (if analytics granted) | Yes → AppMetrica | Optional | Analytics | **Declare Yes, Optional, Analytics** | AppMetrica default table = No, but “developer can configure via custom events”; we send allowlisted technical events (`src/analytics/allowlist.ts`) |
| **In-app search history** | No | No | — | — | **No** | Not implemented |
| **Crash logs** | Yes (if analytics granted) | Yes → AppMetrica | Optional | Analytics | **Declare Yes, Optional, Analytics** | AppMetrica Data Safety default: Crash reports = **Yes** |
| **Diagnostics** | Yes (if analytics granted) | Yes → AppMetrica | Optional | Analytics | **Declare Yes, Optional, Analytics** | AppMetrica Data Safety default: Diagnostics = **Yes** |
| **Other app performance data** | Yes (if analytics granted) | Yes → AppMetrica | Optional | Analytics | **Declare Yes, Optional, Analytics** | AppMetrica Data Safety default: Other app performance data = **Yes** |
| **Device or other IDs** | Yes (if ads and/or analytics granted) | Yes → Yandex Ads and/or AppMetrica | Optional | Advertising or marketing; Analytics | **Declare Yes, Optional**; purposes Advertising + Analytics as applicable | Ads Data Safety: Device or other IDs = Yes if permission; AppMetrica: Yes if permission (`advIdentifiersTracking: true` when analytics allowed) |
| **Advertising ID** (GAID) | Yes (if ads; also possible via AppMetrica adv ID tracking) | Yes | Optional | Advertising or marketing; Analytics | **Declare Yes** (Advertising ID declaration + Device/other IDs) | Yandex Ads AD_ID; AppMetrica advIdentifiersTracking when analytics on |
| Personal info (name, email, phone, user IDs, etc.) | No | No | — | — | **No** | No accounts; profile display names stay local |
| Photos / videos / audio / files / contacts / calendar | No | No | — | — | **No** | Not used (user PDF/JSON export is user-initiated Share Sheet, not automatic collection) |
| Financial / payment | No | No | — | — | **No** | No IAP |

### Local-only vs user-export vs SDK (do not conflate)

| Data | Where it lives | Declare in Data Safety as collected? |
|------|----------------|--------------------------------------|
| Health diary rows | Device SQLite | **No** (not transmitted by developer/SDK) |
| PDF / JSON export | Device file → only if user shares | **No** as automatic collection; user-controlled share |
| Allowlisted analytics events | AppMetrica after consent | **Yes** (App interactions) |
| Ads / analytics technical IDs | Yandex SDKs after consent | **Yes** (Device/other IDs, Advertising ID) |
| Crash / diagnostics | AppMetrica after consent | **Yes** |

---

## Six categories previously discussed in Console

If Console already lists approximately these six, align as follows:

| Likely prior selection | Keep / change | Note |
|------------------------|---------------|------|
| Device or other IDs | **Keep Yes** | Ads + AppMetrica |
| Advertising ID | **Keep Yes** | Ads path |
| App interactions | **Keep Yes** | Custom AppMetrica events |
| Crash logs | **Keep Yes** | AppMetrica vendor default |
| Diagnostics | **Keep Yes** | AppMetrica vendor default |
| Other app performance data | **Keep Yes** | AppMetrica vendor default |
| Health info | **Must be No** for off-device collection | Local only |
| Approximate location | **Recommend No** | Config disables location; IP geo = VERIFY WITH VENDOR if challenged |

---

## Purposes summary

| Purpose | When |
|---------|------|
| Advertising or marketing | Ads purpose granted → Yandex Mobile Ads |
| Analytics | Analytics purpose granted → AppMetrica (events + crash/diagnostics per vendor) |
| App functionality | Local diary only — **not** via SDK off-device transfers for health rows |

---

## VERIFY WITH VENDOR (do not guess in Console)

1. Whether **IP address alone** must be declared as Approximate location for Yandex Ads / AppMetrica backends.
2. Exact native AppMetrica Android SDK version under RN wrapper `4.2.0` vs docs written for SDK **5.0.0+** location defaults (we still force `locationTracking: false`).
3. Whether Ads ↔ AppMetrica cabinet synchronization is enabled in Yandex consoles (not visible from repo).
4. Whether owner will implement / document AppMetrica user-data deletion API calls (currently: not exposed in UI).

---

## Official sources (checked 2026-10-09)

- [Google Play Data safety form help](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Yandex Mobile Ads — Data safety (Android)](https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android)
- [AppMetrica — Google Play Data safety](https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety)
- [Yandex Advertising ID note](https://ads.yandex.com/helpcenter/en/dev/android/ad-id)

See also [DATA_SAFETY.md](./DATA_SAFETY.md) (historical evidence notes) and [PRIVACY_RELEASE_REPORT.md](./PRIVACY_RELEASE_REPORT.md).
