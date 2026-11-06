Trothen v144: everything in one place (includes v128 to v143)

  src\ public\ server.js    The 79 files changed since your GitHub main (before v128), in their real folders.
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
  DEPLOYMENT_STEPS_v144.md  Byte counts and the cmd.exe steps.
  deploy_v144.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v144-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The new screens.

Works whether or not v128 is already live. git status shows 95 files if v128 is live, 97 if not.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v144.
  2. copy "%USERPROFILE%\Downloads\trothen-v144\trothen-v144-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v144\deploy_v144.bat"
  Nothing goes live until you type YES.

After it is live:
  - Try + Post a New Job as a customer. Keep the L$ exchange rate in Admin current: an L$ price is kept in US$ at that rate.
  - Tell sellers about returns, sizes, sales and discount codes; phones and laptops in the Market now need their IMEI or serial.
  - Admin, Categories and Countries, Sync Latest Categories and Countries (adds Driver for Hire).
  - Admin, Rides, Fares, Liberia: set the L$ fares with a few drivers, and today's pump price.
  - Tell your pros about Settings, How you charge. Most choose Per job, with a few fixed prices.
    Drivers choose Per trip or Per day, and apply under Rides to carry passengers.
  - Pros and sellers add their Mobile Money number or bank account before cashing out.
    Check ID_FILE_ENCRYPTION_KEY is set on Render (Admin, Go-Live shows it).
  - Add TURN_API_URL on Render (Metered Open Relay, free 20 GB a month) so calls connect on every network. See CHANGES_v140.md, section 4.
  - Admin, Categories and Countries, Sync Latest Categories and Countries.
