# Google Play Data Safety — final Console matrix (1.1.1 / versionCode 5)

**Package:** `com.calculatorplatform.bpdiary`
**Prepared:** 2026-10-09 (deletion / location / gates corrected 2026-10-09)
**SDK versions (resolved):** `yandex-mobile-ads@8.3.0`, `@appmetrica/react-native-analytics@4.2.0`
**Privacy policy URL (target):** https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html

**Principle:** Declare off-device collection/sharing by the app and embedded SDKs after the user allows optional purposes. Local SQLite health diary rows that never leave the device under developer/SDK control are **not** marked as collected Health info.

---

## Top-level Console answers

Official Console wording (Google Play Data safety help): *“Whether or not you provide a way for users to request that their data is deleted”* / *Deletion request mechanism*. Account deletion is a **separate** flow and applies only when the app creates accounts.

| Console question | Recommended value | Basis |
|------------------|-------------------|--------|
| Does your app collect or share any of the required user data types? | **Yes** | Optional AppMetrica + Yandex Mobile Ads after consent |
| Is all collected user data encrypted in transit? | **Yes** | Yandex Ads: HTTPS/TLS; AppMetrica: AES-128 in transit (vendor Data Safety guides, checked 2026-10-09) |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Google allows email as a deletion-request mechanism. Users email `rustore-alex1c@yandex.ru`. See scope below — **do not** treat in-app SQLite delete alone as the basis for Yes |
| Account deletion / account-deletion URL | **Not applicable** (no accounts) | Separate from the deletion-request question; no auth/cloud diary |
| Independent security review? | **No** | Unless obtained later |
| Contains ads? | **Yes** | Yandex Mobile Ads |
| Advertising ID used? | **Yes** | Ads SDK declares `AD_ID` (vendor: from SDK 4.5.0+) |

### Deletion-request scope (must match Console + privacy policy)

| Data | How deletion works | Developer guarantee |
|------|--------------------|---------------------|
| Local diary (SQLite) — **not** Data Safety “collected” | User deletes in-app or uninstalls | Full local control by the user |
| Collected/shared SDK technical data (IDs, diagnostics, allowlisted events) | User **requests** deletion by email to `rustore-alex1c@yandex.ru`; developer responds and points to Yandex privacy channels where needed | Request path exists; developer **cannot** independently wipe Yandex backends and must not claim that |

Selecting **Yes** assumes the owner actually answers deletion-request emails. If that process is refused, change Console to **No** instead of inventing a server wipe.

---

## Category matrix (recommended Console values)

Legend for **Collected / Shared**: values assume the corresponding optional purpose may be granted (worst-case truthful disclosure for an international listing). All SDK categories below are **Optional** (user can refuse analytics and/or ads).

| Google Play category | Collected | Shared | Required / Optional | Purpose(s) | Recommended Console value | Basis / source |
|----------------------|-----------|--------|---------------------|------------|---------------------------|----------------|
| **Health info** (BP, pulse, metrics, meds, notes, tags) | No (off-device) | No | — | Local app functionality only | **Do not declare as collected/shared** | Local SQLite; AppMetrica forbidden keys; Yandex Ads Data Safety: Health info = No; AppMetrica Data Safety: Health info = No |
| **Fitness info** | No | No | — | — | **No** | Not used |
| **Approximate location** | No | No | — | — | **No** (vendor-aligned) | See dedicated section below |
| **Precise location** | No | No | — | — | **No** | No fine location; no locationConsent; `locationTracking: false` |
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
| Approximate location | **No** (vendor-aligned) | See Approximate location section |

---

## Approximate location — single recommended answer

| Field | Value |
|-------|--------|
| **Recommended Console answer** | **No** |
| **Confirmation level** | **Vendor-aligned** (not absolute vs Google’s general IP note) |
| **App configuration** | AppMetrica `locationTracking: false`; no Ads `locationConsent`; no ACCESS_COARSE/FINE location purpose path for these SDKs |
| **Primary sources** | [Yandex Mobile Ads Data safety](https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android): Approximate location = **No** unless `locationConsent`. [AppMetrica Data safety](https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety): Approximate location = **No** unless Location tracking enabled |
| **Google residual** | Google Play Data safety help notes that approximate location *inferred via IP address* must be disclosed under Approximate location. That general note is **not** the same as GPS/coarse location APIs. Vendor SDK tables still say **No** for our configuration |
| **IP vs Approximate location** | Network SDKs may see client IP as ordinary HTTPS traffic. That alone is **not** treated here as confirmed Approximate location collection, because Yandex’s published Data Safety tables for these SDKs say Approximate location = No without location consent/tracking. Do **not** mark Yes by assumption |

### Concrete question for Yandex support (if Google challenges or before wide production)

> For Yandex Mobile Ads Android SDK 8.3.x and AppMetrica (RN wrapper 4.2.0 / current Android SDK), with `locationConsent` unset and AppMetrica `locationTracking` disabled: does processing of the client IP address require declaring Google Play Data Safety **Approximate location** (city-level / IP-inferred), or should developers follow your published Data Safety tables that list Approximate location as **No**?

Until Yandex answers otherwise, keep Console at **No** and declare Device/other IDs + Advertising ID as already recommended.

---

## Purposes summary

| Purpose | When |
|---------|------|
| Advertising or marketing | Ads purpose granted → Yandex Mobile Ads |
| Analytics | Analytics purpose granted → AppMetrica (events + crash/diagnostics per vendor) |
| App functionality | Local diary only — **not** via SDK off-device transfers for health rows |

---

## Remaining vendor / org checks (non-guess)

1. Yandex support question on IP → Approximate location (above) — optional unless challenged or before wide production.
2. Exact native AppMetrica Android SDK under RN `4.2.0` vs docs labeled for 5.0.0+ (location still forced off in our config).
3. Ads ↔ AppMetrica cabinet sync toggles (not visible in repo).
4. Optional later: expose AppMetrica deletion APIs in-app (email request path already supports Console Yes).

---

## Official sources (checked 2026-10-09; deletion/IP notes re-checked same day)

- [Google Play Data safety form help](https://support.google.com/googleplay/android-developer/answer/10787469) — deletion request mechanism; Approximate location / IP note
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) — separate from deletion-request badge; N/A without accounts
- [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Yandex Mobile Ads — Data safety (Android)](https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android)
- [AppMetrica — Google Play Data safety](https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety)
- [Yandex Advertising ID note](https://ads.yandex.com/helpcenter/en/dev/android/ad-id)

See also [DATA_SAFETY.md](./DATA_SAFETY.md) (historical evidence notes) and [PRIVACY_RELEASE_REPORT.md](./PRIVACY_RELEASE_REPORT.md).
