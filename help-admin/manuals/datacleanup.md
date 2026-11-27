---
key: datacleanup
title: Data Cleanup: removing unused test accounts
sections: datacleanup
video: golive
updated: 2026-11-26
---
## What this part of Admin is for

**Data Cleanup** removes **unused test accounts** in a country: accounts created to try Trothen that never did anything. Super admins only.

> **Rule:** Cleanup **permanently deletes** accounts. **Accounts with any contract, payment or dispute history are never removed**, whatever you choose. Even so, always **preview first**, and only clean up when you are sure.

## Step by step

1. **Country:** type one (for example Liberia), or leave it blank to check every country at once.
2. Press `Preview what would be removed`. The list shows exactly which accounts would go, and why each is allowed to go.
3. **Read the whole list.** If anything looks like a real person, stop.
4. Confirm the cleanup.

## Cleanup history

Every run is **permanently logged**: who ran it, when, the country, and what was removed. The log is kept even when the accounts are gone.

## Before you clean up

- Take a backup first (Settings → Data backups → `Take a copy now`, then `Download` it).
- Never clean up to "tidy" real customers who simply haven't booked yet: an account with no activity can still be a real person.

> **Note:** To remove **all the demo accounts** before launch, use **Go-Live → Step 2**, not this page.
