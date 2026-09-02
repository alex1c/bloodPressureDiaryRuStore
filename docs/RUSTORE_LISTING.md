# RuStore listing draft — «Дневник давления»

Package: `com.calculatorplatform.bpdiary`  
Version: `1.0.0` (versionCode `1`)  
Support: [rustore-alex1c@yandex.ru](mailto:rustore-alex1c@yandex.ru)  
Privacy: [Политика конфиденциальности](https://alex1c.github.io/bloodPressureDiaryRuStore/privacy.html)

> Git remote was not configured at Phase 10 prep. Privacy URL assumes GitHub Pages for repository `bloodPressureDiaryRuStore` under user `alex1c`.

## Название

**Дневник давления**

## Короткое описание

Давление, пульс, лекарства и показатели здоровья в одном удобном дневнике.

## Полное описание

«Дневник давления» помогает быстро записывать артериальное давление и пульс, вести историю измерений и смотреть понятные графики за 7, 30, 90 дней или за всё время.

**Основные возможности:**

- быстрая запись давления и пульса с датой и временем;
- автоматическое определение периода суток (утро / день / вечер / ночь);
- заметки и теги к измерениям;
- графики и сводная статистика;
- утренние и вечерние средние значения;
- лекарства с расписанием и локальными напоминаниями;
- отметка «Принял» / отмена приёма;
- дополнительные показатели здоровья: вес, сахар, сатурация, температура;
- несколько семейных профилей;
- PDF-отчёт для врача с выбором периода;
- резервная копия и восстановление через системные диалоги Android.

Данные хранятся **локально на устройстве**. Резервная копия и PDF передаются только по вашему явному действию через Share Sheet.

## Disclaimer

**Приложение не является медицинским прибором и не заменяет консультацию врача.**

## Ключевые слова (черновик)

- давление
- дневник давления
- пульс
- артериальное давление
- журнал давления
- контроль давления
- лекарства
- здоровье
- измерения давления

## Store icon

`release-artifacts/icon-512.png` (512×512, derived from `assets/icon_gpt.png`).

## Screenshot plan (future)

Synthetic demo data only — no real health values, no loaded production ad creatives.

| # | Screen | Notes |
|---|--------|-------|
| 1 | Дневник | Demo BP 128/82, 134/86, 125/80 |
| 2 | Добавление давления | Empty form, no ads |
| 3 | Графики | Period selector, summary + chart |
| 4 | Лекарства | No banner; demo medication schedule |
| 5 | Здоровье | Weight/glucose cards |
| 6 | Профили | Profile switcher |
| 7 | Отчёт врачу | Preview / PDF flow, ad-free |

Capture in dev/test ad mode or with ads collapsed — never show real production ad creatives in store screenshots.

## Production IDs (reference)

| Placement | Block ID |
|-----------|----------|
| Diary banner | R-M-19857656-1 |
| Graphs banner | R-M-19857656-2 |
| Health banner | R-M-19857656-3 |
| Interstitial | R-M-19857656-4 |

AppMetrica: `233587e7-4552-4959-a6f4-5f06eb451319`
