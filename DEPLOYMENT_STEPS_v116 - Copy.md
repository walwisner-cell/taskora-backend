# Trothen v115 + v116 — Deployment Steps (Trothen Tokens, Africa-ready)

v115 hasn't been deployed yet, so this package includes both: 19 code files (3 new) plus CHANGES_v115.md and CHANGES_v116.md. If you already copied in the v115 files, copy all of these again anyway: five of them changed in v116.

No new packages, no new environment variables, and no database migration. The new collections (`tokenLedger`, `tokenPurchases`) are created the first time tokens are bought.

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public\index.html` | modified (changed again in v116) | 239,117 |
| `public\app\trothen.js` | modified | 1,476,817 |
| `public\app\rides.js` | modified | 80,674 |
| `public\app\tokens.js` | **new** (changed again in v116) | 44,332 |
| `src\tokens.js` | **new** (changed again in v116) | 31,647 |
| `src\routes\tokens.routes.js` | **new** (changed again in v116) | 15,147 |
| `src\routes\marketplace.routes.js` | modified | 148,431 |
| `src\routes\payments.routes.js` | modified | 79,917 |
| `src\routes\admin.routes.js` | modified | 235,284 |
| `src\routes\orders.routes.js` | modified | 46,863 |
| `src\routes\rides.routes.js` | modified | 64,804 |
| `src\platform-settings.js` | modified (changed again in v116) | 46,191 |
| `src\account-privacy.js` | modified | 17,444 |
| `src\go-live.js` | modified | 16,843 |
| `src\store-orders.js` | modified | 10,294 |
| `src\store-order-sweep.js` | modified | 2,578 |
| `src\booking-scheduler.js` | modified | 4,564 |
| `src\ride-sweep.js` | modified | 9,984 |
| `server.js` | modified | 27,440 |

## 2. cmd.exe deploy steps

Open Command Prompt (cmd.exe), not PowerShell. Replace `path\to\trothen-backend` with your real folder. Unzip `trothen-v116-files.zip` over it so each file lands in the place shown above.

```
cd path\to\trothen-backend
dir public\index.html
dir public\app\trothen.js
dir public\app\rides.js
dir public\app\tokens.js
dir src\tokens.js
dir src\routes\tokens.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\payments.routes.js
dir src\routes\admin.routes.js
dir src\routes\orders.routes.js
dir src\routes\rides.routes.js
dir src\platform-settings.js
dir src\account-privacy.js
dir src\go-live.js
dir src\store-orders.js
dir src\store-order-sweep.js
dir src\booking-scheduler.js
dir src\ride-sweep.js
dir server.js
```

Check the byte counts `dir` shows against the table. If any number doesn't match, stop and copy that file in again.

Once every number matches:

```
git add .
git commit -m "v115-v116: Trothen Tokens, Africa-ready"
git push
```

Render deploys automatically after the push. Once it's live:

1. Sign in as super admin → **Admin → Tokens**.
   - Under **Settings**, decide which countries tokens are on in. Leave it empty for every country, or start with one, for example `Liberia`.
   - Under **Countries**, pick Liberia, check the packs and limits, set fixed local prices if you want round numbers, and press **Save Liberia**. Do the same for Ghana and Nigeria.
   - Check the exchange rates in Admin are current.
2. Sign in as a verified test customer in Liberia → **Tokens** → buy the Mini pack → book a pro with **Pay with: Tokens** → cancel → check the tokens came back.
3. Try **Record a payment made outside the app** on that test customer with a test receipt number. Then try the same receipt number again; it must be refused.
