---
key: golive
title: Go-Live: getting ready for real customers
sections: golive, datacleanup
video: golive
updated: 2026-11-26
---
## What this part of Admin is for

**Go-Live** is the checklist and the three steps to move Trothen from **testing** to **real customers and real money**. Each check runs **live on the server**. Super admins only.

> **Rule:** Every **Required** item must be green before real people use Trothen. Items marked **Business step** are for Trothen's owners and lawyer, not for the technical team.

## The readiness checklist

Each item shows **Required**, **Recommended**, **Optional** or **Business step**, whether it is done, and what to do if not. A search box filters the list. The main items:

| Item | Why it matters |
|---|---|
| A real super admin account exists, and you are signed in with it | The demo super admin's password is public. |
| No demo accounts or demo records remain | Demo accounts appear in search and some can sign in with a published password. |
| Sign-in secret is set; running in production mode | Security of every sign-in. |
| Calls work on every network (a relay server is set) | Without it, calls fail on some mobile networks and Wi-Fi. |
| Data, ID documents and photos are stored on a permanent disk | Otherwise they are erased on the next update. |
| Email sending works | Sign-up and sign-in codes, and admin two-factor, depend on it. |
| Only the countries you serve are marked live | Otherwise the homepage says Trothen works everywhere. |
| Text messages, Google Sign-In, push notifications | Optional improvements. |
| A working support email on Trothen's domain | So people can reach the team. |
| The Privacy Policy has been reviewed by an attorney | **Business step.** |
| A data backup was taken in the last two days | And a copy kept somewhere else. |
| Extra encryption for ID files is switched on | Protects ID photos if the disk is ever copied. Keep the key safe. |
| Automated ID and face checks (Persona) | Optional. Without it, a person checks each ID. |
| Monthly plan fee | Stays off until real payments are live. |
| Real payments are connected | **Business step.** Then tick "Real payments only" in Admin → Tokens → Settings. |

## Email: send a test

Type your email and press `Send a test email`. If it fails, the page shows the exact reason.

## Step 1: Create your super admin account

Your **full name**, **email** and a **temporary password** (8 characters or more). The first time you sign in, you set your own password, and **two-factor sign-in is on from the start**. Then sign out of the demo account and sign in with yours.

## Step 2: Remove all demo data

`Preview what will be removed` first, then `Remove all demo data`. It removes all demo accounts and their data; other accounts are not affected. It needs the super admin account from Step 1.

## Step 3: Choose the countries you serve

Type the live countries, **one per line**, and press `Set these countries live`. Only these appear on the homepage and in the sign-up list; all others become **planned**. Existing accounts are not affected.

## History

Every Go-Live action, who did it and when. Kept permanently.

## Data Cleanup

To remove **unused test accounts** later (accounts that never did anything), use **Data Cleanup**: see its manual.

## Mistakes to avoid

- Going live with the demo super admin still active.
- Removing demo data before creating your own super admin.
- Marking every country live.
- Taking real money before "Real payments only" is ticked.
