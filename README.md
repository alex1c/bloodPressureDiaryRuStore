# Дневник давления

Android-first React Native / Expo diary for RuStore.

**Package:** `com.calculatorplatform.bpdiary`  
**Version:** `1.0.0` (versionCode `1`)  
**Phase:** 10 — production release prep

## Stack

* Expo SDK 57 + React Native 0.86 + TypeScript
* Local SQLite (`expo-sqlite`) — no backend, no mandatory registration
* JDK 17 for Android toolchain
* AppMetrica + Yandex Mobile Ads (production IDs in `src/config/`)

## Release scripts

```bash
npm run validate:release-config
npm run prepare:release-icons
npm run prebuild:android:production
npm run apply:release-signing   # after keystore exists
cd android && .\gradlew.bat assembleRelease
cd android && .\gradlew.bat bundleRelease
npm run verify:release-signing -- android/app/build/outputs/bundle/release/app-release.aab
```

## Support & privacy

* Email: `rustore-alex1c@yandex.ru`
* Privacy: `docs/privacy.html` → GitHub Pages URL in `src/config/release.ts`

## Docs

* `docs/PRODUCT_SPEC.md`
* `docs/ARCHITECTURE.md`
* `docs/ROADMAP.md`
* `docs/DECISIONS.md`
* `docs/RUSTORE_LISTING.md`
* `docs/privacy.html`
* `credentials/README.md` — production signing (keystore created by you)

## Medical boundary

This app is a user measurement journal, not a medical device. It does not
diagnose, recommend drugs, or assert medical causation.
