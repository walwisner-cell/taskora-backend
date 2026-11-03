Trothen v128: everything in one place

What is in this zip
  src\ public\ server.js   The 11 code files for v128 (2 new), in their
                           real folders. Copy these over your trothen-backend
                           folder.
  CHANGES_v128.md          What changed, why, and what I tested.
  DEPLOYMENT_STEPS_v128.md Byte counts for every file and the cmd.exe steps.
  deploy_v128.bat          Does the whole deploy for you (see below).
  trothen-v128-files.zip   The same code files packed, which the .bat uses.
  screenshots\             The new Messages page, the no-pin warning,
                           customer location sharing, and the pro's trip map.

Quickest way to deploy (Command Prompt, not PowerShell)
  1. Unzip this in your Downloads folder. You get a folder trothen-v128.
  2. Copy trothen-v128-files.zip (inside that folder) into Downloads too:
       copy "%USERPROFILE%\Downloads\trothen-v128\trothen-v128-files.zip" "%USERPROFILE%\Downloads\"
  3. Then:
       cd path\to\trothen-backend
       "%USERPROFILE%\Downloads\trothen-v128\deploy_v128.bat"
     It checks every file's byte count, commits on its own branch, lets
     you test on http://localhost:3001, then asks before going live.
  Or do it by hand with DEPLOYMENT_STEPS_v128.md.
  Nothing goes live until you type YES at the end.
