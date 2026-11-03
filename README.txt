Trothen v130: everything in one place (includes v129)

  src\ public\ server.js    The 33 files changed since v128, in their real folders.
  CHANGES_v130.md           The professional wording pass: what changed and why.
  CHANGES_v129.md           Arrival times, Leave Now, trip screen, phone/tablet/laptop layouts.
  DEPLOYMENT_STEPS_v130.md  Byte counts and the cmd.exe steps.
  deploy_v130.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v130-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              Before and after, and the main screens in v130.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v130.
  2. copy "%USERPROFILE%\Downloads\trothen-v130\trothen-v130-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v130\deploy_v130.bat"
  Nothing goes live until you type YES.
