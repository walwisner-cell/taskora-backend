---
key: callhealth
title: Call health
sections: callhealth
video: callhealth
updated: 2026-11-26
---
## What this part of Admin is for

Customers and pros can **call each other** in Trothen (voice and video) during a booking, without sharing phone numbers. **Call health** shows **why calls worked or didn't**, and what to fix. Super admins only.

> **Note:** Calls are **never recorded**. Only the times and outcomes are kept.

## Set-up

Whether the two things calls need are in place:

- **A relay (TURN) server.** Without one, calls fail on many mobile networks (MTN, Orange, Lonestar) and on some Wi-Fi, while working on others. On Render, add `TURN_API_URL` (Metered's free Open Relay is enough to start).
- **Phone push (VAPID keys).** Without it, a call only rings while Trothen is open on the other phone. With it, a closed Trothen still gets a notification.

## What to fix

The most important fixes, in order, with exactly what to set.

## The last 7 days

How calls ended:

| Outcome | What it usually means |
|---|---|
| Talked | It worked. |
| Didn't ring (Trothen not open) | The other person wasn't in Trothen: phone push would fix most of these. |
| Answered, sound never connected | The network blocked the call: a relay server fixes this. |
| Cut off | The connection dropped during the call. |
| Rang, no answer / Declined / Caller hung up first | People, not the system. |

## The last 50 calls

Each call's time, type (voice or video) and outcome, to look into a complaint like "my calls never connect".

## Good practice

- Check it weekly, and after any complaint about calls.
- Many "Answered, sound never connected" means the relay server is missing or full.
