# RuStore upload checklist — «Дневник давления»

Manual console upload only. Do **not** automate RuStore submission from agents.

## Package identity

- [ ] App name: **Дневник давления**
- [ ] Package: `com.calculatorplatform.bpdiary`
- [ ] Version name: `1.0.0`
- [ ] Version code: `1`
- [ ] Support email: `rustore-alex1c@yandex.ru`
- [ ] Privacy URL: `https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html` (HTTP 200)

## Binary & icons

- [ ] AAB: `release-artifacts/bp-diary-1.0.0-v1.aab`
- [ ] AAB SHA-256: `9266A4C7CCB0284CD12889107260529B405D60DF3836B426250287B3F74C97EB`
- [ ] Store icon 512×512: `release-artifacts/icon-512.png` (from `assets/icon_gpt.png`)

## Screenshots (7)

Folder: `release-artifacts/screenshots/rustore/`

- [ ] `01-diary.png`
- [ ] `02-add-measurement.png`
- [ ] `03-graphs.png`
- [ ] `04-medications.png`
- [ ] `05-health.png`
- [ ] `06-profiles.png`
- [ ] `07-doctor-report.png`

All final screenshots: PNG, **1080×1920**, no keyboard / Dev Client / production ad creatives / real health data.

## Listing copy

Source: `docs/RUSTORE_LISTING.md`

- [ ] Short description ready
- [ ] Full description ready
- [ ] Medical disclaimer included
- [ ] Category recommendation: Health & Fitness / Здоровье
- [ ] Tags: давление, пульс, здоровье, лекарства, дневник, артериальное давление

## Store declarations

### Advertising

- [ ] App contains ads: **Yes** (Yandex Mobile Ads)
- [ ] Banner placements: Diary / Graphs / Health overview only
- [ ] No ads on Medications, Settings, Backup, Doctor Report, forms

### Analytics

- [ ] App uses analytics: **Yes** (Yandex AppMetrica)
- [ ] Health values are **not** sent as event parameters

### Age rating considerations

- [ ] General audience / health diary (no medical claims, no restricted content)
- [ ] Local medication reminders optional

## Permission explanations (for RuStore forms)

| Permission | Explanation |
|------------|-------------|
| `POST_NOTIFICATIONS` | Для напоминаний о приёме лекарств, которые пользователь включает самостоятельно. |
| `INTERNET` | Для показа рекламы и технической аналитики приложения. |
| `AD_ID` | Используется рекламным SDK Яндекса. |
| `RECEIVE_BOOT_COMPLETED` | Для восстановления запланированных локальных напоминаний после перезагрузки устройства. |
| `WAKE_LOCK` / `VIBRATE` | Используются системой уведомлений для своевременного показа напоминаний. |
| `ACCESS_NETWORK_STATE` | Для определения доступности сети рекламным и аналитическим SDK. |

## Privacy / data summary

- Health records stored **locally** on device (SQLite)
- No user account / no developer cloud backend
- Backup and doctor PDF only via explicit user Share Sheet / document picker
- AppMetrica: technical usage analytics only
- Yandex advertising SDK may process device/ad identifiers per Yandex policies
- Notification permission is contextual (medication reminders)
- No camera, location, contacts, or broad storage permissions

## Final gate

- [ ] Privacy page publicly reachable
- [ ] Screenshots visually QA’d
- [ ] AAB SHA-256 matches verification file
- [ ] Upload AAB + assets in RuStore Console
- [ ] Submit for moderation (manual operator step)
