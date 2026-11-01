# Trothen v120: Deployment Steps (see your offer before you book)

Three files, plus CHANGES_v120.md and this file. No new packages, environment variables or database migration. No server code changed, so nothing on Render needs restarting beyond the normal deploy.

Build this on top of v119. If v119 isn't deployed yet, deploy v119 first.

## 1. Files and byte counts

| File | Status | Bytes |
|---|---|---|
| `public\app\review.js` | **new** | 15,887 |
| `public\app\trothen.js` | modified | 1,480,876 |
| `public\index.html` | modified | 239,222 |

## 2. cmd.exe steps

Open Command Prompt (cmd.exe), not PowerShell. Unzip `trothen-v120-files.zip` over your project folder, then:

```
cd path\to\trothen-backend
dir public\app\review.js
dir public\app\trothen.js
dir public\index.html
```

Check each byte count against the table. If any differs, copy that file again.

**Step A: put it on its own branch (nothing goes live yet)**

```
git checkout -b v120-check-booking
git add public\app\review.js
git add public\app\trothen.js
git add public\index.html
git add CHANGES_v120.md DEPLOYMENT_STEPS_v120.md
git status
git commit -m "v120: check your booking and offer before sending"
git push -u origin v120-check-booking
```

`git status` should list exactly these 5 files to be committed.

**Step B: test it on your computer before it's live**

```
npm install
set PORT=3001
node server.js
```

Open http://localhost:3001 and try the checks in section 3.

**Step C: make it live**

```
git checkout main
git merge v120-check-booking
git push origin main
```

Render deploys main on its own. When it finishes, press Ctrl+F5 on trothenpro.com once so the browser picks up the new files.

## 3. Checks

1. Sign in as a customer and press **Book** on a "Mutual Agreement" pro. The bottom button says **Check my booking →**.
2. Type an offer of 150. The box at the top shows Service fee $13.50 and Total charged $163.50.
3. Fill in the job, a time and an address, and press **Check my booking →**. You see "Check your booking" with Your offer $150.00, the fee, "Total if your offer is accepted $163.50", the job, date, time, place and "Protected by Trothen". The button says **Send my offer**.
4. Press **← Change something**. You're back on the form with everything still filled in.
5. Pick **Cash to the pro after the job**. The top box now says "Service fee: None, cash job" and "Pay the pro after the job: $150.00". Check the booking again: no fee, and "You pay the pro after the job $150.00".
6. Clear the time and press **Check my booking →**. You stay on the form with "Pick a time for the job".
7. Open **Responses to Your Job** on a posted job. The card shows a real "% fit" number, not "undefined". Type an amount and press **Hire**: the question shows the price, the fee and the total.
