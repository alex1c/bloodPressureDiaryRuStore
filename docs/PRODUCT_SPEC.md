# Product Spec — «Давление и пульс — дневник»

**Working title:** Давление и пульс — дневник  
**Package ID:** `com.calculatorplatform.bpdiary`  
**Platform:** Android first (RuStore)  
**Stack:** React Native + Expo + TypeScript, local-only data

## 1. Product concept

A calm, fast blood-pressure and health diary. Primary users are adults ~40–45+,
but the product must feel modern — not “designed for seniors.”

Goals vs typical competitors:

* Faster entry (seconds, not a form marathon)
* Readable history and charts
* Medications + light reminders
* Multiple family profiles
* Doctor-ready report
* Optional extra metrics
* No mandatory registration
* No pushy ads before or during first measurement

## 2. Primary scenario (happy path)

1. User opens the app
2. Sees **today’s diary** immediately
3. Taps **«Добавить измерение»**
4. Enters:
   * systolic (upper)
   * diastolic (lower)
   * pulse
5. Date/time are filled automatically
6. Optionally adds wellbeing, tags, note
7. Saves
8. Sees the new row in the diary at once

Optional fields must never block or slow the main path.

## 3. Medical boundary (non-negotiable)

This app is a **user measurement journal**, not a medical device.

It does **not**:

* measure blood pressure with the phone
* diagnose
* recommend medications
* change dosages
* replace a clinician
* assert medical cause → effect

Allowed: neutral statistics over user-entered data.

| Allowed | Not allowed |
|---------|-------------|
| «В записях с тегом „Стресс“ среднее было 143/89» | «Стресс вызвал повышение вашего давления» |

## 4. V1 planned capabilities

| Area | Scope |
|------|--------|
| Measurements | BP, pulse, date/time, morning/day/evening period |
| History | list, edit, delete |
| Stats / charts | averages, min/max, date range, morning/evening filters (charts UI later) |
| Context | wellbeing, tags, free-text note |
| Tags (preset) | нормально, головная боль, недосып, стресс, кофе, физическая нагрузка |
| Medications | name, dosage text, schedule, active flag, “taken” intakes |
| Reminders | local notification-ready model (implementation later) |
| Health metrics | weight (default on); optional glucose, SpO₂, temperature — tab «Здоровье» |
| Profiles | Я / Мама / Папа / custom — isolated by `profileId`; header switcher |
| Reminders | local notifications; reconcile all profiles; tap routes to correct profile |
| Doctor report | PDF + Android Share Sheet — period presets, profile-scoped, no medical advice |
| Backup / restore | versioned local export/import (contract now, UI Phase 8) |
| Analytics / ads | AppMetrica (`233587e7-4552-4959-a6f4-5f06eb451319`) + Yandex banners on Diary/Graphs/Health; interstitial on Graphs policy; **health values never in analytics** |

## 5. UX principles (audience 40–45+)

* Modern UI — no “pensioner app” styling
* Large primary numbers
* Strong contrast
* Large touch targets
* Few tiny icons; important actions have **text labels**
* No hidden gestures for core flows
* Minimal step count
* **No registration before first measurement**
* **No ads before first measurement**
* **No interstitial during data entry**
* Color is never the only carrier of meaning
* Layout architected for **360 / 390 dp** widths

Visual polish is deferred; these principles constrain later UI work.

## 6. Out of scope for early phases

Ads, AppMetrica wiring, production notifications, PDF, share UI, charts UI,
Bluetooth, Health Connect, wearables, OCR, AI, cloud sync, accounts, backend,
medical recommendations, final visual design.

## 7. Success criteria (product)

A returning user can log a complete BP+pulse reading in a few seconds and trust
that years of data remain on-device, exportable, and profile-isolated.
