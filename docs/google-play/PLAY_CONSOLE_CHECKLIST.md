# Google Play Console checklist

**Package:** `com.calculatorplatform.bpdiary`  
**Prepared:** 2026-10-06  
**Statuses:** `READY` = repo evidence ready for operator paste · `MANUAL` = Console/account action · `VERIFY` = confirm at build/Console time · `BLOCKED` = cannot proceed yet

Counts (approx.): READY **12** · MANUAL **18** · VERIFY **10** · BLOCKED **2**

---

## App details

| Item | Status | Notes |
|------|--------|-------|
| Package ID fixed | READY | `com.calculatorplatform.bpdiary` |
| Display name strategy | READY | See `listing/*.md` |
| Version for this phase | READY | Keep **1.0.2 / 3** — bump later |
| Category suggestion | MANUAL | Health & Fitness (operator chooses) |

## Store listing

| Item | Status | Notes |
|------|--------|-------|
| RU/EN/ES/DE text | READY | `docs/google-play/listing/` |
| Short/full descriptions | READY | Limits respected in drafts |
| Graphic assets (icon) | READY | Existing 512 icon path |
| Screenshots / feature graphic | MANUAL | Capture later on device |
| Store listing locale enablement | MANUAL | Console |

## Privacy policy

| Item | Status | Notes |
|------|--------|-------|
| Canonical HTTPS URL | READY (content) / VERIFY (live deploy) | `…/privacy.html` — redeploy Pages |
| RU/EN/ES/DE pages | READY | `docs/privacy*.html` |
| In-app privacy link | READY | Settings uses `releaseConfig.privacyPolicyUrl` |
| Paste URL in Console | MANUAL | |

## Data Safety

| Item | Status | Notes |
|------|--------|-------|
| Evidence matrix | READY | `DATA_SAFETY.md` |
| Fill form | MANUAL | Match matrix + vendor guides |
| Align with privacy policy | READY | Updated texts |
| Vendor SDK rows | VERIFY | AppMetrica + Yandex Ads official tables |

## Health Apps

| Item | Status | Notes |
|------|--------|-------|
| Declaration draft | READY | `HEALTH_APPS_DECLARATION.md` |
| Submit in Console | MANUAL | |
| Medical device = No | READY | |

## Ads

| Item | Status | Notes |
|------|--------|-------|
| Contains ads = Yes | READY (evidence) / MANUAL (Console) | Yandex banners + interstitial |
| IDs unchanged | READY | `R-M-20056373-1..5` |
| No AdMob | READY | |

## Advertising ID

| Item | Status | Notes |
|------|--------|-------|
| Declare Yes | MANUAL | Via Yandex Ads SDK |
| Purpose Advertising | MANUAL | |
| Merged manifest confirms AD_ID | VERIFY | After production prebuild |

## Target audience

| Item | Status | Notes |
|------|--------|-------|
| Recommend 18 and over only | READY | Avoid children / Families |
| Console selection | MANUAL | |
| Store listing not child-directed | READY | Copy reviewed |

## Content rating

| Item | Status | Notes |
|------|--------|-------|
| Questionnaire notes | READY | See below |
| Submit IARC questionnaire | MANUAL | |

### Content rating notes (for operator)

Likely relevant answers (confirm in questionnaire UI):

- No violence, sexual content, gambling, controlled substances sales.
- Health content / medication tracking present (user diary, not clinical advice).
- Ads present (third-party ad network).
- User-generated notes possible (user-entered text).
- Not primarily for children.

## App access

| Item | Status | Notes |
|------|--------|-------|
| All features available without login | READY | No auth |
| No paywall | READY | |
| Console “all functionality available” | MANUAL | |

## Testing / closed testing

| Item | Status | Notes |
|------|--------|-------|
| Closed testing track plan | READY | Section below |
| Create testers | MANUAL | New Play developer account |
| Upload AAB to closed track | BLOCKED | Later release phase + signing |
| Production access request | BLOCKED | After closed testing policy requirements met |

### Closed testing — owner actions

1. Create Play Console app with package `com.calculatorplatform.bpdiary`.
2. Complete App content declarations (privacy, Data Safety, Health, Ads, AD_ID, audience, access).
3. Create **Closed testing** track; add real tester emails / Google Groups.
4. Upload a signed AAB when Phase 4+ is authorized (not this phase).
5. Send opt-in link to testers; keep install/feedback evidence.
6. Exercise: diary CRUD, graphs, medications reminders (+ POST_NOTIFICATIONS), health metrics, PDF share, JSON backup/restore, language switch, banner placement, interstitial policy, airplane-mode diary offline.
7. Before Production: satisfy account/closed-testing duration & tester requirements then current Play policy for new personal accounts (**VERIFY** Console guidance on the day).

### Closed testing — tester actions

- Install from opt-in link on physical Android device.
- Grant notification permission only when testing reminders.
- Report crashes, permission issues, ad layout, locale bugs.
- Do not share health screenshots containing real personal health data publicly.

## Countries / regions

| Item | Status | Notes |
|------|--------|-------|
| Select distribution countries | MANUAL | Operator choice |
| Privacy/pages not geo-blocked | VERIFY | GitHub Pages |

## App signing

| Item | Status | Notes |
|------|--------|-------|
| Play App Signing enrollment | MANUAL | |
| Upload keystore | MANUAL | Operator-owned; never commit |
| Repo signing scripts | READY | Do not invent passwords |

## Release

| Item | Status | Notes |
|------|--------|-------|
| Phase 3 AAB as RC | BLOCKED | Explicitly out of scope |
| Version bump | BLOCKED | Separate phase |
| `APP_STORE=googleplay` validate | READY | Script exists |

## Post-release verification

| Item | Status | Notes |
|------|--------|-------|
| Listing locales live | MANUAL | |
| Data Safety visible on store | VERIFY | |
| Privacy URL opens | VERIFY | |
| No RuStore CTA on Play build | READY (code) / VERIFY (device PDF) | |
