# Permissions audit

**Prepared:** 2026-10-06  
**Note:** Final merged manifest appears after `prebuild:android:production`. This matrix combines Expo config, known library defaults, and Phase 5 audit notes in `docs/DECISIONS.md`.

| Permission | Source | Why present | Runtime requested? | User-visible purpose | Play concern |
|------------|--------|-------------|--------------------|----------------------|--------------|
| `INTERNET` | React Native / ads / analytics stacks | Network for ads + AppMetrica | Install-time normal | Ads & analytics | Expected for Contains ads |
| `ACCESS_NETWORK_STATE` | Typical RN/ads merge | Check connectivity before ads | Install-time | Ads reliability | Low |
| `POST_NOTIFICATIONS` | `expo-notifications` | Local medication / measurement reminders | **Yes** (contextual when enabling reminders, API 33+) | Reminders | Declare notifications use; not remote push |
| `RECEIVE_BOOT_COMPLETED` | `expo-notifications` default | Reschedule local notifications after reboot | Install-time | Reminder reliability | Documented in DECISIONS |
| `VIBRATE` | `expo-notifications` | Notification feedback | Install-time | Reminders | Low |
| `com.google.android.gms.permission.AD_ID` | Yandex Mobile Ads SDK ≥4.5.0 (vendor default) | Advertising ID for ads | Via Play services / SDK | Personalized/measured ads | **Declare Advertising ID = Yes**; **VERIFY** merged manifest |
| Badge-related helpers | Possible transitive notifications merge | Notification badge support | Library-dependent | Reminders UX | Low; **VERIFY** merged manifest |
| `SYSTEM_ALERT_WINDOW` | Blocked in production `app.config.ts` | Explicitly blocked for release | No | — | Must stay blocked |
| `READ/WRITE_EXTERNAL_STORAGE` | Blocked in production config | Explicitly blocked | No | Share via SAF / Share Sheet | Must stay blocked |

## Confirmed absent in first-party product scope

| Permission / capability | Status |
|-------------------------|--------|
| Location (fine/coarse/background) | **Not requested by app code** — VERIFY AppMetrica defaults remain off |
| Camera | Absent |
| Microphone | Absent |
| Contacts | Absent |
| Exact alarm (`SCHEDULE_EXACT_ALARM`) | Not added by us (DECISIONS) |
| Foreground service | Not added by us |
| SMS / Call log | Absent |
| Query all packages | Absent |

## Play Console action items

1. Declare notification permission purpose = local reminders.
2. Declare Advertising ID usage via Yandex Ads.
3. After first production prebuild, attach/screenshot merged manifest permissions list for the release evidence pack (**VERIFY**).
