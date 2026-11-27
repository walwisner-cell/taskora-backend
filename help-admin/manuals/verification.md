---
key: verification
title: Verification Queue: checking IDs
sections: verification
video: verification
updated: 2026-11-26
---
## What this part of Admin is for

Every customer and pro on Trothen must prove **who they are** with an ID and a **face photo**. A person checks each one here. When you approve an ID, the person becomes **Verified**:

- a **customer** can then post jobs and book;
- a **pro** then appears in search, with "ID checked" on their profile.

Customers let pros into their homes because of this check. **It is the most important safety check on Trothen.** Take the time you need.

> **Rule:** If you are not sure, **do not approve**. Reject, with a clear reason, and the person can send a better photo. A wrong approval puts customers at risk; a careful rejection only costs the person a few minutes.

## Who can check IDs

- The **Verification team** (all areas, unless their account covers one area).
- The **regional admin** of the person's city or country.
- A **super admin**.
- A **custom admin** with "Verification" in their permissions.

Nobody can check **their own** ID: it is refused. Other admin accounts see "Your admin account can't open ID submissions" in place of the queue.

**Every file you open is written in the Access Logs**, with your name and the time.

## How an ID reaches the queue

The person goes to **Verification** in their account and sends:

1. the **type of document**: the list follows their country. In Liberia, and wherever no special list is set, it is **Passport**, **National ID** or **Driver's License**;
2. the **full legal name exactly as printed** on the document;
3. a photo of the **front** of the ID, and the **back** if it has one;
4. a **face photo** (a selfie), taken then.

- Files must be real JPEG, PNG or PDF files: anything else is refused.
- At most **5** submissions in a day.
- A new submission replaces the one still waiting (the old one becomes *superseded*).
- Trothen compares the **name on the ID** with the **name on the account**. If they look the same, the status is **Pending**. If not, it is **Needs review**, and the reviewers are told.
- Each ID has a **48-hour** review window. Past it, the row shows **Overdue** in red.

Some countries can use **Persona**, an automatic ID check. When Persona passes and the names match, the person is verified by itself. When Persona fails, or the names differ, it comes here as **Needs review**, marked "Checked by Persona".

## The queue

| Column | What it shows |
|---|---|
| Applicant | The account name, customer or pro, city and country. |
| Name on the ID | What they typed, and **Matches account** (green) or **Doesn't match account** (red). |
| Document | The type, and `View documents` (and `View back of ID` when there is one). |
| Submitted | When they sent it. |
| Status | Pending, Needs review, and **Overdue** past 48 hours. |
| Action | `Approve` and `Reject`. |

Work **oldest first**, and overdue ones before anything else.

## Checking an ID, step by step

Press `View documents`. One window shows the **front of the ID**, the **back** (if any), and the **face photo**, side by side. Click a picture to see it full size.

Check each of these. **All** must be right to approve:

1. **It is a real ID document**, of the type they chose, not a photo of a screen, a drawing, a printout, or a picture from the internet.
2. **It is not expired.** Read the expiry date.
3. **It can be read:** the photo, the name, the date of birth and the number are clear, and nothing is covered or cut off.
4. **The name on the ID matches the account.** Small differences are fine (a middle name missing, initials). A different person's name is not.
5. **The face photo shows the same person** as the photo on the ID. Look at the shape of the face, the eyes, nose and mouth, not the hair or glasses.
6. **The face photo is live:** a real person, not a photo of a photo, a screen, or the ID photo itself.

> **Warning:** Signs of a false ID: the font or spacing looks wrong, the photo looks pasted on, edges are blurred around the name or the dates, the same ID is used by two accounts, or the face photo is a picture of the ID. **Reject**, and tell Fraud & Safety.

### Approve

Press `Approve`. The person becomes **Verified** at once and is told. You see "ID approved. This person is now Verified."

### Reject

Press `Reject` and write the reason. **The person sees your reason**, and can send a new ID. Write what to fix, in plain words:

| Problem | A good reason |
|---|---|
| Blurred photo | "The photo of your ID is blurred, so we can't read it. Please take it again in good light, with the whole card in the picture." |
| Expired ID | "Your ID expired on 3 March 2025. Please send an ID that is still valid." |
| Name doesn't match | "The name on the ID is not the name on your account. Send an ID in your own name, or contact support to correct your account name." |
| No face photo, or face not clear | "We can't see your face clearly in the face photo. Please take a new one, facing the camera, in good light." |
| Faces don't match | "The face photo does not match the photo on the ID. Please send your own ID and a photo of yourself." |
| Not an ID | "This is not an ID document. Please send your National ID, passport or driver's licence." |

Never write "fake" or "fraud" in a reason. If you think it is fraud, reject with a neutral reason and report it in Fraud & Safety.

## Past checks

IDs already approved or rejected, with who decided and when. **Search by name** to find someone. The files can be opened until they are **deleted** (below).

## Not verified yet

People who have **not sent an ID**, or whose last one was rejected. There is nothing to approve for them yet. A customer can't post a job or book, and a pro is not in search, until they send an ID and it is approved.

Press `Remind` to send them a reminder.

## "Verified" with no reviewed ID

Accounts marked Verified **without an approved ID on file** (for example from before IDs were required). For each:

- `Ask for ID`: asks them to send one.
- `Remove badge until checked`: takes away "Verified" until an ID is approved.
- `Ask everyone on this list for their ID`: asks them all at once.

> **Policy:** Whether to remove the badge from everyone on this list, and by when, is for Trothen to decide. Until then, ask for their ID first, and remove the badge if nothing comes within 14 days.

## Guarantors to call

Pros give up to **3 guarantors**: people who know them and will vouch for them. The team calls each one. A verified guarantor raises the pro's background-check score.

- The list shows one card per pro, the people **To call** first. The tabs are **To call**, **Verified**, **Not accepted** and **All**, and there is a search box.
- Each number is written in international form, with `Call` and `WhatsApp` buttons.
- Under a guarantor, the card can warn you:
  - "Same phone number as the pro" or "Same name as the pro": **this is not a separate person**. It can't be verified; mark it Not accepted.
  - "Also a guarantor for … other pros": one person vouching for many pros can be genuine (a pastor) or a sign of a paid guarantor. Ask how they know each one.
  - "Check: …": something to ask about, such as a number that doesn't look right, or a relationship that isn't clear.
- The card says if the pro's ID is verified yet, and warns when **all** their guarantors are family.

### Each call

1. Call the guarantor. Say you are calling from Trothen about the pro, by name.
2. Ask **how they know the pro**, and **for how long**.
3. Ask whether they would **trust the pro in their own home**.
4. Then mark them:
   - **Verified:** only after you have spoken with them. Write what they said, for example: "Former employer, 4 years, would trust him in his home." The pro is told.
   - **Not accepted:** the number does not work, they don't know the pro, or they would not vouch for them. Write why. The pro is asked to name someone else.
   - **Called, no answer yet:** you called but did not reach them, or need to call back. The card then shows "Called, not finished".
   - **Put back:** puts a guarantor back on the list to call.

> **Rule:** At least **one** guarantor should not be family: a past employer, a client, a landlord, a pastor or imam, or a community leader. If all are family, ask the pro for another.

## How ID files are kept

- ID and face photos are **deleted after a decision** (approved, rejected or replaced), after the number of days set in **Delete files after** (30 by default; 0 keeps them). The record of the check is kept.
- Files are kept longer, automatically, while the person has an open dispute, an open fraud review, or an account on hold.
- The box at the bottom warns if the server is not keeping ID files on a permanent disk. That is for the technical team to fix (Render setting).

Change the number of days only with your manager's agreement: keeping ID photos longer than needed is a privacy risk.

## Mistakes to avoid

- Approving because the person is waiting or insists. The 48 hours is a target, not a reason to approve a doubtful ID.
- Approving when the name or the face doesn't match.
- A reason the person can't act on ("Rejected", "Invalid").
- Talking about someone's ID, or showing it, to anyone outside the check.
- Taking photos of IDs or saving them anywhere.

## Quick checklist

1. Oldest and overdue first.
2. View documents: front, back, face photo.
3. Real, not expired, readable.
4. Name matches the account.
5. Same face, live photo.
6. All right: Approve. Any doubt: Reject with a clear reason.
7. Suspect fraud: reject neutrally, and report it in Fraud & Safety.
