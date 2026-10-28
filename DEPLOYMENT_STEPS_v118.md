# Trothen v118 — Deployment Steps (Tokens for Pros)

This replaces every earlier tokens package (v115, v116, v117). Use only this one. 12 files: 3 new, 9 modified, plus CHANGES_v118.md.

`public\app\trothen.js` and `public\app\rides.js` are **not** in this package. If you copied in a v115–v117 version of either file, put back the copy from your own repo (`git checkout -- public\app\trothen.js public\app\rides.js`) before going on.

No new packages, no new environment variables, and no database migration.

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public\index.html` | modified | 239,117 |
| `public\app\tokens.js` | **new** | 59,115 |
| `src\tokens.js` | **new** | 47,650 |
| `src\routes\tokens.routes.js` | **new** | 23,203 |
| `src\routes\marketplace.routes.js` | modified | 144,492 |
| `src\routes\payments.routes.js` | modified | 79,096 |
| `src\routes\misc.routes.js` | modified | 64,268 |
| `src\ride-pass.js` | modified | 6,903 |
| `src\platform-settings.js` | modified | 46,647 |
| `src\account-privacy.js` | modified | 17,444 |
| `src\go-live.js` | modified | 16,843 |
| `server.js` | modified | 27,440 |

## 2. cmd.exe deploy steps

Open Command Prompt (cmd.exe), not PowerShell. Replace `path\to\trothen-backend` with your real folder. Unzip `trothen-v118-files.zip` over it so each file lands in the place shown above.

```
cd path\to\trothen-backend
dir public\index.html
dir public\app\tokens.js
dir src\tokens.js
dir src\routes\tokens.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\payments.routes.js
dir src\routes\misc.routes.js
dir src\ride-pass.js
dir src\platform-settings.js
dir src\account-privacy.js
dir src\go-live.js
dir server.js
```

Check the byte counts `dir` shows against the table. If any number doesn't match, stop and copy that file in again.

Once every number matches, follow the best-practice route: put the change on its own branch, test it, and only then move it to main (which is what goes live).

**Step A — save it on a separate branch (nothing goes live yet):**

```
git checkout -b v118-pro-tokens
git add src\tokens.js src\routes\tokens.routes.js public\app\tokens.js
git add public\index.html src\routes\marketplace.routes.js src\routes\payments.routes.js src\routes\misc.routes.js
git add src\ride-pass.js src\platform-settings.js src\account-privacy.js src\go-live.js server.js
git add CHANGES_v118.md DEPLOYMENT_STEPS_v118.md
git status
git commit -m "v118: Trothen Tokens for pros"
git push -u origin v118-pro-tokens
```

I list the files one by one instead of `git add .` on purpose. That way only the v118 files go into this change, and nothing else that happens to be lying in your folder slips in. `git status` before the commit should show exactly these 14 files under "Changes to be committed".

**Step B — test it before it's live (recommended):** in Render, open the trothen-api service → **Settings** → set **Branch** to `v118-pro-tokens` on a second, test service if you have one. If you only have the one live service, test it on your own computer instead:

```
npm install
set PORT=3001
node server.js
```

Then open http://localhost:3001 in your browser and run through the checks at the bottom of this page. (This uses the local test data in your folder, not your live data.)

**Step C — make it live when you're happy:**

```
git checkout main
git merge v118-pro-tokens
git push
```

Render deploys automatically after the push in Step C. Once it's live:

1. Sign in as super admin → **Admin → Tokens**. Check the packs and limits. Leave **Charge a job fee** off until you've told your pros and decided the amount.
2. For mobile money payment codes: **Countries** → choose the country → enter Trothen's official mobile money number → **Save**.
3. Sign in as a verified test pro → **Tokens** → buy the Mini pack → tick **Commission when I cash out** → check the history shows the purchase.
4. Make a test booking as a customer and check the customer screens look exactly as before (no tokens anywhere).
