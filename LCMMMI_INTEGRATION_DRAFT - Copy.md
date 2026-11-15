# Trothen ↔ LCMMMI (Lonestar Cell MTN Mobile Money) — Draft Answers & Integration Notes

This is a starting draft, not a finished submission. Every answer below reflects what Trothen's code actually does today, checked directly against the real codebase rather than guessed at. Anywhere the honest answer is "not yet" or "needs a real business decision," it says so plainly — nothing here is dressed up to look more finished than it is. Before this goes to LCMMMI for real, it needs your review, and the items flagged "NOT CODE" need an attorney or compliance advisor, not me.

---

## Part 1 — How this would actually connect to Trothen's code

**The real integration point already exists and is now scaffolded.** Every escrow hold in the entire app runs through one single function (`fundEscrowForContract` in `src/routes/marketplace.routes.js`). A new file, `src/liberia-momo.js`, now sits ready right at that exact point — it checks whether real LCMMMI credentials are configured, and if they're not (which is the case right now, on purpose), it changes nothing at all. Every existing booking, for every country, works exactly as it did before this.

**What's still missing before this can go from scaffold to real:** LCMMMI's actual technical API documentation — the endpoint URLs, the authentication method, the exact request and response format. None of the documents provided so far include this; they're business, legal, and commercial terms. That document is what LCMMMI hands over once the partner application clears their due diligence — it isn't something to write from the SLA and questionnaires alone.

**What's real and already confirmed from their paperwork**, so the eventual build has real numbers to work against:
- Collections ("pull"): 2% fee per payment, taken automatically from Trothen's own collections account
- Disbursement: $10/month flat fee, plus a real cash-out fee paid by whoever receives money (roughly $0.50–$15 depending on the amount), taken from a disbursement account Trothen has to pre-fund through an LCMMMI partner bank
- No cost per API call either direction
- Collections specifically requires Trothen to build its own real settlement/reconciliation logic — LCMMMI's own contract language calls this out directly, not something to skip
- Transaction history comes as downloadable statements (six months of history), not a live webhook — real reconciliation needs a scheduled job on Trothen's side

---

## Part 2 — Draft answers: IT Security Questionnaire (Annexure 2)

**Incidents, notification, escalation (Q1–8):** Not yet — there's no formal, written incident classification or escalation process today. This is a real gap, and it's a business/operations document to write, not something code produces on its own.

**Vulnerability management (Q9):** No formal ongoing program with a defined "Mean Time to Remediate." What exists today is real but manual: security review passes done directly against the actual code during development, most recently a full pass that found and fixed real issues (see below) — not the same thing as a continuous, documented vulnerability management program.

**Backups (Q10):** Depends on the specific backup configuration of the Render/PostgreSQL plan in use — worth confirming the exact retention and recovery-testing details directly with Render rather than assuming.

**Data (Q11, 15):** Names, emails, phone numbers, physical addresses, government ID documents (providers only, stored in a separate, access-restricted location — not the main database), payment method details (only the last 4 digits and card brand are ever stored, never a full card number), location data tied to bookings, in-app messages, and dispute records.

**Who processes it (Q12):** Trothen's own systems. No formal data processing agreement currently exists with any of the third-party services in use (see Q26 below) — this is real, uncompleted paperwork, not a code gap.

**Data protection laws complied with (Q13):** None formally adopted as a named compliance program yet (e.g., no GDPR or CCPA program has been established). Real gap — needs a business/legal decision on which framework(s) actually apply.

**Where is data hosted (Q14):** Currently the United States (Oregon, on Render) — **this directly conflicts with the stated requirement that data can only be stored in Africa or Europe.** This needs to move before this integration can proceed. Render offers a Frankfurt, Germany region as a real option — I can make that change once you're ready, but if there's already real production data in Oregon at that point, it needs a real migration plan, not just a settings change.

**Security measures (Q16):** This part is genuinely strong, and it's real, verified today:
- Passwords hashed with bcrypt (never stored in plain text or reversibly encrypted)
- Every admin account requires two-factor authentication — not optional
- Rate limiting on login, signup, verification codes, disputes, and messages
- HTTPS enforced, with HSTS
- Role-based access control — admin accounts are scoped by both department and region, seeing only what their role needs
- Uploaded identity documents are checked against their actual file content, not just their filename, before being accepted
- A real, tested idle-timeout: anyone signed in is automatically signed out after 20 minutes of inactivity
- A real audit log of who viewed sensitive customer/provider data and when

**Audit (Q17):** No SOC 2, ISO 27001, or equivalent independent certification exists. No formal third-party penetration test has been performed. **This is the single biggest real gap on this whole questionnaire** — closing it is its own project, with real cost and lead time, separate from anything in this build.

**User access / termination controls (Q18):** Real and immediate — suspending an account takes effect on the very next request it makes, not just the next time it logs in.

**Security awareness training (Q19):** None formal exists today — a small team, no structured annual program yet.

**Network security / hosting (Q20–23):** Trothen runs on Render, a managed hosting platform, not a self-operated cloud environment — there's no custom firewall or network diagram to provide because the underlying network is Render's to manage, not Trothen's. No scheduled, automated vulnerability scanning is currently in place.

**2FA (Q24):** Required for every admin account. **Not currently required for customer or provider accounts** — worth deciding whether LCMMMI's requirement is read to cover those too.

**Application security (Q25–28):** Node.js/Express backend, PostgreSQL database, a single web frontend. No automated security scanning tool is wired into the build process today — reviews so far have been direct, manual passes through the real code.

**Data security (Q29–34):** Encryption in transit via Render's managed HTTPS. No formal, written data retention or deletion schedule exists yet — this is a real, undone piece of work, not a technical limitation.

**Compliance (Q35):** No formal, written Information Security Policy document exists yet.

---

## Part 3 — Draft answers: Data Privacy Questionnaire (Annexure 1)

**What personal data (Q1, 4):** Name, email, phone number, physical address, government ID (providers), masked payment details, booking location data, in-app messages, dispute records.

**Processor or Controller (Q2):** For Trothen's own users, Trothen determines why and how their data is used — the role that's typically called a Controller. For personal data specifically received through or connected to LCMMMI's Mobile Money service, that role needs to be worked out directly with LCMMMI — **this is a real legal determination, not something I can answer on Trothen's behalf.**

**Processing outside MTN MoMo's infrastructure (Q3):** Yes — Trothen runs its own separate systems (Render, PostgreSQL) entirely apart from MTN's own infrastructure. This is a structural fact worth being direct about, since it's exactly the kind of thing this question is trying to surface.

**Privacy policies and training (Q5–8):** A Terms of Service exists in the app today. **A standalone Privacy Policy does not exist yet** — this was already a known gap going into this. No formal privacy training program, and no named Data Privacy Officer, exist yet either.

**Data minimization, retention, destruction (Q9–15):** Partial. Role-based access already limits who can see what day to day, but there's no formal, written policy governing data minimization or retention timelines. No employee/contractor NDA program is something I can confirm one way or the other — that's a business record, not code.

**International transfer (Q16–17):** Yes, currently — data is hosted in the United States, which is an international transfer relative to Liberia. Same underlying issue as the hosting question above.

**Explicit consent (Q18):** Every signup requires accepting Trothen's Terms of Service before the account can be used. Whether that specifically satisfies what LCMMMI means by "explicit consent" for this purpose is worth a direct answer from an attorney, not an assumption on my part.

**Regulatory management, privacy risk management (Q19–24):** No formal ongoing regulatory-tracking process, and no independent privacy reviews have been conducted.

**Third-party risk (Q25–29):** Real answer: Trothen currently relies on SendGrid (email delivery) and Twilio (SMS and phone verification) as third-party processors, plus Render for hosting. No formal, signed data processing agreements with any of them are confirmed to exist today — worth checking and putting in place as real, separate paperwork.

---

## The honest short version

**Real, already-true strengths worth putting on the form as-is:** password security, mandatory admin 2FA, rate limiting, role-based access control, the audit log, the idle-timeout, and the file-upload validation. These are genuinely solid and already verified, not aspirational.

**The two real blockers, in order of size:**
1. **No SOC 2/ISO 27001 (or equivalent) certification, and no audited financials.** This is the biggest one — it's its own real project with real cost and lead time.
2. **Data currently hosted in the US, not Africa or Europe.** Fixable, and I can make that change — but it deserves a deliberate migration plan if there's already real data in place by then.

**Everything else** — the written policies, the named officers, the privacy policy page, the formal training program — is real, doable paperwork and process work. None of it is a code problem. I can build the Privacy Policy *page* itself the moment there's real policy language to put on it, the same way Terms of Service already works — but I can't write the policy's actual content, since that's a legal document, not a technical one.
