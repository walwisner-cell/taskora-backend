Trothen v154: everything in one place (includes v128 to v153)

  src\ public\ server.js    The 107 files changed since your GitHub main (before v128), in their real folders.
  CHANGES_v154.md           The phone view: a tab bar at the bottom like other phone apps, every button big
                            enough to tap, the right keyboard for numbers and emails, fewer pop-ups.
  CHANGES_v153.md           Fourth recheck: a double-tap or two staff at once can't do anything twice (tested on
                            Postgres), timed jobs never clash with a person, All pros search by skill fixed,
                            the pro's dashboard in Spanish.
  CHANGES_v152.md           Professional wording across the app: short help lines, the same names everywhere,
                            a compact "Complete your profile" card, figures that agree between pages, no "I".
  CHANGES_v151.md           A third recheck: a pro's exact location no longer public; usable with a screen reader
                            or keyboard (WCAG 2.1 AA); other websites can't read the API; codes allow 5 wrong tries;
                            phone codes limited; sign-in limits that suit shared mobile connections.
  CHANGES_v150.md           A deeper recheck (every route with bad input, every screen on 3 sizes); the app starts
                            about 3x faster on a slow connection; a clearer "Finish setting up your account";
                            the Mobile Money network picked from the number.
  CHANGES_v149.md           A full recheck: every screen opened on a phone and a computer; 2 gaps fixed;
                            a new System Check that money and bookings agree.
  CHANGES_v148.md           Market goods paid before the seller is told; cash rides with commission from tokens;
                            maps, GPS and navigation like other apps; Admin, System Check with alerts;
                            "Get ready" checks for every user; account country shown; more skills;
                            paying with someone else's Mobile Money.
  CHANGES_v147.md           Sign-in emails by SMTP; Mobile Money ready for MTN (PIN-confirmed); payouts only when sent;
                            calls only once booked; Liberia ride places; team managers; "I've finished the job";
                            the store fixes; and a full booking and ride walkthrough.
  CHANGES_v146.md           Calls no longer stuck after a dropped call; Admin, Call health; a Rides switch per country.
  CHANGES_v145.md           Drivers can accept rides whatever their main trade; licences follow the work.
  CHANGES_v144.md           Post a Job redesigned: 5 steps, a real price in L$ or US$ (or pros send prices), when, materials.
  CHANGES_v143.md           The store complete (returns, sizes, sales, codes, reviews, saved) and keeping stolen goods out.
  CHANGES_v142.md           Trothen proposes ride fares by distance and time (L$, linked to fuel); drivers listed like pros.
  CHANGES_v141.md           Paying per job (not only per hour), drivers and motorbikes, Mobile Money payouts instead of PayPal.
  CHANGES_v140.md           Safety and anti-fraud, materials for a job, trade prices, calls that don't hang, ringtones.
  CHANGES_v139.md           The Market (stores and people), pros as store owners, and a fix for pro sign-up.
  CHANGES_v138.md           One "Download a copy of my data" file with everything (and messages now included).
  CHANGES_v137.md           Voice messages; calls that reconnect, call hours, blocking, call history for disputes.
  CHANGES_v136.md           Voice and video calls, instant bookings and offers, admin permissions by action.
  CHANGES_v135.md           Custom admin permissions: choose what each admin can see and do.
  CHANGES_v134.md           Commission before accepting, escrow commission first, Land Scaping, categories by country, icons.
  CHANGES_v133.md           Pros customers can find, Super-Pro panel rates.
  CHANGES_v132.md           How commission is paid (statement, admin list).
  CHANGES_v131.md           Icon colours.
  CHANGES_v130.md           The professional wording pass.
  CHANGES_v129.md           Arrival times, Leave Now, trip screen, phone/tablet/laptop layouts.
  CHANGES_v128.md           Past chats in Messages, job locations, customer live location.
  DEPLOYMENT_STEPS_v154.md  Byte counts and the cmd.exe steps.
  deploy_v154.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v154-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The phone view, before and after.

Works whether or not v128 is already live. git status shows 132 files if v128 is live, 134 if not.

BEFORE you deploy (only if v147 is not live yet, for sign-in emails):
  Render, Environment: add SMTP_HOST = mail.privateemail.com, SMTP_PORT = 465,
  SMTP_USER = noreply@trothenpro.com, SMTP_PASS = that mailbox's password.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v154.
  2. copy "%USERPROFILE%\Downloads\trothen-v154\trothen-v154-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v154\deploy_v154.bat"
  Nothing goes live until you type YES.

After it is live:
  - Admin, System Check: fix anything red. Alerts come to your notifications from then on.
  - Add MAPBOX_TOKEN on Render before many people use the maps (free tier, business use allowed).
  - "Real payments only" now refuses to switch on until customers have a way to pay and email works.
  - Everything from v147 still applies: pin the 57 starter places, the MTN keys when MTN gives them,
    TURN_API_URL and the VAPID keys for calls, and the L$ exchange rate kept current.
