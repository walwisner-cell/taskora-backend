# Trothen v128: deployment steps (old chats, and finding each other on a job)

Built on v127, the version I uploaded on 2 November 2026. 11 files (2 new), plus `CHANGES_v128.md` and this file. No new packages, environment variables or database changes.

## 1. Files and byte counts

| File | Status | Bytes |
|---|---|---|
| `src\live.js` | changed | 7,261 |
| `src\location-retention-scheduler.js` | changed | 5,125 |
| `src\account-privacy.js` | changed | 17,693 |
| `src\routes\misc.routes.js` | changed | 69,154 |
| `src\routes\payments.routes.js` | changed | 89,734 |
| `src\routes\marketplace.routes.js` | changed | 186,028 |
| `server.js` | changed | 28,973 |
| `public\app\trothen.js` | changed | 1,491,413 |
| `public\app\chats.js` | **new** | 20,792 |
| `public\app\where.js` | **new** | 29,809 |
| `public\index.html` | changed | 244,665 |

## 2. Put the files in place and check them

Use Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v128-files.zip` over your project folder, then run:

```
cd path\to\trothen-backend
dir src\live.js
dir src\location-retention-scheduler.js
dir src\account-privacy.js
dir src\routes\misc.routes.js
dir src\routes\payments.routes.js
dir src\routes\marketplace.routes.js
dir server.js
dir public\app\trothen.js
dir public\app\chats.js
dir public\app\where.js
dir public\index.html
```

Each size must match the table exactly. If one is different, copy that file out of the zip again.

## 3. Commit on its own branch (nothing goes live yet)

```
git checkout main
git pull
git checkout -b v128-chats-location
git add src\live.js
git add src\location-retention-scheduler.js
git add src\account-privacy.js
git add src\routes\misc.routes.js
git add src\routes\payments.routes.js
git add src\routes\marketplace.routes.js
git add server.js
git add public\app\trothen.js
git add public\app\chats.js
git add public\app\where.js
git add public\index.html
git add CHANGES_v128.md DEPLOYMENT_STEPS_v128.md
git status
git commit -m "v128: every past conversation in Messages; job location required, customer can share live location, quieter trip tracking"
git push -u origin v128-chats-location
```

`git status` should list exactly 13 files.

## 4. Test it on your computer

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 and check:
- **Messages** lists your old chats, with the last message, the time and an unread count.
- Posting a job without a location is refused, and it posts once you pin it or add a landmark.
- On **My Bookings**, a booking with no pin shows the warning and **Set the job location**.

Press Ctrl+C when you're done.

## 5. Make it live

```
git checkout main
git merge v128-chats-location
git push
```

Render deploys after this push.

## 6. After it's live: a real test with two phones
A computer's location can be kilometres off, so test this on phones with Location switched on.
1. **Customer phone:** book a pro (or set the location on an existing booking with **Set the job location**).
2. **Pro phone:** **My Contracts** → **On My Way**. Keep the page open.
3. **Customer phone:** **My Bookings** → **Track your pro** → **Share my live location**.
4. **Pro phone:** **Trip map** shows the red job pin, the blue pro dot and the green customer dot, with the distance. **Get directions** opens Google Maps.
5. **Pro phone:** tap **Arrived**. Sharing stops on both phones.
