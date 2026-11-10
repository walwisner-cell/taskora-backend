@echo off
REM Trothen v160 deploy (includes v128 to v159). Run in Command Prompt (cmd.exe) from your trothen-backend folder,
REM with trothen-v160-files.zip in your Downloads folder.
setlocal
set ZIP=%USERPROFILE%\Downloads\trothen-v160-files.zip
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
call :check "package-lock.json" 67674
call :check "package.json" 958
call :check "public\app\a11y.js" 5700
call :check "public\app\acceptquote.js" 18387
call :check "public\app\arrival.js" 24722
call :check "public\app\callhealth.js" 5579
call :check "public\app\calls.js" 36358
call :check "public\app\categories.js" 8323
call :check "public\app\chats.js" 22031
call :check "public\app\checks.js" 19575
call :check "public\app\commission.js" 31522
call :check "public\app\es-v152.js" 31761
call :check "public\app\instant.js" 10353
call :check "public\app\listing.js" 2662
call :check "public\app\live.js" 12129
call :check "public\app\maps.js" 20729
call :check "public\app\market.js" 71201
call :check "public\app\mobile.js" 11714
call :check "public\app\paymethods.js" 9394
call :check "public\app\payout-details.js" 19764
call :check "public\app\payways.js" 31010
call :check "public\app\permissions.js" 20454
call :check "public\app\polish.js" 49124
call :check "public\app\postjob.js" 25576
call :check "public\app\price-units.js" 26023
call :check "public\app\pricing.js" 35730
call :check "public\app\review.js" 19893
call :check "public\app\rides.js" 131082
call :check "public\app\sounds.js" 4867
call :check "public\app\store-plus.js" 48404
call :check "public\app\teams.js" 6193
call :check "public\app\tokens.js" 61193
call :check "public\app\trothen.js" 1529292
call :check "public\app\voice.js" 28883
call :check "public\app\where.js" 40061
call :check "public\index.html" 279871
call :check "public\manifest.json" 780
call :check "public\sw.js" 3368
call :check "server.js" 36344
call :check "src\account-export-zip.js" 20814
call :check "src\account-privacy.js" 20699
call :check "src\admin-permissions.js" 19614
call :check "src\arrival-time.js" 18305
call :check "src\auth.js" 9382
call :check "src\booking-contact.js" 1623
call :check "src\booking-rules.js" 7651
call :check "src\booking-scheduler.js" 5932
call :check "src\category-groups.js" 2113
call :check "src\commission-statement.js" 24561
call :check "src\commission.js" 6291
call :check "src\contact-scrub.js" 757
call :check "src\contract-locks.js" 2424
call :check "src\currency-data.js" 6973
call :check "src\customer-payments.js" 38666
call :check "src\delivery.js" 12293
call :check "src\document-expiry-scheduler.js" 3642
call :check "src\document-upload-reminder-scheduler.js" 2431
call :check "src\email-notify.js" 4286
call :check "src\fraud-detection.js" 12116
call :check "src\go-live.js" 19290
call :check "src\job-backfill.js" 8228
call :check "src\job-details.js" 6610
call :check "src\liberia-momo.js" 14015
call :check "src\listing.js" 1500
call :check "src\live.js" 8232
call :check "src\location-retention-scheduler.js" 5125
call :check "src\loyalty.js" 2262
call :check "src\market.js" 15052
call :check "src\membership.js" 3164
call :check "src\mobile-money.js" 5472
call :check "src\notify.js" 2797
call :check "src\payout-methods.js" 10675
call :check "src\payout-sending.js" 6943
call :check "src\payout-settlement-scheduler.js" 2489
call :check "src\places.js" 9654
call :check "src\platform-settings.js" 47416
call :check "src\pricing.js" 7877
call :check "src\provider-score-scheduler.js" 6587
call :check "src\provider-score.js" 17973
call :check "src\readiness.js" 11600
call :check "src\request-queue.js" 4741
call :check "src\ride-fares.js" 8889
call :check "src\ride-pass.js" 6802
call :check "src\road-route.js" 4415
call :check "src\routes\admin.routes.js" 254669
call :check "src\routes\auth.routes.js" 95923
call :check "src\routes\business.routes.js" 43724
call :check "src\routes\calls.routes.js" 37291
call :check "src\routes\custpay.routes.js" 9743
call :check "src\routes\market.routes.js" 52479
call :check "src\routes\marketplace.routes.js" 205823
call :check "src\routes\misc.routes.js" 71542
call :check "src\routes\orders.routes.js" 70731
call :check "src\routes\payments.routes.js" 118782
call :check "src\routes\portfolio.routes.js" 12133
call :check "src\routes\rides.routes.js" 88608
call :check "src\routes\store.routes.js" 82747
call :check "src\routes\tokens.routes.js" 25314
call :check "src\search-synonyms.js" 6181
call :check "src\seed.js" 32030
call :check "src\single-flight.js" 1162
call :check "src\stolen-goods.js" 7332
call :check "src\store-extras.js" 8038
call :check "src\store-order-sweep.js" 3755
call :check "src\store-orders.js" 15080
call :check "src\store.js" 28680
call :check "src\sync-reference-data.js" 8194
call :check "src\system-check.js" 23031
call :check "src\tokens.js" 57959
call :check "src\top-ups.js" 9429
call :check "src\validators.js" 18187
call :check "src\zip-stream.js" 3787
if %BAD% NEQ 0 (echo. & echo %BAD% file(s) did not match. Nothing was committed. Copy them out of the zip again and re-run. & goto :end)
echo All 112 files match.
echo === 4. Branch v160-deep ===
git checkout -b v160-deep || goto :end
git add "package-lock.json"
git add "package.json"
git add "public\app\a11y.js"
git add "public\app\acceptquote.js"
git add "public\app\arrival.js"
git add "public\app\callhealth.js"
git add "public\app\calls.js"
git add "public\app\categories.js"
git add "public\app\chats.js"
git add "public\app\checks.js"
git add "public\app\commission.js"
git add "public\app\es-v152.js"
git add "public\app\instant.js"
git add "public\app\listing.js"
git add "public\app\live.js"
git add "public\app\maps.js"
git add "public\app\market.js"
git add "public\app\mobile.js"
git add "public\app\paymethods.js"
git add "public\app\payout-details.js"
git add "public\app\payways.js"
git add "public\app\permissions.js"
git add "public\app\polish.js"
git add "public\app\postjob.js"
git add "public\app\price-units.js"
git add "public\app\pricing.js"
git add "public\app\review.js"
git add "public\app\rides.js"
git add "public\app\sounds.js"
git add "public\app\store-plus.js"
git add "public\app\teams.js"
git add "public\app\tokens.js"
git add "public\app\trothen.js"
git add "public\app\voice.js"
git add "public\app\where.js"
git add "public\index.html"
git add "public\manifest.json"
git add "public\sw.js"
git add "server.js"
git add "src\account-export-zip.js"
git add "src\account-privacy.js"
git add "src\admin-permissions.js"
git add "src\arrival-time.js"
git add "src\auth.js"
git add "src\booking-contact.js"
git add "src\booking-rules.js"
git add "src\booking-scheduler.js"
git add "src\category-groups.js"
git add "src\commission-statement.js"
git add "src\commission.js"
git add "src\contact-scrub.js"
git add "src\contract-locks.js"
git add "src\currency-data.js"
git add "src\customer-payments.js"
git add "src\delivery.js"
git add "src\document-expiry-scheduler.js"
git add "src\document-upload-reminder-scheduler.js"
git add "src\email-notify.js"
git add "src\fraud-detection.js"
git add "src\go-live.js"
git add "src\job-backfill.js"
git add "src\job-details.js"
git add "src\liberia-momo.js"
git add "src\listing.js"
git add "src\live.js"
git add "src\location-retention-scheduler.js"
git add "src\loyalty.js"
git add "src\market.js"
git add "src\membership.js"
git add "src\mobile-money.js"
git add "src\notify.js"
git add "src\payout-methods.js"
git add "src\payout-sending.js"
git add "src\payout-settlement-scheduler.js"
git add "src\places.js"
git add "src\platform-settings.js"
git add "src\pricing.js"
git add "src\provider-score-scheduler.js"
git add "src\provider-score.js"
git add "src\readiness.js"
git add "src\request-queue.js"
git add "src\ride-fares.js"
git add "src\ride-pass.js"
git add "src\road-route.js"
git add "src\routes\admin.routes.js"
git add "src\routes\auth.routes.js"
git add "src\routes\business.routes.js"
git add "src\routes\calls.routes.js"
git add "src\routes\custpay.routes.js"
git add "src\routes\market.routes.js"
git add "src\routes\marketplace.routes.js"
git add "src\routes\misc.routes.js"
git add "src\routes\orders.routes.js"
git add "src\routes\payments.routes.js"
git add "src\routes\portfolio.routes.js"
git add "src\routes\rides.routes.js"
git add "src\routes\store.routes.js"
git add "src\routes\tokens.routes.js"
git add "src\search-synonyms.js"
git add "src\seed.js"
git add "src\single-flight.js"
git add "src\stolen-goods.js"
git add "src\store-extras.js"
git add "src\store-order-sweep.js"
git add "src\store-orders.js"
git add "src\store.js"
git add "src\sync-reference-data.js"
git add "src\system-check.js"
git add "src\tokens.js"
git add "src\top-ups.js"
git add "src\validators.js"
git add "src\zip-stream.js"
git add CHANGES_v128.md CHANGES_v129.md CHANGES_v130.md CHANGES_v131.md CHANGES_v132.md CHANGES_v133.md CHANGES_v134.md CHANGES_v135.md CHANGES_v136.md CHANGES_v137.md CHANGES_v138.md CHANGES_v139.md CHANGES_v140.md CHANGES_v141.md CHANGES_v142.md CHANGES_v143.md CHANGES_v144.md CHANGES_v145.md CHANGES_v146.md CHANGES_v147.md CHANGES_v148.md CHANGES_v149.md CHANGES_v150.md CHANGES_v151.md CHANGES_v152.md CHANGES_v153.md CHANGES_v154.md CHANGES_v155.md CHANGES_v156.md CHANGES_v157.md CHANGES_v158.md CHANGES_v159.md CHANGES_v160.md DEPLOYMENT_STEPS_v160.md
git status
echo Check above: 143 files staged if v128 is already live, or 145 if it is not.
pause
git commit -m "v160: a deeper recheck: checks that never overlap, a clearer booking confirmation, Leave Now on the day, phone screens lined up (includes v128 to v159)" || goto :end
git push -u origin v160-deep || goto :end
echo === 5. Local test ===
call npm install || goto :end
echo Open http://localhost:3001 . Press Ctrl+C when done, then answer N to "Terminate batch job".
set PORT=3001
node server.js
set PORT=
echo === 6. Go live ===
set /p GOLIVE=Type YES to merge into main and deploy to Render: 
if /i not "%GOLIVE%"=="YES" (echo Not deployed. The branch v160-deep is pushed and safe. & goto :end)
git checkout main || goto :end
git merge v160-deep || goto :end
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
