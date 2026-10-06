# Third-party SDKs

**Prepared:** 2026-10-06  
**Package:** `com.calculatorplatform.bpdiary`

Pinned ranges from `package.json` (exact resolved versions: check lockfile / `npm ls` at release time).

---

## Yandex Mobile Ads

| Field | Value |
|-------|--------|
| Package | `yandex-mobile-ads` |
| Declared range | `^8.3.0` |
| Purpose | Banner + interstitial ads (РСЯ) |
| First-party config | `src/config/ads.ts`, `src/ads/` |
| Production block IDs | Diary `R-M-20056373-1`; Graphs `R-M-20056373-2`; Health `R-M-20056373-3`; Interstitial `R-M-20056373-4`; Medications `R-M-20056373-5` |
| Policy in app | First-measurement guard (except Medications banner); interstitial cooldown / meaningful-action gates — **unchanged in Phase 3** |

### Permissions / Advertising ID

- Official vendor note: from SDK **4.5.0+**, `com.google.android.gms.permission.AD_ID` is added by default.  
  Source: https://ads.yandex.com/helpcenter/en/dev/android/ad-id
- Our app code does **not** read Advertising ID directly in TypeScript.
- **Do not remove** AD_ID blindly — needed for ad relevance/revenue per vendor. Not a Families app.
- Play Console: declare **Advertising ID is used** (via SDK) for advertising/marketing.  
  **VERIFY** merged manifest after production prebuild.

### Network / data

- Ads require `INTERNET` / network state (typically via SDK/RN stack).
- Vendor Data Safety guidance: https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android  
  States SDK transmits user data off-device; encrypts listed types in transit over HTTPS/TLS; device/other IDs collected when permission allows — **VERIFY** table rows against current SDK version before final Console submit.

### Privacy policy implications

Disclose Yandex Mobile Ads + Advertising ID processing (done in `docs/privacy*.html`).

### Google Play implications

- Ads declaration: **Contains ads = Yes**
- Advertising ID declaration: **Yes**
- Do not enroll Families while relying on this non-certified-for-children ads path without age screening.

---

## AppMetrica

| Field | Value |
|-------|--------|
| Package | `@appmetrica/react-native-analytics` |
| Declared range | `^4.2.0` |
| Purpose | Technical product analytics |
| First-party config | `src/config/analytics.ts`, `src/analytics/` |
| API key presence | Validated by `scripts/validate-release-config.cjs` (key prefix logged, not secrets in docs) |

### Event payload policy (first-party)

- Wrapper sanitizes params against `FORBIDDEN_ANALYTICS_KEYS` (`src/analytics/forbidden-keys.ts`).
- **Never** send BP, pulse, medication names, notes, health values, profile names, backup/PDF content.
- `locale_changed` may send locale code only.

### Device / technical identifiers

- AppMetrica SDK may collect device/other IDs per vendor defaults.  
  Official Data Safety guide: https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety  
  **VERIFY** rows for Device or other IDs, App activity, Diagnostics, location tracking defaults (location should remain off unless explicitly enabled — we do not enable location in app code).

### Privacy / Data Safety

- Disclose AppMetrica in privacy policy (done).
- Declare analytics collection/sharing in Data Safety consistently with vendor guide + our forbidden-keys invariant.

### Ads ↔ AppMetrica sync

Vendor documents optional Ads SDK ↔ AppMetrica synchronization. Whether console-side sync is enabled in the Yandex cabinets is **VERIFY IN VENDOR CONSOLE** (not visible from this repo alone).

---

## Not present

| SDK | Status |
|-----|--------|
| Google AdMob | **Not used** |
| Firebase Analytics | **Not used** |
| Crashlytics | **Not used** |
| Auth / backend SDKs | **Not used** |
