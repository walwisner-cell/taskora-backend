# Trothen v129: deployment steps (arrival times, Leave now, phone-first trip screen)

Built on v128, which is already live. 7 files (2 new), plus `CHANGES_v129.md` and this file. No new packages, environment variables or database changes.

## 1. Files and byte counts

| File | Status | Bytes |
|---|---|---|
| `src\arrival-time.js` | **new** | 14,465 |
| `src\routes\payments.routes.js` | changed | 92,324 |
| `src\routes\marketplace.routes.js` | changed | 186,047 |
| `server.js` | changed | 29,258 |
| `public\app\where.js` | changed | 39,268 |
| `public\app\arrival.js` | **new** | 23,934 |
| `public\index.html` | changed | 256,374 |

## 2. Put the files in place and check them
Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v129-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir src\arrival-time.js
dir src\routes\payments.routes.js
dir src\routes\marketplace.routes.js
dir server.js
dir public\app\where.js
dir public\app\arrival.js
dir public\index.html
```

Each size must match the table exactly. If one is different, copy that file out of the zip again.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v129-arrival-times
git add src\arrival-time.js
git add src\routes\payments.routes.js
git add src\routes\marketplace.routes.js
git add server.js
git add public\app\where.js
git add public\app\arrival.js
git add public\index.html
git add CHANGES_v129.md DEPLOYMENT_STEPS_v129.md
git status
git commit -m "v129: agreed arrival times with reminders, Leave now fixed on phones, professional phone-first trip screen"
git push -u origin v129-arrival-times
```

`git status` should list exactly 9 files.

## 4. Test on your computer

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 and check that an active booking shows **Agree arrival time**. Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v129-arrival-times
git push
```

Render deploys after this push.

## 6. After it's live: a real test with two phones
1. **Both phones:** if a trip from earlier testing is still open, tap **Arrived** on the dark bar at the bottom to close it.
2. **Pro phone:** open **My Contracts**, then **Agree arrival time** on a booking, and pick a time about 40 minutes ahead.
3. **Customer phone:** **Accept** the time (on the card at the top of **My Bookings**).
4. **About 30 minutes before:** the pro gets "Time to leave". They tap **Leave now** and allow location when the phone asks.
5. **Customer phone:** **Track arrival** shows the pro moving, the distance and the estimated arrival.
6. **Pro phone:** **I have arrived**.
