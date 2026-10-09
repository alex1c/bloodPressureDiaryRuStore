# Google Play Closed Alpha — release report 1.1.1 (5)

**Status:** READY FOR GOOGLE PLAY CLOSED TEST UPLOAD
**Date:** 2026-10-09
**Track name (Console):** Alpha 1.1.1 (5)
**Release name:** 1.1.1 (5) - Closed Alpha

---

## GIT

| Field | Value |
|-------|--------|
| Starting / source SHA | `6f2919377a95df11e8014e27e5c656b03f104bac` |
| Branch | `master` |
| Origin | `https://github.com/alex1c/bloodPressureDiaryRuStore.git` |
| Working tree at build | Clean tracked tree + local untracked QA scripts (not committed) |
| Follow-up commit | Test alignment + this report (see git log after push) |

---

## VERSION

| Field | Value |
|-------|--------|
| Package / applicationId | `com.calculatorplatform.bpdiary` |
| versionName | `1.1.1` |
| versionCode | `5` |
| Store flavor | `APP_STORE=googleplay` / embedded `extra.storeId=googleplay` |
| App variant | `production` |
| targetSdk / compileSdk | 36 |
| minSdk | 24 |

Confirmed in: `android/app/build.gradle`, merged release `AndroidManifest.xml`, embedded `app.config`.

---

## SIGNING

| Field | Value |
|-------|--------|
| Keystore (configured) | `credentials/keystore.properties` → `C:/Users/alex1/secure/calculator-platform/bp-diary-release.jks` |
| Operator path (same file SHA-256) | `J:\дневник давления\bp-diary-release.jks` |
| Keystore file SHA-256 | `14D7635BA49C47AD7801FC44CC9EC21F0990DEA798A422F1611307982EF8BC89` |
| Alias | `bp-diary` |
| Key algorithm | RSA 2048, SHA256withRSA |
| Certificate valid | 2026-09-02 → 2054-01-18 |
| Certificate SHA-256 | `1F:36:CD:32:1E:81:11:EF:24:51:DC:29:0C:2B:B0:EA:B4:87:DA:12:95:7F:AB:C7:49:86:BC:8C:F9:00:AD:90` |
| AAB signing verification | PASS — not Android Debug; fingerprint matches upload keystore |
| Passwords | Not printed / not committed |

### Play App Signing caveats

- This JKS is the **upload key** used to sign the AAB for Play Console upload.
- If Play App Signing is enabled, Google may re-sign installed APKs with a **different app signing key**.
- Therefore RuStore-installed and Play-installed builds may not share the same installed APK certificate even when the same upload JKS is reused.
- Do **not** create a new keystore unless Play Console explicitly requires an upload-key reset.

---

## DATA SAFETY (production behavior vs Console)

### Aligned with app + FINAL matrix

| Topic | Production behavior | Console (owner-stated) |
|-------|---------------------|-------------------------|
| Categories collected/shared | App interactions, crash, diagnostics, other performance, device/other IDs (optional, after consent) | Same five groups declared |
| Encryption in transit | Vendor HTTPS/TLS (Ads) / AES-128 in transit (AppMetrica) | Declared |
| No user accounts | No auth/cloud diary | Declared |
| Health diary local | SQLite; Auto Backup disabled; medical keys forbidden in analytics | Declared local |
| Approximate / precise location | Not declared; `locationTracking: false`; no Ads `locationConsent` | Not declared |
| Consent gates | Cold start Denied; independent ads/analytics; `setUserConsent`; Ads auto-init false; AppMetrica easy-integration false | Optional collection after consent (as stated) |

### SDK versions (resolved)

- `yandex-mobile-ads@8.3.0`
- `@appmetrica/react-native-analytics@4.2.0`

### Residual / owner Console gap

| Item | Severity | Note |
|------|----------|------|
| Deletion-request mechanism | **Owner Console fix** | Published policy + FINAL matrix recommend **Yes** via email `rustore-alex1c@yandex.ru`. Owner reported Console currently does **not** declare a deletion-request mechanism. Update Console to **Yes** to match policy, or change policy if intentionally refusing requests. **Does not block AAB upload.** |
| IP → Approximate location | Residual | Vendor tables = No for this config; Google general IP note remains; concrete Yandex support question is in FINAL matrix |
| Pre-consent SDK network | Residual | Code/manifest intend gate; not packet-proven; not a new QA gate for this AAB |

### Local health data

- Not synced to a developer server.
- Not sent to Ads/AppMetrica event payloads (allowlist + forbidden keys).
- PDF/JSON leave the device only via user Share Sheet.
- `allowBackup="false"` in merged release manifest.

---

## VALIDATION

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint | Pass |
| Jest | **267 passed** / 39 suites (after aligning 2 phase3 doc assertions) |
| `validate:release-config --store=googleplay` | Pass |
| Signing credentials available | Pass (local properties; secrets not logged) |
| Release signing verify on AAB | Pass |
| AAB ZIP integrity | Pass (`zipfile.testzip` OK, BundleConfig + base present) |
| bundletool JAR | Not found in SDK tree depth search — ZIP + keytool + merged manifest used instead |

---

## AAB

| Field | Value |
|-------|--------|
| Absolute path | `D:\petProject\bloodPressureDiaryRuStore\release-artifacts\googleplay\bp-diary-googleplay-1.1.1-5.aab` |
| Size | 77 905 704 bytes (~74.3 MiB) |
| File SHA-256 | `2CBAA950DDC3454699E032A5DDC2966B8558B2742B59A17497284E5A5DB00096` |
| Package | `com.calculatorplatform.bpdiary` |
| versionName / versionCode | `1.1.1` / `5` |
| Signing | Production upload key (alias `bp-diary`) |
| `AD_ID` permission | Present (Yandex Ads) |
| Ads auto-init metadata | `AUTOMATIC_SDK_INITIALIZATION=false`, `APPMETRICA_EASY_INTEGRATION_ENABLED=false` |
| Embedded storeId | `googleplay` |
| Production ad units in JS | Google Play `R-M-20201011-*` selected at runtime; RuStore/demo string constants also exist in bundle source maps but are not used when `storeId=googleplay` + production variant |
| Git | Under `/release-artifacts/` (gitignored) — **not** committed |

---

## NEXT ACTION — upload to Closed Alpha

1. Open Google Play Console → app `com.calculatorplatform.bpdiary` → Testing → Closed testing → track **Alpha 1.1.1 (5)**.
2. Create/edit release named **1.1.1 (5) - Closed Alpha**.
3. Upload
   `D:\petProject\bloodPressureDiaryRuStore\release-artifacts\googleplay\bp-diary-googleplay-1.1.1-5.aab`.
4. Confirm Play App Signing enrollment / upload-key acceptance if prompted (first Google Play upload for this package may ask to enroll Play App Signing).
5. Align Data Safety deletion-request answer to **Yes** (email) to match the published privacy policy, unless intentionally changing the policy.
6. Ensure privacy policy URL in Console is
   `https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html`.
7. Complete Health apps declaration if not already submitted.
8. Save → Review → Roll out to closed testers (12testers / your tester list).
9. Do **not** promote to production from this artifact without a separate decision.

**No automatic Console upload was performed by this task.**
