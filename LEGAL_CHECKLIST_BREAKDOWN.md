# Trothen Legal Readiness Checklist — What's Actually Handled

Going through your checklist item by item. Three honest categories: **already true today**, **fixed this session**, and **not something code can fix — needs you and the attorney**. I'm not going to pretend the third category doesn't exist just because it's not code work.

---

## TIER 1 — Before you take a single real payment

**1. Worker classification** — Not code. This is a real legal determination your attorney has to make about Pennsylvania's independent-contractor test. What I can tell you: the app's design already leans the right direction — providers choose which jobs to respond to, set their own prices (or negotiate them), set their own availability, and aren't assigned fixed hours or routes by Trothen. That's consistent with contractor status, but "consistent with" isn't the same as "verified by an attorney," which is exactly what this item says to do.

**2. Money transmitter / escrow structure** — **This is the single biggest gap in the whole app right now, and I want to be very direct about it.** Every payment, every escrow hold, every payout in the app today is simulated. No real money has ever moved through it, and there is no real Stripe Connect integration at all yet — this is not built. This is a much bigger project than anything else in this checklist: onboarding providers onto real Stripe Connect accounts, real webhook handling for payment status, real refunds, real payout timing, and making sure Trothen itself never touches customer money directly (which is the whole point of using Connect instead of your own bank account). I have not built this, and I don't think it should be started casually — it needs your attorney's sign-off on the structure first, and then it's a real, focused, multi-week build. Say the word when you're ready and I'll scope it properly.

---

## TIER 2 — Protect the company

**3. LLC liability shield** — Not code. Keeping business and personal money separate, signing contracts as the LLC, is something you do in how you run the business, not something in the app. One small thing worth checking once your LLC is actually formed: the generated contract PDF currently just says "Trothen," not the full legal entity name. Once you have the real LLC name, tell me and I'll update the contract template to reference it correctly — a two-minute fix once you have that name.

**4. Insurance** — Not code. Buying general liability, professional liability, and cyber-liability coverage is a business action.

**5. Strong Terms of Service clauses** — **Real, checkable gap, found it.** I read through your actual Terms of Service content in the app. It already has a Limitation of Liability section. It's missing the other three the checklist calls for: indemnification, mandatory arbitration, and a class-action waiver. I did not draft this language myself — arbitration and class-action waiver clauses have real, state-specific enforceability rules, and getting that wrong in a legal document is exactly the kind of thing that shouldn't come from an AI without your attorney's review. Bring this specific gap to your attorney meeting: the ToS needs those three clauses added, reviewed by a real lawyer, before it's genuinely protective.

---

## TIER 3 — Safety, trust & sensitive data

**6. Negligence / duty of care** — Partly real infrastructure already exists: identity verification (now with a real automated option — see below), a real dispute system, and automated fraud/safety flagging are all functioning. The "genuine, not just claimed" vetting process and a written incident-response process are operational/business items, not code.

**7. Background checks & FCRA compliance** — Not built yet, same category as the ID verification work: needs a real vendor account (Checkr is the standard choice for this specifically) before I can wire it in for real. I can build the integration once you have that account, the same way I built the ID verification integration — but the FCRA-compliant consent language and adverse-action notice process needs your attorney's review before it goes live, not just code.

**8. Professional licensing enforcement** — ✅ **Already fully built, verified this session.** Providers in a licensed trade (electrical, plumbing, etc.) are blocked from accepting jobs without a current, verified license on file — checked in three separate places in the code, not just in the Terms. Nothing needed here.

**9. Payment card protection (PCI)** — ✅ **Already correctly designed, verified this session.** Full card numbers are never stored anywhere in the app, for either customers or provider payouts — only the last 4 digits and brand. Worth noting: since real Stripe isn't connected yet (see item #2), there's no real card data flowing through the system at all right now, so PCI exposure is currently minimal by default. But the storage pattern is already built the right way for when real Stripe is wired in.

---

## TIER 4 — Compliance, money & housekeeping

**10. Privacy policy & data protection** — Mixed:
- **Privacy policy itself: missing.** There's a real Terms of Service in the app, but no separate Privacy Policy page at all. This is genuinely just legal-content work (what data you collect, why, how it's used) — I can build the page and the admin-editable content structure the moment you or your attorney has real policy language, the same way Terms of Service already works.
- **Role-based access: ✅ already extensive.** Admin accounts are already scoped by department (Verification, Disputes, Financial, Legal, Sales, and now HR) and by region — each sees only what their role needs.
- **Access logs: ✅ built this session, real and working.** There's now an actual log of which admin viewed sensitive data and when — wired into financial transactions, disputes, cross-region financial data, and the full customer/provider list. A new "Access Logs" screen (Legal department + super admin only) shows exactly who looked at what.

**11. Consumer protection** — Honest advertising and a cancellation policy are already substantively true in the app (real cancellation categories, real dispute/refund flow) — worth your attorney confirming the specifics are stated clearly enough, but the underlying mechanics are real, not just claimed.

**12. Taxes & 1099 reporting** — Not built. This only really matters once real payments exist (item #2), so I'd treat this as a "build once escrow is real" item rather than something to speculatively build now. Worth raising with an accountant regardless of timing.

**13. Trademark registration** — Not code. Business/legal action — register "Trothen" with an attorney.

**14. Website accessibility (ADA)** — Did a real pass this session: fixed a couple of images that were missing alt text (what screen readers rely on), and confirmed the page already declares its language properly and most images already had alt text. Being honest about the limits here: a genuine ADA/WCAG compliance claim needs real testing with assistive technology (screen readers, keyboard-only navigation, color contrast tools) — not something I can fully verify by reading code. What I fixed is real and correct; it's not the same as a certified accessibility audit, and I don't want to imply it is.

**15. Employment law for your staff** — Not code. Finalizing an employee handbook with Pennsylvania-compliant anti-harassment, wage/hour, and at-will provisions is HR/legal document work.

---

## The honest short version

**Already true, verified this session:** #8 (licensing), #9 (card protection), and the RBAC half of #10.

**Real gaps I fixed with code this session:** the access-logs half of #10, and the accessibility spot-fixes in #14.

**Real gaps I found but didn't touch, because they need your attorney, not me:** the three missing ToS clauses in #5, and confirming #1.

**The one that matters most and isn't done:** #2, real Stripe Connect. Everything else on this list is either already fine or a contained fix. This one is a real, substantial build that should happen deliberately, with your attorney's sign-off on the structure first — not something to rush into alongside everything else.

**Pure business/legal actions, not code at all:** #1 (partially), #3, #4, #6 (partially), #12 (until #2 exists), #13, #15.
