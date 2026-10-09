# Privacy release report — international closed testing package

**Product:** Blood Pressure Diary / «Дневник давления» (`com.calculatorplatform.bpdiary`)
**Candidate:** Google Play 1.1.1, versionCode 5
**Report date:** 2026-10-09
**Git:** HEAD `11cc298` on `master` (dirty working tree preserved; no reset/checkout)
**Resolved SDKs:** `yandex-mobile-ads@8.3.0`, `@appmetrica/react-native-analytics@4.2.0`

---

## Final status

### **READY WITH SPECIFIC BLOCKERS**

Document set and consent architecture are ready for international closed testing **after** the owner publishes the privacy HTML and fills Play Console Data Safety from the final matrix. Residual legal/vendor items are listed under BLOCKING / UNVERIFIED — they do not require rewriting the in-app consent system for this Yandex-only stack.

Not **PRIVACY READY** (absolute): public URL not published from this task; Console not submitted; pre-consent network not packet-proven.
Not **BLOCKED**: no proven code defect forcing a consent rewrite or CMP before closed testing with disclosed Yandex SDKs.

---

## Deliverables

| Deliverable | Path |
|-------------|------|
| Privacy Policy RU | `docs/privacy.html` |
| Privacy Policy EN | `docs/privacy/en.html` |
| Privacy Policy ES / DE | `docs/privacy/es.html`, `docs/privacy/de.html` |
| Data Safety Console matrix | `docs/google-play/GOOGLE_PLAY_DATA_SAFETY_FINAL.md` |
| International checklist | `docs/google-play/INTERNATIONAL_PRIVACY_CHECKLIST.md` |
| This report | `docs/google-play/PRIVACY_RELEASE_REPORT.md` |

**Not done by design:** GitHub Pages publish, Play Console submit, AAB build, git push.

---

## CONFIRMED

| Item | Evidence |
|------|----------|
| No developer cloud diary / no user accounts | App architecture; policy §4 |
| Health diary in local SQLite; Auto Backup disabled | Existing AUTO_BACKUP docs + policy §5 |
| Optional SDKs: Yandex Mobile Ads + AppMetrica only | `package.json`; no AdMob dependency |
| Independent analytics vs ads purposes; cold start Denied until Save | `src/privacy/session-consent.ts`, consent tests |
| First-party SDK enablement gated on consent | `optional-sdk-bootstrap.tsx`, `services/index.ts` |
| Yandex Ads `setUserConsent` used; init gated on ads allowed | `yandex-ad-service.ts`, `sdk-consent-bridge.ts` |
| Manifest auto-init flags for Ads / AppMetrica easy integration disabled via plugin | `plugins/with-yandex-ads-manual-init.js`, phase3 compliance tests |
| AppMetrica `locationTracking: false`; `advIdentifiersTracking` when analytics on | `appmetrica-service.ts` |
| Medical values not in analytics allowlist | `allowlist.ts`, `forbidden-keys.ts`, analytics-privacy tests |
| Yandex Ads Data Safety (default): Device/other IDs Yes; Health No; Location No without locationConsent; Ads purpose Advertising | Official Ads Data Safety page (fetched 2026-10-09) |
| AppMetrica Data Safety (default): Crash/Diagnostics/Other performance Yes; Health No; App interactions No unless custom events (we send allowlisted events → Yes); Location No unless tracking enabled | Official AppMetrica Data Safety page (fetched 2026-10-09) |
| Google certified CMP not required solely for Yandex Ads without Google AdMob demand | Google EU User Consent Policy targets Google advertising / AdMob UMP path; not shipped here |
| Privacy HTML: 18 required sections; EN primary; RU equivalent; ES/DE retained | Files updated 2026-10-09 |
| Functional QA of product features already signed off on OPPO | Prior session; not re-run for this docs task |

---

## UNVERIFIED

| Item | Why |
|------|-----|
| Zero optional-SDK network before consent on device | Code + metadata intend gate; packet capture / MITM not required and not performed in this task |
| IP-only geolocation as Google “Approximate location” | Vendor tables say Approximate location No without location consent/tracking; IP edge cases left VERIFY WITH VENDOR |
| Native AppMetrica Android SDK build under RN 4.2.0 vs docs labeled for 5.0.0+ | Location still explicitly disabled in our config |
| Ads ↔ AppMetrica sync toggles in Yandex cabinets | Not visible in repo |
| Live GitHub Pages content matches new HTML | Publish not performed |
| Exact six Console checkboxes already selected by owner | Align to `GOOGLE_PLAY_DATA_SAFETY_FINAL.md` |

---

## BLOCKING (owner only — 5)

1. Publish privacy HTML to the public HTTPS URL used in Play Console and in-app.
2. Fill Data Safety in Console using `GOOGLE_PLAY_DATA_SAFETY_FINAL.md`.
3. Decide to proceed with EEA/UK testers under the first-party Yandex consent gate + policy (or pause EEA invites pending counsel).
4. Confirm Approximate location = No (or resolve IP question with Yandex if challenged).
5. Ensure AppMetrica organizational terms / DPA accepted in the vendor cabinet.

---

## NON-BLOCKING

| Item |
|------|
| Adding Google-certified CMP (only if AdMob/Google demand is introduced later) |
| US Do Not Sell/Share messaging |
| In-app AppMetrica server deletion API |
| Re-running full Android E2E / 267 Jest suite for docs-only changes |
| Claiming full worldwide legal compliance from one HTML file |

---

## Consent targeted analysis (no rewrite)

| Check | Result |
|-------|--------|
| Intentional optional SDK start before choice | First-party path blocked until session Save; cold start Denied |
| Independent ads vs analytics | Yes |
| Refusal possible | Yes; diary remains usable |
| Change choice later | Settings / consent UI |
| UI text vs behavior | Aligned: optional purposes; no “anonymous forever” claim required in UI |
| `setUserConsent` | Applied when ads purpose set |
| AppMetrica data-sending gate | `setDataSendingEnabled` / activate only when allowed |
| Refusal persistence across cold start | Session model: cold start Denied again until Save (stricter than sticky Accept) |
| Automatic native manifest init | Disabled via metadata/plugin |
| Google CMP required for this stack? | **No** automatic requirement found for Yandex-only without AdMob |

**Minimal code fix:** none required for proven privacy mismatch in this pass.

---

## Official sources (checked 2026-10-09)

| Source | URL | Applicability |
|--------|-----|---------------|
| Google Play Data safety | https://support.google.com/googleplay/android-developer/answer/10787469 | Form required for closed testing tracks |
| Google Play User Data | https://support.google.com/googleplay/android-developer/answer/10144311 | Privacy policy + transparency |
| Health apps declaration | https://support.google.com/googleplay/android-developer/answer/14738291 | Health diary app must declare features |
| Yandex Mobile Ads Data Safety | https://ads.yandex.com/helpcenter/en/dev/android/app-privacy-android | Applies to `yandex-mobile-ads@8.3.0` (vendor default table) |
| Yandex AD_ID | https://ads.yandex.com/helpcenter/en/dev/android/ad-id | AD_ID from Ads SDK 4.5.0+ |
| AppMetrica Data Safety | https://appmetrica.yandex.ru/docs/en/data-security/google-data-safety | Applies to AppMetrica integration; RN `4.2.0` wrapper |
| Yandex Ads GDPR / consent | Yandex Mobile Ads Android GDPR docs (`setUserConsent`) | Used in app bridge |
| GDPR / transfers (general) | EDPB / EU Commission public materials (high-level) | Informational only; no invented SCCs |

**Not fully re-verified in this pass:** Google Play SDK Index pages for these exact packages (vendor helpcenter tables used instead).

---

## Checks performed in this task

| Check | Result |
|-------|--------|
| Git status preserved (no destructive reset) | Yes — dirty tree kept |
| Privacy HTML structure / language links | Relative RU↔EN/ES/DE links present |
| Data Safety matrix vs vendor tables | Written; Health not declared as SDK-collected |
| Secrets / medical values in reports | None intentional |
| TypeScript (`tsc --noEmit`) | Pass (exit 0) |
| ESLint (privacy + ads/analytics gate files) | Pass (exit 0) |
| Jest privacy/consent/analytics-privacy/phase3/app-config | **64 passed** / 8 suites |
| Full Android E2E | Not re-run (docs/consent analysis only) |

---

## Changes summary

- Rewrote international Privacy Policy RU/EN with 18 sections; updated ES/DE to match without deleting them.
- Added Console-ready Data Safety final matrix, international checklist, and this report.
- No package/version/ad-ID/signature changes.
- No consent system rewrite; no CMP added; no AAB; no publish; no push.
