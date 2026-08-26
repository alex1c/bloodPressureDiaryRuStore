/**
 * Credentials for BP Diary production signing.
 *
 * Never commit real keystores, `keystore.properties`, or passwords.
 * `credentials/keystore.properties` is gitignored.
 */

## Per-product keystore

Package: `com.calculatorplatform.bpdiary`

Suggested local (outside repo) layout:

| Item | Example |
|------|---------|
| Keystore file | `%USERPROFILE%\secure\calculator-platform\bpdiary-release.jks` |
| Alias | `bpdiary` |
| Package | `com.calculatorplatform.bpdiary` |

Generate **only if** no production keystore for this package exists yet
(you choose the passwords — they are never stored in git):

```powershell
keytool -genkeypair -v -storetype PKCS12 `
  -keystore "$env:USERPROFILE\secure\calculator-platform\bpdiary-release.jks" `
  -alias bpdiary `
  -keyalg RSA -keysize 2048 -validity 10000
```

Copy `keystore.properties.example` → `keystore.properties` and fill absolute
`storeFile` paths. Then:

```bash
npm run apply:release-signing
npm run verify:release-signing
```

Do **not** let agents invent or auto-create production keystores/passwords.
