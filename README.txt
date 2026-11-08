Trothen v147: everything in one place (includes v128 to v146)

  src\ public\ server.js    The 97 files changed since your GitHub main (before v128), in their real folders.
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
  DEPLOYMENT_STEPS_v147.md  Byte counts and the cmd.exe steps.
  deploy_v147.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v147-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The new screens (phone size).

Works whether or not v128 is already live. git status shows 116 files if v128 is live, 118 if not.

BEFORE you deploy (sign-in emails):
  Render, Environment: add SMTP_HOST = mail.privateemail.com, SMTP_PORT = 465,
  SMTP_USER = noreply@trothenpro.com, SMTP_PASS = that mailbox's password.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v147.
  2. copy "%USERPROFILE%\Downloads\trothen-v147\trothen-v147-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v147\deploy_v147.bat"
  Nothing goes live until you type YES.

After it is live:
  - Admin, Go-Live, "Send a test email" to yourself.
  - Ask someone in Monrovia to pin the 57 starter places in Admin, Rides, Places (about 30 minutes).
  - Once "Real payments only" is on, finance sends each payout and presses "Mark as sent" with the transaction ID.
  - When MTN gives you the keys: add the LCMMMI_ settings (see CHANGES_v147.md), then LCMMMI_INTEGRATION_ENABLED = true.
    Test with about $1 each way first.
  - Everything from v146 still applies: TURN_API_URL and the VAPID keys for calls, the Rides switch per country,
    fares in Admin, Rides, Fares, and the L$ exchange rate kept current.
