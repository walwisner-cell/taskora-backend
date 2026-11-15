# Trothen v136: calls, instant updates, and permission by action

This one package includes everything since the version on your GitHub `main` before v128: v128 to v135, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
1. Can we have a call feature?
2. Bookings and offers between the pro and the customer aren't working properly and aren't instant.
3. Work properly on the admin permissions and allow granular permissions.

## 1. Voice and video calls
A customer and a pro can now call each other inside Trothen. No phone numbers are shared.

- **Where the buttons are:**
  - at the top of every conversation in Messages;
  - next to every Message button;
  - on each live booking:
    - the customer's My Bookings;
    - the pro's My Contracts.
- **Who can call whom:** only a customer and a pro who already have something together:
  - a booking;
  - a job response;
  - a conversation.
  
  Nobody else can call.
- **Receiving a call:** the other person gets a full-screen "Incoming call" with Answer and Decline, and a ring sound. If they have Trothen open on two devices, answering on one stops the other ringing.
- **During a call:**
  - mute;
  - camera on or off (video calls);
  - hang up;
  - a running timer.
- **Unanswered calls:** after 45 seconds the call counts as missed. The person gets a "Missed call from …" notification.
- **Busy:** if someone is already on a call, the caller is told to try again in a few minutes.
- **Chat history:** each call is written into the conversation, for example "Voice call · 3:12", "Missed video call" or "Voice call declined".
- **If Trothen isn't open:** the person gets a notification: "Jordan is calling you. Open Trothen to answer."

**How it works:** the sound and picture go straight between the two phones or computers. They don't pass through Trothen's server and aren't recorded. The server only rings the other person and passes the connection details between the two sides.

## 2. Bookings and offers arrive instantly
I measured every step on two screens side by side. Each one now shows on the other person's screen in about half a second:

| What happens | Shows on the other screen in |
|---|---|
| Customer posts a job, pro sees it in Job Matches | 0.5 s |
| Pro sends a price, customer's Responses window | 0.6 s |
| Pro changes the price, customer's job card updates | 0.1 s after it arrives |
| Customer offers a price, pro's My Contracts | 0.6 s |
| Pro suggests a different price, customer's My Bookings | 0.6 s |
| Customer accepts, pro's screen | instant |
| Customer books the pro directly, pro's My Contracts | 0.5 s |

**What was wrong:**
- **Prices were easy to miss.** A new price was only visible inside the "View Responses" window. Otherwise there was just a small dot on the bell.
- **Stalled connections went unnoticed.** Some networks and phones quietly freeze a live connection without closing it. The page never noticed, so updates stopped until a refresh.

**What I changed:**
- **A pop-up for everything new.** Something arriving for you shows as a pop-up in the corner, with an Open button. This covers:
  - a pro's price;
  - a new booking request;
  - an offer;
  - an accepted price;
  - a message.
- **The job card says what came in.** It now shows "1 pro responded · best price $80.00", with a "New" badge for 15 minutes. Before anyone answers, it shows "Waiting for pros to respond".
- **The connection checks itself.** The server now sends a small "still here" signal every 20 seconds. If the page hears nothing for 50 seconds, it reconnects by itself. The backup check also runs every 10 seconds instead of 20.

**Important:** the live site has none of this, or anything after v128, until you deploy this package. Some of the slowness you saw on the live site may simply be the older version.

## 3. Admin permissions, action by action
In v135 each section was Off, View or Manage. Now each section is also split into the separate things that can be done in it, each with its own tick box.

- **Four choices per section:** Off, View, Manage, or **Custom**. Choosing Custom (or pressing "Details") opens the tick boxes.
- **Some examples:**
  - **Customers & Providers:**
    - see the list of people;
    - see phone numbers and email addresses;
    - pause, suspend or reactivate accounts;
    - put payouts on hold;
    - propose a pro's commission rate.
  - **Verification Queue:**
    - see the queue;
    - open ID documents and selfies;
    - approve or reject ID documents;
    - approve or reject guarantors;
    - ask people for missing documents.
  - **Disputes:**
    - see disputes;
    - download disputes as PDF;
    - resolve disputes.
  - **Tokens:**
    - see balances;
    - confirm or reject token payments;
    - record a cash top-up.
- **Every section is split this way:** stores, rides, payments, customer payments, pricing, advertising, promotions, job applications, contact messages, reports, sales and organizations.
- **Labels:** actions that change something carry a small "changes" label, so it's clear which ones go beyond looking.
- **"See the section" is always included** when any action in that section is ticked. Nobody can act on records they can't see.
- **The team list** names exactly what each person can do, for example "Some actions: Disputes (Resolve disputes)".
- **Clear messages:** if someone tries an action they don't have, they're told exactly which one. For example: *You can open Disputes, but "Download disputes as PDF" is not in your permissions. Ask a super admin to add it.*
- **Notifications follow the actions.** Someone who can open ID documents but not approve them isn't told about new documents to approve. Someone who can see tokens but not confirm payments isn't sent token payment codes.

**Unchanged:**
- Only you (the super admin) can create admins or change their permissions.
- Super-admin-only actions are never part of anyone's permissions.
- Every check happens on the server. A disguised address can't get past it.

## What I tested
- **Calls (22 checks):**
  - voice call: both hear each other;
  - video call: both see each other;
  - mute, camera off, hang up;
  - decline, missed call and busy;
  - the call written into both chat histories;
  - a call to someone who isn't online;
  - the call buttons on bookings, once per row;
  - the incoming-call screen on a phone.
- **Instant updates:** the seven steps in the table above, with the pop-up and the job card.
- **Permissions (95 checks):**
  - every action allowed or refused exactly as ticked;
  - presets saved as presets;
  - unknown actions dropped;
  - the screens: tick boxes, Custom, "see" locked on, saving and re-opening.
- **The full sweep, all still passing:**
  - all 176 admin addresses refused or allowed correctly;
  - the 14 disguised-address checks;
  - the check that every admin address belongs to a section.
- **Earlier tests:**
  - commission (25 + 8);
  - categories (22);
  - accepting jobs (27);
  - listed pros (16).

## Good to know
- **Calls on some networks.** Most calls connect with the free public connection service. Some networks, such as strict office Wi-Fi and some mobile carriers, need a relay service (called TURN) to connect.
  - **Without one:** a small share of calls won't connect, and the person is told so.
  - **To add one:** sign up with a TURN provider (Twilio, Cloudflare Calls, Metered and others; usually a small monthly cost), then add these to Render → Environment:
    - `TURN_URLS`
    - `TURN_USERNAME`
    - `TURN_CREDENTIAL`
- **Calls only ring while Trothen is open** (any tab, any device). Otherwise the person gets a notification, and a phone notification only if push notifications are set up (the VAPID keys).
- **The ring sound** may stay silent on a page nobody has tapped yet, because browsers block sound until then. The full-screen incoming call still shows.
- **Ring time** is 45 seconds. You can change it with `CALL_RING_SECONDS` on Render. This is optional.
- **Buttons in sections someone can only partly use.** The buttons are still on the page. Pressing one they don't have shows the message naming the missing action, and nothing changes.

## Files
- **New:**
  - `src/routes/calls.routes.js`: ringing, answering, ending, missed calls.
  - `public/app/calls.js`: the call buttons and call screen.
  - `public/app/instant.js`: pop-ups and the job card line.
- **Changed:**
  - `server.js`
  - `src/live.js`
  - `src/admin-permissions.js`
  - `src/routes/marketplace.routes.js`
  - `src/routes/tokens.routes.js`
  - `src/routes/custpay.routes.js`
  - `src/routes/misc.routes.js`
  - `src/tokens.js`
  - `src/customer-payments.js`
  - `src/provider-score-scheduler.js`
  - `public/app/live.js`
  - `public/app/chats.js`
  - `public/app/permissions.js`
  - `public/app/trothen.js`
  - `public/index.html`

**What's needed:**
- no new packages;
- no database changes (calls are stored like everything else);
- optional environment variables: `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `CALL_RING_SECONDS`.
