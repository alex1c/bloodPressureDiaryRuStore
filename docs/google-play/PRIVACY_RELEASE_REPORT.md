# Privacy release report — international closed testing package

**Product:** Blood Pressure Diary / «Дневник давления» (`com.calculatorplatform.bpdiary`)
**Candidate:** Google Play 1.1.1, versionCode 5
**Report date:** 2026-10-09 (corrections sync same day)
**Git baseline for corrections:** `5dff7e2` (then docs commit on `master`)
**Resolved SDKs:** `yandex-mobile-ads@8.3.0`, `@appmetrica/react-native-analytics@4.2.0`

---

## Final status

### **PRIVACY DOCS READY** (owner publish / Console / AAB next)

Document set is internally consistent for Console after ChatGPT correction pass (deletion-request scope, Approximate location vendor-aligned answer, outdated release gates removed). Owner must still publish GitHub Pages and fill Console — those are operational steps, not doc contradictions.

Already completed earlier (not re-run for this docs-only correction): OPPO functional QA, Codex audit, ~267 Jest, 64 privacy-related Jest.
Honest residual kept: pre-consent SDK network not packet-proven — **not** reopened as a mandatory QA gate.

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

**Not done by design in the privacy package:** GitHub Pages publish, Play Console submit, AAB build (owner next).

### Corrections applied after independent ChatGPT review (2026-10-09)

| Topic | Outcome |
|-------|---------|
| Data deletion Console answer | **Yes** via email request to `rustore-alex1c@yandex.ru` (Google-allowed mechanism). Local SQLite delete alone is **not** the basis. No claim of developer wipe of Yandex |
| Approximate location | **No** (vendor-aligned). Google IP note recorded as residual; concrete Yandex support question provided |
| Release gates | Removed obsolete “Codex PASS + physical QA again before publish” requirement; prior QA/audit marked completed |

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
| Whether Yandex IP processing requires Approximate location despite vendor tables saying No | Residual vs Google’s general IP note; Console stays **No** until Yandex says otherwise |
| Native AppMetrica Android SDK build under RN 4.2.0 vs docs labeled for 5.0.0+ | Location still explicitly disabled in our config |
| Ads ↔ AppMetrica sync toggles in Yandex cabinets | Not visible in repo |
| Live GitHub Pages content matches new HTML | Publish not performed |

---

## BLOCKING (owner only — operational)

1. Publish privacy HTML to the public HTTPS URL used in Play Console and in-app.
2. Fill Data Safety in Console using `GOOGLE_PLAY_DATA_SAFETY_FINAL.md` (deletion **Yes** via email; Approximate location **No**).
3. Answer deletion-request emails at `rustore-alex1c@yandex.ru`.
4. Decide to proceed with EEA/UK testers under the first-party Yandex consent gate + policy (or pause pending counsel).
5. Ensure AppMetrica organizational terms / DPA accepted; optionally ask Yandex the IP → Approximate location support question.

---

## NON-BLOCKING

| Item |
|------|
| Packet-level pre-consent network proof (honest residual, not a re-QA gate) |
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

- International Privacy Policy RU/EN (18 sections) + ES/DE; Data Safety FINAL matrix; checklist; this report.
- Correction pass: deletion-request Yes via email (not SQLite alone); Approximate location No vendor-aligned + Yandex question; obsolete Codex/OPPO re-QA gates removed.
- Targeted privacy HTML edits for deletion-request and location wording.
- No package/version/ad-ID/signature/executable-code changes in the correction pass.
