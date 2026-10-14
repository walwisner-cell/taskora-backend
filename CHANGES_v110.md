# Trothen v110: six real bugs fixed from Joseph's reports, a store money-safety fix, and a full audit of the Store and GPS features

## 1. Liberia and the US no longer appear mixed together in one provider list
A provider card's own country was missing from the data sent to the browser, so the page had nothing to show except the city — on a listing page with no visible country, pros from different countries could look like they were all in one list even though the real search behind them was already correctly scoped to one country at a time. Fixed by sending the country with each provider, so the card can show it.

## 2. The membership/pricing page no longer gets stuck on the wrong currency
Changing the country dropdown on the pricing page didn't always update the prices shown — sometimes it kept showing the currency from the country you'd left. The page now tracks whether you've actually picked a country yourself versus just loaded the page, so your choice always wins and the dropdown and the prices shown always agree.

## 3. Provider Score — checked, already working
Joseph reported the provider score not showing on the frontend. Testing this live end-to-end (as a provider, with real score data) found the panel and the page that holds it were already wired up correctly and displaying the real number. No change was needed here; flagging this as checked and working rather than silently skipping it.

## 4. "Download My Data" now gives you a real PDF
This used to only offer the raw data file (.json) — asking for a PDF didn't produce one. There is now a real PDF export, built the same way as Trothen's other official documents (contracts, receipts, tax reports), covering your profile, bookings, payouts, disputes and reviews in readable form. The original .json download is still there too, side by side, for anyone who wants the raw file instead.

## 5. Customer service numbers: Dispute, Onboarding, Promotion and General, each separately
Before, there was only one phone number per region — General. Now admins can set a different number for Dispute, Onboarding and Promotion as well, per region, with General as the one that's always there as a fallback when a category hasn't been given its own number. The Dispute help screen now shows the Dispute number specifically, instead of only the General one.

## 6. Ringtone — checked, already working as designed
Joseph reported the ringtone not ringing. Reviewed the real notification-sound code and how it's documented for users: it plays correctly under the conditions it's built for (the tab open, sound not muted by the browser or the phone). No bug was found in the code itself. If this is still happening for Joseph on a specific phone or browser, the next useful piece of information would be which phone/browser and whether the tab was open and unmuted at the time — that would point to a device-specific cause rather than a platform bug.

## 7. Store: a real, if currently dormant, money-safety bug fixed
Found and fixed an ordering bug in how a store purchase is processed: the system was recording the order and taking the goods off the shelf *before* actually charging the customer, instead of after. Today, with Liberia mobile-money payments still turned off everywhere, the charge step can't fail, so this bug has never actually hurt anyone yet. But the moment Liberia mobile money goes live, a charge that MTN's side rejects would have left a paid-looking order sitting in the system with stock already taken away, for goods nobody had actually paid for. Fixed by charging first, and only ever recording the order or touching stock after the charge succeeds — for both a store purchase itself and a driver's delivery fee for that purchase. Verified live end-to-end (store setup → stock → a real purchase → correct stock reduction → correct order total → correct escrow record) that this fix doesn't change anything about the normal, already-working path.

## 9. "Browse All Pros" — a real country filter
On the full provider directory page ("Browse All Pros"), pros from different countries could show up together in one list with no way to pick just one country — the same kind of mixing item 1 fixed on the homepage, but on a page that's deliberately meant to show every provider, so it needed a different fix: a real filter, not a scope. There's now a country dropdown on that page, right next to the category filter and the sort dropdown, listing only the countries that actually have a pro on the platform. It works together with the category filter (e.g. "Plumbing" + "Liberia" at once), and the count at the top always says plainly which category and country you're looking at.

## 10. The same money-safety fix, applied to direct bookings and job-board hires too
After fixing the store-purchase ordering bug above, checked whether the same pattern existed anywhere else — it did, in three more places: booking a specific provider directly, a customer's job posting being matched to a provider, and a provider accepting a negotiable price offer. In all three, the booking was being written to the system (and, in the offer case, even marked "active" and confirmed) *before* the actual charge to the customer was attempted, instead of after. Fixed the same way: the charge now always happens first, and the booking only gets written down, marked matched, or marked active once that charge has actually succeeded. Verified live for all three: a normal direct booking, a normal job-selection hire, and a normal negotiable-offer acceptance all still work exactly as before — the only change is the order money changes hands relative to when the paperwork is written.

Beyond that one fix, the rest of the Store feature — goods management, stock holds, pricing in different currencies, delivery by pickup/seller/driver, hand-over photo records, order completion, and receipts — was read through in full and tested live, and found to already be built correctly: money is only ever released once per order, a cancellation after the goods have already changed hands is correctly blocked and routed to a dispute instead of a refund, and a driver's delivery is paid and tracked independently of the seller.

## 8. GPS and location: checked, already working correctly
At Walter's request, went through every part of the app that uses real GPS location — the distance math itself, sharing your location as a provider or a customer, live location while a pro is en route to a job, the pick-up/drop-off photo records with their own location and route trail, and the radius a provider is willing to travel for a job. All of it was found to already be built correctly: the distance calculation is accurate, bad or fake coordinates (like 0,0, the "middle of the ocean" GPS has when it fails) are correctly rejected everywhere this data comes in, and a provider who hasn't shared their location or set a travel radius is never silently hidden from search — only ever filtered out when there's a real distance to compare against. No bugs found, no changes made.

## Tested
- Live, end-to-end, against a real running copy of the app for every item above: provider listing, pricing-page currency switching, the PDF export, the new categorized support numbers, and the full store purchase → stock → completion → receipt flow.
- The store money-safety fix specifically verified not to change the normal (non-mobile-money) purchase flow: stock still goes 5 → 3 on a 2-item purchase, the $25 goods + $5 store fee = $30 total is still correct, and the escrow record is still created exactly once, in the same "held" state as before.

## Files changed
`public\index.html` (only the version tag on the script line), `public\app\trothen.js`, `src\account-privacy.js`, `src\platform-settings.js`, `src\routes\auth.routes.js`, `src\routes\admin.routes.js`, `src\routes\marketplace.routes.js`, `src\routes\orders.routes.js`.

This package includes everything from v86 onward, including v109, v109.1 and v109.2.
