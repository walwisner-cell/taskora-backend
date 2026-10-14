# Trothen v110 — Deployment Steps

9 files total: 1 new write-up, 8 modified. See `CHANGES_v110.md` for what each one does and why.

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public\index.html` | modified | 238,502 |
| `public\app\trothen.js` | modified | 1,468,598 |
| `src\account-privacy.js` | modified | 16,886 |
| `src\platform-settings.js` | modified | 35,810 |
| `src\routes\auth.routes.js` | modified | 81,887 |
| `src\routes\admin.routes.js` | modified | 232,549 |
| `src\routes\marketplace.routes.js` | modified | 142,992 |
| `src\routes\orders.routes.js` | modified | 35,973 |
| `CHANGES_v110.md` | new (this write-up, optional to deploy — doesn't affect the app) | 8,026 |

## 2. cmd.exe deploy steps

Open Command Prompt (cmd.exe) — not PowerShell. Replace `path\to\trothen-backend` with your real folder.

```
cd path\to\trothen-backend
dir public\index.html
dir public\app\trothen.js
dir src\account-privacy.js
dir src\platform-settings.js
dir src\routes\auth.routes.js
dir src\routes\admin.routes.js
dir src\routes\marketplace.routes.js
dir src\routes\orders.routes.js
```

Compare the byte counts `dir` shows against the table above. If any number doesn't match, stop and copy that file in again before continuing — it means the copy is incomplete or from the wrong place.

Once every number matches:

```
git add .
git commit -m "v110: fix provider country display, sticky pricing currency, PDF data export, categorized support numbers, and a store money-ordering bug; audit GPS"
git push
```

## 3. What's new in v110

See `CHANGES_v110.md` for the full plain-language write-up of all eight items: the five real bugs Joseph reported (two confirmed already working, no change needed), the store money-safety ordering fix, and the completed audits of the Store and GPS features.

## 4. Post-deploy smoke test

1. Open the provider directory as a customer and confirm each provider card shows a country.
2. On the membership/pricing page, switch the country dropdown a few times and confirm the prices shown always match the currency of whichever country is currently selected.
3. As a customer, go to Settings → Download My Data and confirm both the PDF and the .json download now work.
4. As a super admin, open Support Contact settings and confirm you can set separate numbers for Dispute, Onboarding, Promotion, and General, and that the Dispute help screen shows the Dispute number.
5. As a customer, buy something from a pro's store (pickup), confirm stock goes down by the right amount, the order total is correct, and marking it "received" completes the order and releases the seller's money exactly once.

## 5. Still open / not part of this release

The Liberia MTN MoMo integration remains gated (no real credentials set) and not live — the store money-ordering fix in this release is specifically there so that integration will be safe the moment it does go live, but turning it on is a separate, deliberate step for later.
