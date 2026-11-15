@echo off
REM Trothen v131 deploy (includes v130 and v129). Run in Command Prompt (cmd.exe) from your trothen-backend folder,
REM with trothen-v131-files.zip in your Downloads folder.
setlocal
set ZIP=%USERPROFILE%\Downloads\trothen-v131-files.zip
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
call :check "public\app\arrival.js" 23934
call :check "public\app\chats.js" 20771
call :check "public\app\polish.js" 48447
call :check "public\app\tokens.js" 62054
call :check "public\app\trothen.js" 1485327
call :check "public\app\where.js" 39268
call :check "public\index.html" 256858
call :check "server.js" 29258
call :check "src\account-privacy.js" 17690
call :check "src\arrival-time.js" 14465
call :check "src\auth.js" 9382
call :check "src\commission.js" 6291
call :check "src\currency-data.js" 6973
call :check "src\document-expiry-scheduler.js" 3642
call :check "src\document-upload-reminder-scheduler.js" 2431
call :check "src\fraud-detection.js" 12153
call :check "src\go-live.js" 18106
call :check "src\liberia-momo.js" 14015
call :check "src\loyalty.js" 2262
call :check "src\membership.js" 3164
call :check "src\platform-settings.js" 47126
call :check "src\provider-score-scheduler.js" 6504
call :check "src\provider-score.js" 17973
call :check "src\routes\admin.routes.js" 236095
call :check "src\routes\auth.routes.js" 82021
call :check "src\routes\business.routes.js" 43724
call :check "src\routes\marketplace.routes.js" 185928
call :check "src\routes\misc.routes.js" 69100
call :check "src\routes\payments.routes.js" 92252
call :check "src\routes\portfolio.routes.js" 12133
call :check "src\routes\rides.routes.js" 67489
call :check "src\routes\store.routes.js" 63148
call :check "src\validators.js" 17727
if %BAD% NEQ 0 (echo. & echo %BAD% file(s) did not match. Nothing was committed. Copy them out of the zip again and re-run. & goto :end)
echo All 33 files match.
echo === 4. Branch v131-icon-colors ===
git checkout -b v131-icon-colors || goto :end
git add "public\app\arrival.js"
git add "public\app\chats.js"
git add "public\app\polish.js"
git add "public\app\tokens.js"
git add "public\app\trothen.js"
git add "public\app\where.js"
git add "public\index.html"
git add "server.js"
git add "src\account-privacy.js"
git add "src\arrival-time.js"
git add "src\auth.js"
git add "src\commission.js"
git add "src\currency-data.js"
git add "src\document-expiry-scheduler.js"
git add "src\document-upload-reminder-scheduler.js"
git add "src\fraud-detection.js"
git add "src\go-live.js"
git add "src\liberia-momo.js"
git add "src\loyalty.js"
git add "src\membership.js"
git add "src\platform-settings.js"
git add "src\provider-score-scheduler.js"
git add "src\provider-score.js"
git add "src\routes\admin.routes.js"
git add "src\routes\auth.routes.js"
git add "src\routes\business.routes.js"
git add "src\routes\marketplace.routes.js"
git add "src\routes\misc.routes.js"
git add "src\routes\payments.routes.js"
git add "src\routes\portfolio.routes.js"
git add "src\routes\rides.routes.js"
git add "src\routes\store.routes.js"
git add "src\validators.js"
git add CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md DEPLOYMENT_STEPS_v131.md
git status
echo Check above: 36 files staged.
pause
git commit -m "v131: standard icon colours (includes v130 wording and v129 arrival times)" || goto :end
git push -u origin v131-icon-colors || goto :end
echo === 5. Local test ===
call npm install || goto :end
echo Open http://localhost:3001 . Press Ctrl+C when done, then answer N to "Terminate batch job".
set PORT=3001
node server.js
set PORT=
echo === 6. Go live ===
set /p GOLIVE=Type YES to merge into main and deploy to Render: 
if /i not "%GOLIVE%"=="YES" (echo Not deployed. The branch v131-icon-colors is pushed and safe. & goto :end)
git checkout main || goto :end
git merge v131-icon-colors || goto :end
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
