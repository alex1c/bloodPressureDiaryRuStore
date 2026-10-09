# International consent — owner checkpoint (Google Play 1.1.1)

**Status:** Consent architecture complete for Yandex-only stack. Remaining owner
actions are publish / Console / optional counsel — not a new Codex or device QA
cycle for docs sync.
**2026-10-09 package:** see [INTERNATIONAL_PRIVACY_CHECKLIST.md](./INTERNATIONAL_PRIVACY_CHECKLIST.md) and [PRIVACY_RELEASE_REPORT.md](./PRIVACY_RELEASE_REPORT.md). Consent rewrite was **not** required.

**Distribution (owner-confirmed):** worldwide. Architecture is not Russia/CIS-only.

## Runtime consent model (1.1.1)

| Rule | Behavior |
|------|----------|
| Cold start | Runtime analytics + ads permissions = **DENIED** |
| Disk Accept / legacy / trust | Preferences / history only — **never** auto-enable SDKs |
| Session confirm | Explicit Save in this process enables only chosen purposes |
| Mixed purposes | Independent (analytics↔ads); no global force-Reject |
| Reject | Immediate first-party gate flip before any await |
| Persist failure | Dialog stays open + Retry; never claim success |

## Implemented in code (this candidate)

| Capability | Status |
|------------|--------|
| Independent analytics / ads purposes; switches default OFF | Yes |
| Immediate Reject (sync gates before any await) | Yes |
| Session-only SDK enablement (no auto-restore from disk) | Yes |
| Mixed purpose combinations preserved in-session | Yes |
| Retry UI when persist fails; dialog stays open | Yes |
| Yandex auto-init disabled via manifest metadata + Expo plugin | Yes (manifest intent) |
| Interstitial: attempt ids + fresh UI refresh before show | Yes |
| Graphs-focus-only UI gate; unknown keyboard → block | Yes |
| Google-certified CMP / AdMob / US Do Not Sell / Share | Not in this release |

## Already completed (do not re-require)

| Check | Status |
|-------|--------|
| Functional QA on physical OPPO Android 16 | Done (prior release work) |
| Independent Codex audit of this candidate | Done (prior release work) |
| Full Jest suite (~267) at last control stage | Done (prior release work) |
| Privacy/consent-related Jest (64) after privacy package | Done |

## Explicitly NOT proven (honest residual — not a new QA gate)

- Absence of early optional SDK network traffic before consent on a physical
  device with a TLS proxy / packet capture. Code and metadata intend to prevent
  auto-init; **do not treat that as proven**, and **do not** reopen a mandatory
  full Android QA cycle for documentation-only changes.
- Ability to abort an already-started native SDK upload mid-flight (vendor SDK
  limitation — Reject stops first-party dispatch and new loads only).

## Owner decisions still required

1. Publish privacy HTML to GitHub Pages (public HTTPS URL).
2. Fill Play Console Data Safety from [GOOGLE_PLAY_DATA_SAFETY_FINAL.md](./GOOGLE_PLAY_DATA_SAFETY_FINAL.md), including deletion-request **Yes** via email scope.
3. Legal comfort with first-party Yandex purpose UI for EEA/UK testers (or counsel) — no Google-certified CMP while AdMob is absent.
4. AppMetrica Terms / DPA acceptance in the vendor cabinet if not already done.
5. Optional: ask Yandex support the IP → Approximate location question in the FINAL matrix before wide production.

## Safe interim stance

- Privacy HTML is ready to publish when the owner chooses; this docs sync does
  **not** publish Pages automatically.
- AAB / Console submit remain owner steps after Pages URL is live and Data Safety
  is filled — not blocked on a new Codex PASS or re-run physical QA for docs-only work.
