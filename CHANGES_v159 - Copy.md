# Trothen v159: messages in front of pop-ups, and what happens when no pro is nearby

What Walter asked:
1. "the message is at the background and cannot see can the message come at the front"
2. "after you post a job and the system notifies you of none around, what should be the next step, best practice and international standards"

## 1. Messages now show in front
**Problem:** the short messages that pop up at the bottom (for example "Add where the job is…") sat behind the dimmed background of an open pop-up, so they couldn't be read. Also:
- a second message could be hidden early by the timer of the first;
- even when hidden, the message could catch a tap meant for a button underneath.

**Fix:**
- **A message always shows in front.** While a pop-up is open it appears at the top, clear of the pop-up's buttons (Next, Back, the choices). With no pop-up, it is in its usual place.
- **It stays long enough to read:** 4 to 9 seconds, by how long the message is.
- **Tap it to put it away.** A new message is never cut short by the one before.
- **Once hidden, it never catches a tap.**
- **Screen readers read it out** (a "status" message, as the accessibility standard WCAG 4.1.3 asks).

## 2. When a job is posted and no pro is nearby
### What the standard practice is
Thumbtack, TaskRabbit, Airtasker and Bark all do much the same:
1. They say so honestly, straight away, and never show made-up pros.
2. They keep the job open and send it to pros as they become available, then tell the customer.
3. They give the customer something to do now:
   - look at pros further away or online;
   - invite a pro they know;
   - adjust the job.
4. They tell their own team where demand has no supply, so pros can be found there.
5. They charge nothing until a pro is chosen.

### What Trothen did before
The screen said "we'll notify you the moment someone's available", but nothing did that. A job was only sent to the pros listed at the moment it was posted, so a pro who joined an hour later never saw it. And if the connection failed while posting, it showed three made-up "sample" pros with Book buttons.

### What it does now
- **Honest screen:**
  - "Your job is posted. No pro is free nearby yet."
  - "Your job stays open until Tue, Nov 17. We send it to new Roofing pros in your area as they join or become free, and tell you straight away. Nothing is charged until you choose a pro."
- **"What you can do now",** with three buttons:
  - **See all pros:** All pros, opened on that kind of work. Some pros work across cities, or online.
  - **Invite a pro you know:** shares a link (WhatsApp, SMS, email, or copied) that opens Trothen's sign-up as a pro.
  - **Done.**
- **The promise is now kept:**
  - Every 10 minutes, open jobs are sent to pros who have become available since: newly verified, added that kind of work, or back from a pause.
  - The same area rule as posting applies: the city first, then the region, then the country, and never another country.
  - A few pros at a time, and never the same pro twice.
  - The customer is told once: "Good news: a pro who does Roofing near you is now available, and your job was sent to them."
- **The team is told:**
  - A super admin, and the regional admin for that city or country, get a notice: "A customer in Kumasi posted a Roofing job and there is no verified pro for it there yet."
  - Reports & Analytics has a new "Customers Waiting With No Pro" table for the last 30 days (kind of work, city, how many jobs), so you know where to recruit pros.
- **When the job closes** with nobody hired, the customer is told and offered next steps (as before).
- **If posting fails** (no connection), it says so and keeps the form. No made-up pros.
- **In Spanish too.**

## Found in the re-verification
- **A part of the day ("Morning", "Afternoon") was turned into an exact time.** If a booking said "Morning (8–12pm)", v156 saved it as 08:00, and then:
  - it was shown as "8:00 AM";
  - the arrival reminders treated it as an agreed 8:00 arrival.

  It is now kept as words, shown as words, and never treated as an exact time. Only a clock time ("2:30 PM", "14:30") is.
  - It is still read as the start of that part of the day for how long the pro has to answer.
  - `t156` checks it.

## What I tested
- **New `t159` (14 checks), on a computer and a phone:**
  - with the Post a Job pop-up open, the message is in front, fully on screen, and not over the pop-up's buttons;
  - tapping puts it away;
  - once hidden it catches no taps;
  - a new message isn't cut short;
  - it goes back to its usual place with no pop-up;
  - screen readers hear it.
- **New `t159b` (14 checks):**
  - a Roofing job in Kumasi with no roofer: the team is told, and it shows in Reports & Analytics;
  - a roofer joins and is verified: within 10 minutes the job is sent to them, once, and the customer is told once;
  - the roofer sees it and can answer;
  - a roofer in another country is never sent it;
  - on a computer and a phone: the new screen and its three buttons;
  - the invite link opens sign-up as a pro.
- **Every earlier suite.**

## Files
- **New:**
  - `src/job-backfill.js` (sending open jobs to newly available pros, and telling the team)
  - `CHANGES_v159.md`
- **Changed:**
  - `server.js` (runs the job check every 10 minutes)
  - `src/routes/marketplace.routes.js` (the team is told at once when a job finds no pro)
  - `src/routes/admin.routes.js` (Customers Waiting With No Pro)
  - `public/app/trothen.js` (the message, the no-pro screen, Invite a pro, the join link, no made-up pros)
  - `public/app/es-v152.js` (Spanish)
  - `public/index.html` (the message's place and look, the buttons, fingerprints)

No database changes, no new packages, nothing to set on Render.
