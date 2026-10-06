# Health Apps declaration — proposed answers

**Prepared:** 2026-10-06  
**Official form help:** https://support.google.com/googleplay/android-developer/answer/14738291  
**Health content policy:** https://support.google.com/googleplay/android-developer/answer/16679511

## Actual health-related functionality (evidence)

| Feature | Present? | Evidence |
|---------|----------|----------|
| Blood pressure diary (systolic/diastolic) | Yes | Diary screens + `Measurement` entity |
| Pulse logging | Yes | Same |
| Charts / descriptive statistics | Yes | Graphs feature — aggregates only |
| Medication schedule + local reminders | Yes | Medications + reminders services |
| Additional health metrics (weight, glucose, SpO₂, temperature) | Yes | Health feature + metric catalog |
| Doctor report PDF export | Yes | `src/domain/report/`, `expo-print` |
| Family profiles | Yes | Profiles |

## What the app does **NOT** do (do not declare / do not claim)

| Capability | Present? | Notes |
|------------|----------|-------|
| Diagnosis | **No** | No diagnostic engine |
| Prescription / dosing advice | **No** | User-entered schedules only; UI states not prescriptions |
| Treatment recommendations | **No** | — |
| Disease prediction / risk scores marketed as clinical | **No** | Descriptive stats only |
| Emergency medical services | **No** | — |
| Connection to medical hardware / Bluetooth BP monitors | **No** | Manual entry only (no BLE health device integration in code) |
| Clinical decision support | **No** | — |
| Regulated medical device claims | **No** | Disclaimer in UI + PDF + privacy |

## Proposed Console classification guidance

Complete the Health apps form by selecting features that match a **personal health journal / tracker** with medication reminders and export — **not** a medical device.

Suggested narrative for free-text / additional info fields (adapt to exact Console wording):

> The app is a personal diary for user-entered blood pressure, pulse, optional health metrics, and medication reminders. It provides charts and a user-generated PDF summary for sharing with a clinician. It does not diagnose, treat, prescribe, or connect to medical devices. It is not a medical device and does not replace professional medical advice.

## Store listing disclaimer (required by Health content policy for non-device health apps)

Include in full description (all locales):

> This app is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.

(Already mirrored in spirit by in-app / PDF disclaimer strings.)

## In-app / PDF disclaimer audit (semantic equivalence)

| Locale | Key | Meaning check |
|--------|-----|---------------|
| ru | `report.disclaimer` | Not a medical device; does not replace a doctor |
| en | same | Equivalent |
| es | same | Equivalent |
| de | same | Equivalent |

Source dictionaries: `src/i18n/dictionaries/{ru,en,es,de}.ts`.

## Medical device proof

**Not applicable** — do not declare as regulated medical device; do not upload clearance documents.
