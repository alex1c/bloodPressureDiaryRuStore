# International privacy checklist — closed testing (12testers)

**App:** Blood Pressure Diary / «Дневник давления»
**Target:** Google Play closed testing 1.1.1 (versionCode 5)
**Date:** 2026-10-09 (gates / deletion / location aligned)
**Final status recommendation:** see [PRIVACY_RELEASE_REPORT.md](./PRIVACY_RELEASE_REPORT.md)

---

## Closed (ready for owner action)

| Item | Status | Notes |
|------|--------|-------|
| International Privacy Policy EN (18 sections) | Done | `docs/privacy/en.html` |
| International Privacy Policy RU (semantic equivalent) | Done | `docs/privacy.html` |
| ES / DE aligned (kept, not deleted) | Done | `docs/privacy/es.html`, `docs/privacy/de.html` |
| Contact `rustore-alex1c@yandex.ru` | Done | All language pages; deletion-request email path |
| Local health vs SDK telemetry distinguished | Done | Policy + Data Safety matrix |
| No invented EU representative / SCC / retention periods | Done | Explicit limits stated |
| Independent analytics / ads consent in app | Confirmed in code | Session Save; cold start Denied |
| Optional SDK gate before first-party init | Confirmed in code | `optional-sdk-bootstrap`, ads/analytics services |
| Yandex `setUserConsent` bridge | Confirmed in code | `sdk-consent-bridge` / `yandex-ad-service` |
| Native auto-init disabled (intent) | Confirmed in code | `AUTOMATIC_SDK_INITIALIZATION=false`, `APPMETRICA_EASY_INTEGRATION_ENABLED=false` |
| AppMetrica `locationTracking: false` | Confirmed in code | `appmetrica-service.ts` |
| Medical values blocked from analytics | Confirmed in code | allowlist + forbidden keys |
| Google AdMob / UMP / certified CMP | Not shipped | CMP not required solely because AdMob rules exist; Yandex-only path |
| Data Safety Console matrix | Done (doc) | `GOOGLE_PLAY_DATA_SAFETY_FINAL.md` |
| Privacy URL wired in app config | Done | `https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html` |
| Functional OPPO QA / Codex audit / Jest control | Done earlier | Do **not** re-require for docs-only sync |

---

## Covered by international policy + existing consent (practical)

| Region / regime | What this package covers | What it does **not** auto-prove |
|-----------------|--------------------------|----------------------------------|
| **GDPR / EEA** | Transparent notice; consent for optional ads/analytics; refusal; withdrawal path; rights + deletion-request contact; international transfer acknowledgment | Full legal compliance, DPIA, EU representative, SCCs wording, packet-level pre-consent proof |
| **UK GDPR** | Same notice/consent model | Separate UK representative / ICO-specific filings |
| **Google Play User Data / Data Safety** | Accurate policy text + Console matrix for shipped SDKs | Owner must paste values into Console; listing must match live policy URL |
| **Google Health apps policy** | Diary disclosed as consumer tool, not medical device; Health info not declared as SDK-collected | Owner must complete Health apps declaration accurately in Console |
| **Google EU User Consent Policy (AdMob/Google demand)** | N/A for current Yandex-only ads stack | Becomes blocking if AdMob / Google demand is added later → certified CMP |

Closed testing with EEA testers can still trigger GDPR obligations for processing that occurs; the policy and consent gate are the practical mitigations shipped here — not a compliance certificate.

---

## Owner decisions still required (max 5)

1. **Publish** updated `docs/privacy*.html` to GitHub Pages so
   `https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html` serves the new text.
2. **Enter** Data Safety values from `GOOGLE_PLAY_DATA_SAFETY_FINAL.md` (deletion-request **Yes** via email scope; Approximate location **No** vendor-aligned).
3. **Answer** deletion-request emails at `rustore-alex1c@yandex.ru` (required if Console Yes is selected).
4. **Accept** legal residual for EEA/UK testers under first-party Yandex gate + policy, or obtain counsel before inviting EEA testers.
5. **Accept AppMetrica Terms / DPA** in the AppMetrica cabinet if not already done; optionally ask Yandex the IP → Approximate location support question before wide production.

---

## Non-blocking / later

| Item | Notes |
|------|-------|
| Packet capture proving zero pre-consent SDK traffic | Intent documented; not packet-proven; **not** a mandatory re-QA gate for docs sync |
| Google-certified CMP | Only if AdMob / Google advertising demand is added |
| US state privacy “Do Not Sell/Share” UI | Deferred |
| In-app AppMetrica server deletion API | Optional; email request path already supports Console Yes |
| Full public worldwide launch counsel | Beyond closed testing package |

---

## Must not do from docs-only sync

- Do not submit AAB from this privacy docs task alone.
- Do not push / auto-publish GitHub Pages without owner permission.
- Do not change ad unit IDs, package, versionName, versionCode, or store split.
- Do not add AdMob, Firebase, or a third-party CMP without a proven requirement.
- Do not reopen full Codex / OPPO functional QA solely because documentation was corrected.
