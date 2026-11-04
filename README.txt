Trothen v135: everything in one place (includes v128 to v134)

  src\ public\ server.js    The 49 files changed since your GitHub main (before v128), in their real folders.
  CHANGES_v135.md           Custom admin permissions: choose what each admin can see and do.
  CHANGES_v134.md           Commission before accepting, escrow commission first, Land Scaping, categories by country, icons.
  CHANGES_v133.md           Pros customers can find, Super-Pro panel rates.
  CHANGES_v132.md           How commission is paid (statement, admin list).
  CHANGES_v131.md           Icon colours.
  CHANGES_v130.md           The professional wording pass.
  CHANGES_v129.md           Arrival times, Leave Now, trip screen, phone/tablet/laptop layouts.
  CHANGES_v128.md           Past chats in Messages, job locations, customer live location.
  DEPLOYMENT_STEPS_v135.md  Byte counts and the cmd.exe steps.
  deploy_v135.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v135-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The new screens.

Works whether or not v128 is already live. git status shows 55 files if v128 is live, 58 if not.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v135.
  2. copy "%USERPROFILE%\Downloads\trothen-v135\trothen-v135-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v135\deploy_v135.bat"
  Nothing goes live until you type YES.

After it is live: Admin, Categories and Countries, Sync Latest Categories and Countries (adds the 60 standard categories, Landscaping included).
