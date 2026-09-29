# Trothen v56.1: fixing the failed v56 deploy

## What went wrong
My v56 deploy on Render failed with "Cannot find module './src/go-live'".

The v56 code itself was fine. When I copied the v56 files into my repo, ten of them landed in the wrong folder. Seven went to the top level of the repo instead of into `src` or `src/routes`, the new homepage went to the top level instead of `public`, and one file (`src/routes/misc.routes.js`) never got copied at all.

The new `server.js` did land in the right place. It looks for `src/go-live.js`, which didn't exist, so the server stopped before it could start. Render kept my previous version running, so nobody saw a broken site.

Even if that one file had been in place, the rest of v56 would not have been live. The older v55 files were still sitting in `src`, so the Go-Live screen, the demo-data removal and the other v56 changes would have been missing or half-working.

## What I'm fixing
I'm putting the ten v56 files in the folders the server actually reads from, and removing the seven misplaced copies at the top level so they can't confuse me later. No code changed from v56.

## Tested
- I rebuilt the repo exactly as it was uploaded and ran it: it failed with the same error Render showed.
- I applied this fix to that same copy and ran it: the server started, the homepage loaded, and the health check answered.
- After the fix, every file in my repo matches the v56 package byte for byte.

## Byte counts (after copying, these must match exactly)
| File | Bytes |
|---|---|
| src\go-live.js | 13,896 |
| src\routes\admin.routes.js | 176,161 |
| src\routes\auth.routes.js | 70,956 |
| src\routes\misc.routes.js | 51,676 |
| src\db-postgres.js | 16,456 |
| src\seed.js | 31,948 |
| src\sync-reference-data.js | 8,089 |
| src\validators.js | 17,433 |
| src\schema.sql | 43,531 |
| public\index.html | 970,005 |
