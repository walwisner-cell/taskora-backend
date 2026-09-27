# Moving Trothen to Europe — the real, complete guide

This is the real reason this needs to happen at all: Lonestar Cell MTN Mobile Money (LCMMMI), the Liberia mobile money partner, requires that data be stored in Africa or Europe. Trothen is currently hosted in Oregon, USA. This document is the actual, complete plan for fixing that — written out on its own so it's easy to follow start to finish, rather than buried in code comments.

## The one thing I need to correct from earlier

I originally told you this could be done by just editing a setting. That wasn't right, and I want to be upfront about it rather than let it stand uncorrected.

I checked directly against Render's own current documentation: **Render does not support changing an existing service's region, for anyone, under any circumstances.** If you edit the region on a service that's already running and push that change, Render doesn't quietly apply it — it rejects the entire deployment outright, including anything else you changed at the same time.

The real, only path Render actually supports: **create a genuine second, new service in Frankfurt, and point your domain at it once it's confirmed working.** Everything below is built around that real constraint, not the simpler version I described before.

## Before you start — the one thing only you know

Is there anything on the current Oregon service actually worth keeping — real signups, real activity from testing with Joseph, anything you'd be upset to lose? Or is it all just accumulated test and demo data from this build process, safe to leave behind?

This single answer decides which of the two paths below you're actually on. If you're not sure, it's worth checking before you start, not partway through.

## Which storage backend are you actually running?

The exact data-export step also depends on this, and it's a quick thing to check: open the current Oregon service in the Render dashboard, go to its **Environment** tab, and look for a variable called `DATABASE_URL`.

- **If `DATABASE_URL` is NOT there:** you're on the plain JSON-file disk store — the original, simpler setup.
- **If `DATABASE_URL` IS there:** you've since switched to real Postgres.

Tell me which one, and I'll write out the exact commands for that specific case — the two really don't share steps, so I'd rather give you the real one than a generic version that might not quite fit.

## Path A — Nothing needs to carry over

If the current Oregon service is just test and demo data, this is genuinely simple:

1. In the Render dashboard: **New +** → **Blueprint** (or **Web Service**). Point it at the same GitHub repository Trothen already deploys from.
2. When Render asks for a region during setup, choose **Frankfurt**.
3. Copy every real environment variable from the Oregon service's Environment tab into the new one by hand. This is the step most likely to get missed — nothing carries over automatically between two separate services. That includes `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `GOOGLE_CLIENT_ID`, `APP_URL`, `ALLOWED_ORIGINS`, `PRIVATE_UPLOADS_DIR`, any `TWILIO_*` values already set, and any `LCMMMI_*` values if you've started testing the Liberia mobile money integration.
4. Wait for the new service to build and boot cleanly. Open its own Render-provided address directly (not your real domain yet) and go through a real smoke test — sign up, log in, post a job, the basics.
5. Only once you're confident the new one is solid: repoint `trothenpro.com`'s DNS at the new service.
6. Once the new one has been live and stable for a bit, delete the old Oregon service.

## Path B — There's real data to keep

Steps 1 through 3 are identical to Path A above. The real difference is what happens before step 4 — the data has to actually move before the new service goes live for real.

**If you're on the JSON-file disk store** (no `DATABASE_URL` set):
The real data lives as files on the Oregon service's persistent disk, named `taskora-data` in `render.yaml`. Moving it means copying those actual files off that disk — through the Render dashboard's shell access — before the new Frankfurt service ever goes live, then placing them in the same location on the new service's own disk.

**If you're on real Postgres** (`DATABASE_URL` is set):
This is a real database export and import — a `pg_dump` of the existing database, and a `pg_restore` into a new Postgres instance you'd create in Frankfurt alongside the new web service.

Tell me which of these two you're actually on and I'll write out the exact, real commands for it — cmd.exe, not PowerShell, matching how you've wanted deployment steps done throughout this build.

## What doesn't need to change

The application code itself needs nothing different to run in Frankfurt versus Oregon — this is entirely a hosting and data question, not a code question. `render.yaml` already reflects this correction in its own comments, right next to the region line, so the reasoning is preserved there too if this file and the code package ever drift apart.
