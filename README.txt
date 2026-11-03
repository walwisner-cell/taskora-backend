Trothen v129: everything in one place

  src\ public\ server.js   The 7 code files for v129 (2 new), in their real folders.
  CHANGES_v129.md          What changed, why, and what was tested.
  DEPLOYMENT_STEPS_v129.md Byte counts and the cmd.exe steps.
  deploy_v129.bat          Runs the whole deploy (checks byte counts, own branch, asks before going live).
  trothen-v129-files.zip   The code files packed; the .bat reads this from Downloads.
  screenshots\             Phone, tablet and laptop.

Quick deploy (Command Prompt, not PowerShell):
  1. Unzip this in Downloads. You get a folder trothen-v129.
  2. copy "%USERPROFILE%\Downloads\trothen-v129\trothen-v129-files.zip" "%USERPROFILE%\Downloads\"
  3. cd path\to\trothen-backend
     "%USERPROFILE%\Downloads\trothen-v129\deploy_v129.bat"
  Nothing goes live until you type YES.
