@echo off
REM Trothen v128 deploy. Run in Command Prompt (cmd.exe) from your trothen-backend folder,
REM with trothen-v128-files.zip in your Downloads folder.
setlocal
set ZIP=%USERPROFILE%\Downloads\trothen-v128-files.zip
set BAD=0

if not exist server.js (echo server.js not found. cd into your trothen-backend folder first. & goto :end)
if not exist .git (echo This folder is not a git repo. cd into your trothen-backend folder first. & goto :end)
echo === 1. Up-to-date main ===
git checkout main || goto :end
git pull || goto :end
echo === 2. Unzipping ===
if not exist "%ZIP%" (echo Zip not found at %ZIP%. & goto :end)
tar -xf "%ZIP%" || goto :end
echo === 3. Checking byte counts ===
call :check "src\live.js" 7261
call :check "src\location-retention-scheduler.js" 5125
call :check "src\account-privacy.js" 17693
call :check "src\routes\misc.routes.js" 69154
call :check "src\routes\payments.routes.js" 89734
call :check "src\routes\marketplace.routes.js" 186028
call :check "server.js" 28973
call :check "public\app\trothen.js" 1491413
call :check "public\app\chats.js" 20792
call :check "public\app\where.js" 29809
call :check "public\index.html" 244665
if %BAD% NEQ 0 (echo. & echo %BAD% file(s) did not match. Nothing was committed. Copy them out of the zip again and re-run. & goto :end)
echo All 11 files match.
echo === 4. Branch v128-chats-location ===
git checkout -b v128-chats-location || goto :end
git add "src\live.js"
git add "src\location-retention-scheduler.js"
git add "src\account-privacy.js"
git add "src\routes\misc.routes.js"
git add "src\routes\payments.routes.js"
git add "src\routes\marketplace.routes.js"
git add "server.js"
git add "public\app\trothen.js"
git add "public\app\chats.js"
git add "public\app\where.js"
git add "public\index.html"
git add CHANGES_v128.md DEPLOYMENT_STEPS_v128.md
git status
echo Check above: 13 files staged.
pause
git commit -m "v128: every past conversation in Messages; job location required, customer can share live location, quieter trip tracking" || goto :end
git push -u origin v128-chats-location || goto :end
echo === 5. Local test ===
call npm install || goto :end
echo Open http://localhost:3001 . Press Ctrl+C when done, then answer N to "Terminate batch job".
set PORT=3001
node server.js
set PORT=
echo === 6. Go live ===
set /p GOLIVE=Type YES to merge into main and deploy to Render: 
if /i not "%GOLIVE%"=="YES" (echo Not deployed. The branch v128-chats-location is pushed and safe. & goto :end)
git checkout main || goto :end
git merge v128-chats-location || goto :end
git push || goto :end
echo DEPLOYED. Render is building now.
goto :end

:check
if not exist %1 (echo MISSING  %~1 & set /a BAD+=1 & goto :eof)
if "%~z1"=="%2" (echo OK       %~1  %2) else (echo MISMATCH %~1  is %~z1, should be %2 & set /a BAD+=1)
goto :eof

:end
endlocal
pause
