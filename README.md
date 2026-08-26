# Давление и пульс — дневник

Android-first React Native / Expo diary for RuStore.

**Package:** `com.calculatorplatform.bpdiary`  
**Phase:** 0–2 foundation / data / domain

## Stack

* Expo SDK 57 + React Native 0.86 + TypeScript
* Local SQLite (`expo-sqlite`) — no backend, no mandatory registration
* JDK 17 for Android toolchain

## Scripts

```bash
npm start
npm run android
npm run lint
npm run typecheck
npm test
npm run validate
```

## Docs

* `docs/PRODUCT_SPEC.md`
* `docs/ARCHITECTURE.md`
* `docs/ROADMAP.md`
* `docs/DECISIONS.md`
* `credentials/README.md` — production signing (you create the keystore later)

## Medical boundary

This app is a user measurement journal, not a medical device. It does not
diagnose, recommend drugs, or assert medical causation.
