Trothen v140: everything in one place (includes v128 to v139)

  src\ public\ server.js    The 63 files changed since your GitHub main (before v128), in their real folders.
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
  DEPLOYMENT_STEPS_v140.md  Byte counts and the cmd.exe steps.
  deploy_v140.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v140-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The new screens.

Works whether or not v128 is already live. git status shows 75 files if v128 is live, 77 if not.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v140.
  2. copy "%USERPROFILE%\Downloads\trothen-v140\trothen-v140-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v140\deploy_v140.bat"
  Nothing goes live until you type YES.

After it is live:
  - Add TURN_API_URL on Render (Metered Open Relay, free 20 GB a month) so calls connect on every network. See CHANGES_v140.md, section 4.
  - Admin, Categories and Countries, Sync Latest Categories and Countries (adds the 60 standard categories, Landscaping included).
  - Try a call and a voice message between two phones (one on mobile data). If calls can't connect, add a TURN service (see CHANGES_v136.md, "Good to know").
