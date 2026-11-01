# Trothen v123: Deployment Steps (instant updates, no refresh)

v123 contains v120, v121 and v122. If they aren't deployed, skip them and deploy only this one. Twelve files, plus CHANGES_v120.md to CHANGES_v123.md and this file. No new packages, environment variables or database migration.

## 1. Files and byte counts

| File | Status | Bytes |
|---|---|---|
| `server.js` | modified | 28,009 |
| `src\live.js` | **new** | 6,542 |
| `src\tokens.js` | modified | 55,543 |
| `src\routes\marketplace.routes.js` | modified | 166,150 |
| `src\routes\custpay.routes.js` | modified | 7,189 |
| `src\booking-scheduler.js` | modified | 5,408 |
| `public\app\live.js` | **new** | 10,017 |
| `public\app\pricing.js` | **new** | 16,099 |
| `public\app\review.js` | **new** (since v119) | 18,399 |
| `public\app\payways.js` | modified | 25,604 |
| `public\app\trothen.js` | modified | 1,484,701 |
| `public\index.html` | modified | 239,325 |

Note: `src\live.js` and `public\app\live.js` are two different files with the same name: one runs on the server, one in the browser. Both are needed.

## 2. cmd.exe steps

Open Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v123-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir server.js
dir src\live.js
dir src\tokens.js
dir src\routes\marketplace.routes.js
dir src\routes\custpay.routes.js
dir src\booking-scheduler.js
dir public\app\live.js
dir public\app\pricing.js
dir public\app\review.js
dir public\app\payways.js
dir public\app\trothen.js
dir public\index.html
```

Check each byte count against the table. If any differs, copy that file again.

**Step A: put it on its own branch (nothing goes live yet)**

```
git checkout -b v123-instant-updates
git add server.js
git add src\live.js
git add src\tokens.js
git add src\routes\marketplace.routes.js
git add src\routes\custpay.routes.js
git add src\booking-scheduler.js
git add public\app\live.js
git add public\app\pricing.js
git add public\app\review.js
git add public\app\payways.js
git add public\app\trothen.js
git add public\index.html
git add CHANGES_v120.md CHANGES_v121.md CHANGES_v122.md CHANGES_v123.md DEPLOYMENT_STEPS_v123.md
git status
git commit -m "v123: instant updates without refresh, plus v120-v122"
git push -u origin v123-instant-updates
```

`git status` should list exactly these 17 files to be committed.

**Step B: test it on your computer before it's live**

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 in two browsers (or one normal and one private window). Sign in as a customer in one and a pro in the other, then try the checks in section 3.

**Step C: make it live**

```
git checkout main
git merge v123-instant-updates
git push
```

Render deploys after this push. When it finishes, press Ctrl+F5 once on trothenpro.com in each browser so it loads the new files.

## 3. Checks (two browsers side by side, never press refresh)

1. Customer: open **My Bookings**. Pro: open **Contracts**.
2. Customer: book the pro with **Make an Offer**. Within about a second the offer appears on the pro's screen.
3. Pro: **Suggest a different price**. Within about a second the customer's booking shows **Accept $…** and the price history, and the bell lights up.
4. Customer: **Accept**. Within about a second the pro's row turns **Active**.
5. Customer: post a job and open **View Responses**, and start typing a message in the box. Pro: press **I'm Interested** with a price. The price appears in the customer's window and the typed message stays.
6. To check the connection is live, press F12 in the browser, open **Console**, type `liveStatus()` and press Enter. It should say `connected: true`.
