# International consent — owner checkpoint (Google Play 1.1.1)

**Status:** OWNER CHECKPOINT — legal/CMP decisions remain with the owner.
**2026-10-09 package:** see [INTERNATIONAL_PRIVACY_CHECKLIST.md](./INTERNATIONAL_PRIVACY_CHECKLIST.md) and [PRIVACY_RELEASE_REPORT.md](./PRIVACY_RELEASE_REPORT.md). Consent rewrite was **not** required for Yandex-only stack.

**Distribution (owner-confirmed):** worldwide. Architecture is not Russia/CIS-only.

## Runtime consent model (1.1.1 temporary)

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

## Explicitly NOT proven yet

- Absence of early optional SDK network traffic before consent on a physical
  device (requires Android QA with a proxy). Code and metadata intend to prevent
  auto-init; **do not treat that as proven**.
- Ability to abort an already-started native SDK upload mid-flight (vendor SDK
  limitation — Reject stops first-party dispatch and new loads only).

## Owner decisions still required

1. Legal counsel on first-party purpose UI for worldwide Yandex-only launch.
2. CMP vendor before any Google AdMob / Google demand in EEA/UK/CH.
3. US privacy messaging vs defer.
4. AppMetrica DPA acceptance.
5. Privacy HTML publish only after Codex PASS + physical QA.

## Safe interim stance

- No final AAB / READY FOR GOOGLE PLAY until targeted Codex re-audit PASS and
  physical Android QA.
- Privacy HTML not published from this change set.
