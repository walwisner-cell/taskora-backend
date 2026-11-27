---
key: disputes
title: Disputes
sections: disputes
video: disputes
updated: 2026-11-26
---
## What this part of Admin is for

A **dispute** is a problem on a booking that the two sides could not settle between themselves: the work was not done, was done badly, something was damaged, the pro never came, or the amount is wrong. While a dispute is open, **the money stays held by Trothen**: nobody is paid and nobody is refunded until someone in the team decides.

Your job is to look at the facts from both sides, decide fairly, and explain the decision in words both people understand. The decision moves real money, and in most cases it **cannot be undone** once the money has left Trothen. Take the time you need.

> **Rule:** Never decide a dispute because one side is louder, more polite, or a better customer. Decide on the facts: what was agreed, what was done, and what the evidence shows.

## Who can do what

| Who | Can see disputes | Can decide (refund, release, split) | Request info, escalate, reject, close, reopen |
|---|---|---|---|
| Disputes team | Yes | Yes | No |
| Customer service team | Yes | Yes | No |
| Legal team | Yes (to read) | No | No |
| Super admin | Yes | Yes | Yes |
| Custom admin | If "Disputes" is in their permissions | If their permissions include deciding | No |

- A team member who covers **one city or one country** sees only the disputes of customers in that area. A dispute outside your area is refused with "That dispute is outside the area you manage".
- Every decision and every action is written in the dispute's **Audit trail**, with your name, the time and your note. It cannot be edited or deleted.

## Where disputes come from

A dispute is opened by the **customer or the pro** on a booking, with **Report a Problem**:

- They must write what went wrong, in at least **10 characters** (up to 500).
- Only a booking that is **on** (active) can be disputed. A booking already completed, cancelled or refunded cannot.
- A booking can have only **one open dispute** at a time.
- The other side is told at once: "A dispute was opened on … Our team is reviewing it."
- The booking is **frozen**: its status becomes *disputed*, the pro can't be paid for it, and the customer's money stays held.
- Either side can add **evidence**: photos (JPEG or PNG) or PDF files, up to **10 MB** each. Evidence is stored privately, like ID documents.

Disputes also come from **Market orders and Rentals**. In Admin → Market, an order with a problem says "Problem reported. Decide it in Disputes", and the stay of a guest who reports a problem waits here too.

> **Note:** A **cash ride** cannot be disputed: Trothen holds no money. The rider is sent to the problem button on the ride instead, which reaches the team as a report.

### The 3-day check, and why disputes often come late

When a pro presses **I've finished the job**, the customer has **3 days** to press **Complete** or **Report a Problem**. About a day before the end, the customer gets a reminder. If they do neither, the job completes by itself and the pro is paid. So a customer who reports a problem near the end of the 3 days is not being difficult: the app told them to check the work first.

### Repeat disputes are flagged

When someone has been part of **3 or more disputes in 30 days**, Fraud & Safety gets a **Repeat Disputes** flag (high) for that account. Check Fraud & Safety before deciding a dispute that involves someone flagged: a pattern of disputes is information, though not proof.

## The Disputes page

Open **Disputes** in the menu on the left. You see **All Disputes**, newest first, with:

| Column | What it shows |
|---|---|
| Dispute | The dispute number (it starts with *dp_*). Use it when you talk about a dispute with the team. |
| Parties | The pro and the customer (pro ↔ customer). |
| Reason | What the person who opened it wrote. |
| Amount | The amount of the booking, in US dollars. |
| Status | Open, Escalated, Resolved, Rejected or Closed (see below). |
| Action | `Resolve` for one still to decide, `View` for one already decided. |

- **From / to dates:** choose dates to see only the disputes opened between them. `Clear` shows all again.
- `⬇ Download PDF`: a report of the disputes shown, for a meeting or an audit. The report is for the team only; keep it in Trothen's own files.
- Click a row, or `Resolve`, to open the dispute.

### What each status means

| Status | Meaning | Money |
|---|---|---|
| Open | Waiting for a decision. Also the status after "Request info" and after "Reopen". | Held |
| Escalated | Sent up for a senior decision. It can still be decided. | Held |
| Resolved | Decided: refunded, released or split. | Moved as decided |
| Rejected | Looked at and **not upheld**. The booking carries on as before. | Still held for the booking |
| Closed | Closed without a decision (for example, the two sides settled it). The booking carries on. | Still held for the booking |

## Inside a dispute

The window shows, from top to bottom:

1. **Reason, Amount in escrow and Status.** "Amount in escrow" is what Trothen holds for this booking.
2. **Timeline:** when the dispute was opened and where it stands.
3. **Evidence:** each file, with who uploaded it and when. Click a file to open it. Look at every file before you decide.
4. **Audit trail:** everything done on this dispute, by whom, with their note.
5. **Calls and voice messages between them:** when they called each other, whether the call was answered and how long it lasted, and voice messages with their length. **Calls are never recorded** and voice messages stay private to the two people: you see that they happened, not what was said. This settles claims like "he never answered my calls".

### How to look at a dispute, step by step

1. **Read the reason** carefully. What exactly is the complaint?
2. **Open the booking** in Customers & Providers (search either name) and read what was agreed: the job, the date, the price, any **extra work** approved later, and the messages between them.
3. **Look at every piece of evidence.** Photos of the work, receipts, screenshots.
4. **Check the timeline of the job:** did the pro press **Arrived**? When did they press **I've finished the job**? Did the customer report the problem within the 3 days?
5. **Check the calls:** did they try to talk it through?
6. **Hear the other side.** If one side has not said anything yet, ask (a super admin can use `Request Info`, see below, or contact them through Customers & Providers).
7. **Check Fraud & Safety** for either account.
8. **Decide**, and write a note both people will understand.

## Deciding: the three outcomes

At the bottom of an undecided dispute are three buttons. Each asks for a **note**: both the customer and the pro see it. It is required (3 to 500 characters).

### Release Escrow to Provider

Use it when the work was done as agreed.

- The held money is released to the pro's balance (less Trothen's commission at the pro's plan), ready for their next payout.
- The booking becomes **completed**, it counts as a completed job for the pro, and their plan level is checked.
- **Extra work** paid on this booking is released too.
- The customer is told the dispute is resolved, with your note. The pro is told the money is released and how much they now have available.

### Refund Customer Instead

Use it when the work was not done, or not as agreed, and the customer should have their money back.

- The held money goes back to the customer, and so does any extra work paid on the booking.
- The booking becomes **cancelled** ("Refunded after a dispute").
- Both are told, with your note.

### Split the payment

Use it when part of the work was done, or both sides share the fault.

1. Click `Split the payment`.
2. Type how much goes **back to the customer**, in US dollars. It must be more than 0 and less than the full amount. The window shows what each side gets, for example "Customer gets $30.00 back. Pro gets $70.00, before commission."
3. Write the note: why the payment is split this way.
4. Click `Split the payment`.

- The pro's commission is worked out on **their part only**.
- A split is only possible while **the whole payment is still held**. If any part was already released, refunded or paid out, it is refused.

> **Example:** a painter agreed to paint three rooms for $300 and painted two. The customer shows photos of the third room unpainted. A fair split: $100 back to the customer, $200 released to the pro. Note: "Two of the three rooms were painted, as the photos show. The customer gets $100 back for the third room."

### Writing the note

Both people read your note in their notifications. It is also part of the permanent record.

- Say **what you decided** and **why**, in one to three short sentences.
- Refer to the facts: the photos, the dates, what was agreed.
- Be neutral and polite. No blame words like "lying" or "scam".
- Never put anyone's phone number, address or ID details in a note.

> **Example:** "The photos show the leak was still there the day after the repair, and the pro did not come back when asked. The customer is refunded in full."

## Cash jobs

On a job paid in **cash**, Trothen never held the money, so there is **nothing to refund or split** through the app.

- You can still decide **for the customer** or **for the pro**, so the decision is on record and both are told.
- `Split the payment` is refused: "This was a cash job: Trothen holds no money to split."
- If the customer should get money back, say in the note **what the pro should pay back**. The customer is told Trothen did not hold the money and can't refund it through the app.

## When the money has already left Trothen

- **The pro has already been paid out** for this booking: a refund is refused. "The pro has already been paid out for this booking, so the system can't refund it." This has to be settled by hand: recover the money from the pro, or refund the customer from Trothen's own funds, and record what was done. Tell your manager and Finance.
- **The customer was already refunded:** releasing to the pro is refused.
- **A dispute is decided only once.** To change a decision, a super admin must **Reopen** it first (below), and only while the money is still inside Trothen.

## Super admin actions

A super admin sees five more buttons. Each needs a note, which goes into the audit trail. For every action except Escalate, the note is also sent to both sides.

| Button | What it does | Status after |
|---|---|---|
| `Request Info` | Asks both sides for more information. They receive your note as the question. | Open |
| `Escalate` | Marks it for a senior decision (for example a large amount, a legal question, or a safety matter). Both sides are told it has been escalated. | Escalated |
| `Reject` | The dispute is **not upheld**. The booking carries on as before, with the money still held; the 3-day check continues. | Rejected |
| `Close` | Closes it without a decision, for example when the two sides settled it themselves. The booking carries on. | Closed |
| `Reopen` | Opens a decided, rejected or closed dispute again. The money goes back on hold (a split is undone in full) and the booking is frozen again. | Open |

- **Reopen** is refused when the customer was already refunded, or the pro was already paid out: the money has left Trothen.
- Request Info, Reject and Close can only be used on an **open** dispute. On an escalated one, decide it, or reopen it first.

## Time limits

> **Policy:** Trothen's targets for disputes are for the company to set. Until they are set, aim to make a first contact with both sides within **1 working day**, and to decide within **5 working days**. Tell your manager about any dispute older than that.

While a dispute is open, the pro is not paid for the booking and the customer has no money back. Every day matters to both.

## Mistakes to avoid

- Deciding before looking at the evidence and the booking.
- Deciding on the first message only, without hearing the other side.
- A note that says only "Resolved". Both people must understand why.
- Using Refund when the pro has done part of the work: use **Split**.
- Sharing one side's personal details with the other.
- Downloading the PDF report and keeping it on a personal phone or computer.

## Quick checklist

1. Read the reason.
2. Read the booking: what was agreed, extra work, messages.
3. Look at every piece of evidence.
4. Check Arrived, I've finished the job, and the 3 days.
5. Check the calls between them.
6. Check Fraud & Safety for both.
7. Choose: Release, Refund or Split.
8. Write a clear, polite note with the reason.
9. If the money already left Trothen, tell your manager and Finance.
