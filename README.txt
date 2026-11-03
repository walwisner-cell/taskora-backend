Trothen v131: everything in one place (icon colours; includes v130 and v129)

  src\ public\ server.js    The 33 files changed since v128, in their real folders.
  CHANGES_v131.md           Icon colours: what changed.
  CHANGES_v130.md           The professional wording pass.
  CHANGES_v129.md           Arrival times, Leave Now, trip screen, phone/tablet/laptop layouts.
  DEPLOYMENT_STEPS_v131.md  Byte counts and the cmd.exe steps.
  deploy_v131.bat           Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v131-files.zip    The code files packed; the .bat reads this from Downloads.
  screenshots\              The main screens in v131.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v131.
  2. copy "%USERPROFILE%\Downloads\trothen-v131\trothen-v131-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v131\deploy_v131.bat"
  Nothing goes live until you type YES.
