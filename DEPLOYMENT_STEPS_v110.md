# Trothen v110 — Deployment Steps

18 files total: 1 new write-up, 17 modified. See `CHANGES_v110.md` for what each one does and why.

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public\index.html` | modified | 238,502 |
| `public\app\trothen.js` | modified | 1,474,456 |
| `src\account-privacy.js` | modified | 16,886 |
| `src\platform-settings.js` | modified | 36,547 |
| `src\provider-score.js` | modified | 18,009 |
| `src\provider-score-scheduler.js` | modified | 6,507 |
| `src\routes\auth.routes.js` | modified | 82,348 |
| `src\routes\admin.routes.js` | modified | 235,065 |
| `src\routes\marketplace.routes.js` | modified | 142,992 |
| `src\routes\orders.routes.js` | modified | 35,973 |
| `src\routes\payments.routes.js` | modified | 75,897 |
| `src\fx-scheduler.js` | modified | 2,538 |
| `src\document-upload-reminder-scheduler.js` | modified | 2,494 |
| `src\id-retention-scheduler.js` | modified | 4,128 |
| `src\location-retention-scheduler.js` | modified | 4,103 |
| `src\payout-settlement-scheduler.js` | modified | 2,085 |
| `src\top-scorer-promotion-scheduler.js` | modified | 3,863 |
| `CHANGES_v110.md` | new (this write-up, optional to deploy — doesn't affect the app) | 20,937 |

## 2. cmd.exe deploy steps

Open Command Prompt (cmd.exe) — not PowerShell. Replace `path\to\trothen-backend` with your real folder.

```
cd path\to\trothen-backend
dir public\index.html
dir public\app\trothen.js
dir src\account-privacy.js
dir src\platform-settings.js
dir src\provider-score.js
dir src\provider-score-scheduler.js
dir src\routes\auth.routes.js
dir src\routes\admin.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\orders.routes.js
dir src\routes\payments.routes.js
dir src\fx-scheduler.js
dir src\document-upload-reminder-scheduler.js
dir src\id-retention-scheduler.js
dir src\location-retention-scheduler.js
dir src\payout-settlement-scheduler.js
dir src\top-scorer-promotion-scheduler.js
```

Compare the byte counts `dir` shows against the table above. If any number doesn't match, stop and copy that file in again before continuing — it means the copy is incomplete or from the wrong place.

Once every number matches:

```
git add .
git commit -m "v110: provider country display, pricing currency, provider-score sweep fix, pick-and-drop checkout fix, store/booking/scope-change money-ordering fix, country filter, both-pricing fix, scheduler robustness fixes, admin-editable New-on-Trothen rule"
git push
```

## 3. What's new in v110

See `CHANGES_v110.md` for the full plain-language write-up of all 17 items, including:
- The real root cause of provider scores not showing (one bad provider record could silently block the whole daily scoring run for everyone) — fixed, plus the same fix applied to six other scheduled sweeps that had the identical risk.
- The store checkout no longer dead-ends when no pick-and-drop driver is available.
- The money-ordering safety fix, now applied in five places: store purchases, store deliveries, direct bookings, job-board hires/negotiable offers, and additional-payment ("scope change") approvals.
- A real country filter on "Browse All Pros".
- The "Both" pricing option (hourly rate OR customer offer) can now actually be saved — it was silently rejected before.
- The admin Provider Scores "Breakdown" view now says plainly how many completed-on-Trothen bookings a pro has and how many more are needed before "New on Trothen" becomes a real score — a profile's own jobs/rating figure is not the same thing as a completed Trothen booking, and no amount of recomputing can substitute for the real thing.
- Every place the "5 jobs" number showed now says exactly what it's counting ("Trothen bookings") so it doesn't read as a contradiction next to a pro's own real-world stats.
- **New:** the "New on Trothen" rule (how many Trothen bookings before a pro's score stops being provisional) is no longer a fixed number in the code — it's a real setting you can see and change yourself from Admin → Provider Scores, with no deploy needed. See item 17 in `CHANGES_v110.md`.
- The PDF data export, categorized support numbers, and a full audit of Store, GPS, Payments, Business tools, Auth, and the rest of Misc.

## 4. Post-deploy smoke test

1. Open the provider directory as a customer and confirm each provider card shows a country.
2. On the membership/pricing page, switch the country dropdown a few times and confirm the prices shown always match the currency of whichever country is currently selected.
3. As a super admin, open Provider Scores and click "Recompute now" — confirm it runs and scores update (an established provider with real completed jobs should show a number, not "New on Trothen").
4. As a customer, go to Settings → Download My Data and confirm both the PDF and the .json download now work.
5. As a super admin, open Support Contact settings and confirm you can set separate numbers for Dispute, Onboarding, Promotion, and General, and that the Dispute help screen shows the Dispute number.
6. As a customer, open a store that offers pick-and-drop delivery where no driver is currently available, select that delivery method, and confirm you see both "Collect it myself instead" and "Check again" — and that clicking "Collect it myself instead" unlocks the Pay button.
7. As a customer, buy something from a pro's store (pickup), confirm stock goes down by the right amount, the order total is correct, and marking it "received" completes the order and releases the seller's money exactly once.
8. On "Browse All Pros", confirm the new country dropdown lists real countries and narrows the list correctly, alone and combined with a category filter.
9. Approve a provider's additional-payment ("scope change") request on a real booking and confirm the job's total and escrow both update correctly, exactly once.
10. As a provider, go to Settings → Pricing Model, choose "Both", enter an hourly rate, and save — confirm it saves without an error and the rate sticks.
11. As a super admin, open Admin → Provider Scores and confirm you see a new panel above the table stating the current rule (default: 5) with an editable number field and a Save button. Change it to a different number, save, and confirm the panel shows the new number without a page reload.
12. As a *non*-super-admin admin (if you have one), open the same page and confirm you see the rule stated as plain text, with no editable field — only a super admin can change it.
13. After saving a new number in step 11, click "Recompute now" and confirm a pro who now crosses the new threshold shows a real score instead of "New."

## 5. Still open / not part of this release

The Liberia MTN MoMo integration remains gated (no real credentials set) and not live — the money-ordering fixes in this release are specifically there so that integration will be safe the moment it does go live, but turning it on is a separate, deliberate step for later.

If a provider's card still shows "New on Trothen" right after this deploys, use the new "Recompute now" button in Admin → Provider Scores rather than waiting for the next scheduled run — the fix means their score will compute correctly, but it only takes effect the next time the sweep actually runs. If a specific pro still shows "New" after that and you're not sure why, open their "Breakdown" — it now states exactly how many completed-Trothen-bookings they have on record and how many more are needed; if that number is genuinely low, the fix for that is more real bookings completed through Trothen, not a setting change. If you'd rather lower the bar across the board, that's exactly what the new rule control in item 17 is for.
