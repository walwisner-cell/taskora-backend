Trothen v132: everything in one place (includes v128 to v131)

  src\ public\ server.js    The 39 files changed since your GitHub main (before v128), in their real folders.
  CHANGES_v132.md           How commission is paid, tokens first, and the points for you to decide.
  CHANGES_v131.md           Icon colours.
  CHANGES_v130.md           The professional wording pass.
  CHANGES_v129.md           Arrival times, Leave Now, trip screen, phone/tablet/laptop layouts.
  CHANGES_v128.md           Past chats in Messages, job locations, customer live location.
  DEPLOYMENT_STEPS_v132.md  Byte counts and the cmd.exe steps.
  deploy_v132.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v132-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The commission screens and the main app screens.

Works whether or not v128 is already live. git status shows 42 files if v128 is live, 45 if not.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v132.
  2. copy "%USERPROFILE%\Downloads\trothen-v132\trothen-v132-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v132\deploy_v132.bat"
  Nothing goes live until you type YES.
