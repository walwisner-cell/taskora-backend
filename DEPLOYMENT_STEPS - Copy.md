# Trothen — Deployment Steps (Final)

29 files total. Every backend file syntax-checked, and — after finding two real bugs mid-build this round — every modified router was also actually mounted on a real Express app to confirm it loads and works, not just parses.

## 1. Files and where they go

| File | Status | Bytes |
|---|---|---|
| `public/index.html` | modified | 799,818 |
| `public/manifest.json` | new | 793 |
| `public/sw.js` | new | 700 |
| `public/icon-192.png` | new | 15,672 |
| `public/icon-512.png` | new | 67,430 |
| `public/apple-touch-icon.png` | new | 14,158 |
| `server.js` | modified | 10,042 |
| `src/access-log.js` | new | 1,867 |
| `src/auth.js` | modified | 7,606 |
| `src/commission.js` | modified | 5,856 |
| `src/db-postgres.js` | **modified again this round** | 14,029 |
| `src/schema.sql` | **modified again this round** | 32,849 |
| `src/delivery.js` | new | 3,661 |
| `src/document-expiry-scheduler.js` | new | 3,689 |
| `src/provider-score.js` | new | 8,968 |
| `src/provider-score-scheduler.js` | new | 3,810 |
| `src/fraud-detection.js` | modified | 11,770 |
| `src/notify.js` | modified | 1,532 |
| `src/persona-verification.js` | new | 3,253 |
| `src/referral-code.js` | new | 1,000 |
| `src/uploads.js` | modified | 5,353 |
| `src/routes/admin.routes.js` | **modified again this round** | 124,095 |
| `src/routes/auth.routes.js` | **modified again this round** | 45,286 |
| `src/routes/marketplace.routes.js` | **modified again this round** | 90,770 |
| `src/routes/misc.routes.js` | **modified again this round** | 37,012 |
| `src/routes/payments.routes.js` | **modified again this round** | 55,354 |
| `src/routes/portfolio.routes.js` | modified | 11,681 |

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
git commit -m "Add trust score in matching, favorites, contact masking, tips, scope-change requests, membership, search sort"
git push
```

## 3. What's new this final round

- **Trust score actually used in matching, and shown to customers.** The score existed and displayed on the provider's own dashboard, but never influenced who got ranked higher, and customers never saw it at all. Both fixed. Also swapped out a fabricated "Responds in ~1 hr" claim that was never based on real data — replaced with the real score.
- **Favorite Providers** — save a pro to rebook them later, a real tab on the customer dashboard.
- **Contact info masking for admins** — phone and email were fully visible to any admin with People access, including super admin. Now masked by default everywhere, with an explicit "Reveal" action that's logged.
- **Directory sort control** — Best Match, Highest Score, Highest Rated, Most Jobs, Nearest.
- **Tips for customers** — genuinely optional, added when marking a job complete. Traced through the whole payout system to make sure a tip is never commission-taxed like regular job income — it's tracked separately and added to what the provider receives after commission, not folded into the taxable total.
- **Scope-change / additional payment requests** — when a job turns out bigger than what was posted or booked, a provider can request a specific additional amount with a reason. Nothing changes until the customer explicitly approves — approving updates both the contract total and the actual held escrow for real.
- **Trothen Membership** — a real $9.99/month opt-in for customers, with its own subscribe/cancel flow rather than a raw toggle anyone could flip — same reasoning that made provider plan changes admin-only earlier this session.

## 4. What I checked and did NOT duplicate

- **Fair Lead Distribution** — already substantially covered: job leads already go to every verified provider (not just paying advertisers), and the featured carousel already uses fair weighted rotation. Didn't build a second system.
- **Search by name, booking history, digital receipts, "describe the problem and get matched," reviews after every job** — all already existed from earlier rounds.
- **AI Customer Support answering 24/7 and escalating to humans** — found this already fully built: a real, working connection to the Anthropic API with an honest fallback and human handoff. It's just sitting unconfigured. This also answers the old "add content to AI chats" question from much earlier — that's what it was referring to. Needs `ANTHROPIC_API_KEY` to go live.

## 5. What I checked and did NOT build, with real reasons

- **Travel-Time Protection** ("don't send a provider 40 miles for a $35 job") — this needs real distance data between a job's address and a provider, which needs converting a free-text address into GPS coordinates. That requires a geocoding service (like Google Maps Geocoding) — a real vendor dependency this app doesn't have yet, same category as Stripe Connect or real background checks. I didn't build a fake version that pretends to have precision it doesn't. The service radius feature built earlier this session is the closest real tool available today.
- **Household/family accounts, AI-powered scheduling, smart multi-stop route planning, property management for real estate companies** — all real, reasonable ideas, but each is a meaningfully sized feature that needs more specifics from you before building the right thing rather than guessing (who counts as "authorized" on a household account and what can they do? does route planning need real-time traffic, or just distance order? what does a property management company's dashboard actually need to show?).
- **"Make sure money is always show at all time" and "AI voice matches"** — too vague to act on. Happy to build either once there's more to go on.

## 6. Post-deploy smoke test

1. Search or browse providers and confirm the new sort dropdown works, and that a provider's Trothen Score shows on their card and profile.
2. Favorite a provider, confirm it shows up under the customer's new "Favorite Pros" tab.
3. As an admin, open the People list and confirm phone/email show masked, then confirm "Reveal Contact Info" in the detail view works and shows up in Access Logs.
4. Mark a booking complete with a tip amount, confirm the provider gets notified and the tip shows correctly (untaxed) when they request a payout.
5. As a provider on an active job, request additional payment; as the customer, confirm you can see and approve/decline it, and that approving updates the contract total.
6. As a customer, subscribe to Trothen Membership in Settings, confirm it shows as active, then cancel and confirm it reflects immediately.

## 7. Still open, unchanged from before

The provider settings logout bug (needs your repro steps), and the real Stripe Connect / escrow build — still the single biggest remaining piece, and still deserving its own deliberate project with your attorney's sign-off first.

Everything else across every round of feedback this session is done and in this package.
