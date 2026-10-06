# Google Play policy recheck

**Check date:** 2026-10-06  
**Sources:** official Google Play / Android documentation only (no blogs).

| Requirement | Official URL | Impact on this app | Status |
|-------------|--------------|--------------------|--------|
| Data safety form | https://support.google.com/googleplay/android-developer/answer/10787469 | Must declare local health diary + SDK analytics/ads sharing accurately; privacy policy required | Docs prepared → MANUAL in Console |
| User Data policy | https://support.google.com/googleplay/android-developer/answer/10144311 | Privacy policy must match Data Safety; disclose SDK collection | Privacy texts updated |
| Declare data use (Android) | https://developer.android.com/privacy-and-security/declare-data-use | Guidance for mapping permissions/SDK APIs to Data Safety categories | Used as evidence method |
| Health apps declaration | https://support.google.com/googleplay/android-developer/answer/14738291 | Required even for non-clinical diaries; declare health features honestly | Draft answers prepared |
| Health content & services | https://support.google.com/googleplay/android-developer/answer/16679511 | No misleading medical claims; non-device disclaimer in listing/app | Disclaimer audited RU/EN/ES/DE |
| Advertising ID | https://support.google.com/googleplay/android-developer/answer/6048248 | AD_ID used via Yandex Mobile Ads (≥4.5.0 merges permission); declare Advertising ID = Yes | MANUAL Console declaration |
| Ads declaration (“Contains ads”) | https://support.google.com/googleplay/android-developer/answer/9859455 | Must declare Yes — banners + interstitial via Yandex | MANUAL |
| Target audience / content | https://support.google.com/googleplay/android-developer/answer/9867159 | Adult diary audience; avoid selecting children (Yandex Ads not treated as Families self-certified here) | Recommend 18+ |
| Families policies | https://support.google.com/googleplay/android-developer/answer/9893335 | Do **not** enroll Designed for Families / child audiences while using non-certified ad stack | Recommend exclude children |
| Target API level | https://support.google.com/googleplay/android-developer/answer/11926878 | New apps must target API 36+ (Android 16) after 2026-08-31 | Expo SDK 57 defaults compile/target **36** — VERIFY on next production prebuild merged manifest |
| Auto Backup | https://developer.android.com/identity/data/autobackup | Default allowBackup risk for health SQLite | Mitigated: `allowBackup=false` + extraction rules |
| App access for reviewers | https://support.google.com/googleplay/android-developer/answer/9859455 | No login / paywall | Declare all features available |

## Explicit non-claims

- No diagnosis / treatment / prescription / disease-prevention claims in listing or UI.
- No medical-device positioning.
- No Personal Account Deletion URL required for a **developer-hosted account** (there is none). Local deletion paths documented.

## VERIFY items (cannot fully prove from repo alone)

- Exact merged-manifest presence of `com.google.android.gms.permission.AD_ID` after production prebuild with current `yandex-mobile-ads@^8.3.0` → **VERIFY IN PLAY CONSOLE / VENDOR DOCS / MERGED MANIFEST**.
- Exact AppMetrica / Yandex Ads Data Safety rows for device IDs beyond our event policy → follow vendor Data Safety guides:
  - https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety
  - https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android
