# Trothen — Deployment Steps (Final)

28 files total. Every backend file syntax-checked, plus a runtime sanity check confirming every new frontend function is both defined and actually called (no leftover dead code, no dangling references).

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public/index.html` | modified | 785,251 |
| `public/manifest.json` | new | 793 |
| `public/sw.js` | new | 700 |
| `public/icon-192.png` | new | 15,672 |
| `public/icon-512.png` | new | 67,430 |
| `public/apple-touch-icon.png` | new | 14,158 |
| `server.js` | modified | 10,042 |
| `src/access-log.js` | new | 1,867 |
| `src/auth.js` | modified | 7,606 |
| `src/commission.js` | modified | 5,856 |
| `src/db-postgres.js` | modified | 13,633 |
| `src/schema.sql` | modified | 30,872 |
| `src/delivery.js` | new | 3,661 |
| `src/document-expiry-scheduler.js` | new | 3,689 |
| `src/provider-score.js` | new | 8,968 |
| `src/provider-score-scheduler.js` | new | 3,810 |
| `src/fraud-detection.js` | modified | 11,770 |
| `src/notify.js` | modified | 1,532 |
| `src/persona-verification.js` | new | 3,253 |
| `src/referral-code.js` | new | 1,000 |
| `src/uploads.js` | **modified again this round** | 5,353 |
| `src/routes/admin.routes.js` | **modified again this round** | 121,608 |
| `src/routes/auth.routes.js` | **modified again this round** | 45,286 |
| `src/routes/marketplace.routes.js` | **modified again this round** | 89,787 |
| `src/routes/misc.routes.js` | **modified again this round** | 32,231 |
| `src/routes/payments.routes.js` | modified | 46,657 |
| `src/routes/portfolio.routes.js` | **modified this round** | 11,681 |

## 2. cmd.exe deploy steps

```
cd path\to\trothen-backend
dir public\index.html
dir server.js
dir src\access-log.js
dir src\auth.js
dir src\commission.js
dir src\db-postgres.js
dir src\schema.sql
dir src\delivery.js
dir src\document-expiry-scheduler.js
dir src\provider-score.js
dir src\provider-score-scheduler.js
dir src\fraud-detection.js
dir src\notify.js
dir src\persona-verification.js
dir src\referral-code.js
dir src\uploads.js
dir src\routes\admin.routes.js
dir src\routes\auth.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\misc.routes.js
dir src\routes\payments.routes.js
dir src\routes\portfolio.routes.js
dir public\manifest.json
dir public\sw.js
dir public\icon-192.png
dir public\icon-512.png
dir public\apple-touch-icon.png
```

Compare against the table above, then:

```
git add .
git commit -m "Add service radius, video uploads for job photos, promotion banners"
git push
```

## 3. What's new this round

- **Service radius for providers.** Set in Settings, right next to the existing real-location sharing. Honest about its real limit: it only actually filters search results once *both* the provider and the customer have shared real GPS coordinates — if either hasn't, nobody gets hidden by a filter with no real data behind it.
- **Video uploads for job photos.** Customers can now attach a short video (MP4, MOV, or WebM — up to 50MB, vs. 5MB for photos) alongside images when posting a job or booking directly. Real file-content verification on video too (checking actual file bytes, not just trusting the file extension — same principle already used for photos and resumes). The photo viewer now plays video inline instead of trying to show it as a broken image.
- **Promotion/campaign banners.** Both super admins and regional managers can post one — a regional manager's promo is automatically scoped to just their own city; a super admin can go platform-wide or target a specific city. Shows as a dismissible banner at the top of the customer and/or provider dashboard (you choose the audience when posting). New "Promotions" section in the admin panel to create, activate/deactivate, and remove them.

## 4. Post-deploy smoke test

1. As a provider, set a service radius in Settings, share your real location, then search for that provider as a customer with your own location shared — confirm distance and radius filtering both work.
2. Post a job or make a direct booking with a short test video attached — confirm it uploads, and that opening it (as the provider, from Job Matches or Contracts) actually plays the video.
3. As a regional admin, post a promotion — confirm it only appears for customers/providers in your own city, not other cities. As a super admin, post a platform-wide one and confirm it reaches everyone.
4. Dismiss a promotion banner and refresh — confirm it stays dismissed in that browser.

## 5. What's still open

- **Live GPS "show provider position" tracking** — same answer as before: real status stamps exist, continuous live tracking is a distinct, larger project.
- **Formal provider quotes to customers** — likely already substantially covered by the existing negotiation/messaging system; want to understand the specific gap before building a second, separate feature.
- **App feels slow** — can't diagnose without live testing on your end.
- Unchanged: the provider settings logout bug (needs your repro steps), "make money Money," and "add content to AI chats" (still need more detail on both).

Everything else across every round of feedback is done and in this package.
