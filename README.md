# Taskora Backend

A real, runnable API for the Taskora prototype: authentication, provider search,
job posting + AI matching, contracts & escrow, disputes, admin approvals, and
notifications — all persisted to disk so nothing resets when you refresh the
page.

It also serves the Taskora frontend directly, so running one command gives
you the whole app, frontend and backend together, talking to each other for
real.

## Deploying to Render (as a separate service from anything else on your account)

This project is set up to deploy cleanly alongside other projects already in
your Render account — it uses its own service name and its own environment
variables, so nothing about it touches or depends on anything else you have
running there.

**One important thing to know before you deploy:** Render's free web service
plan does not support persistent disks at all — that's a hard platform rule.
A free service's filesystem resets every time it redeploys *or* spins down
from 15 minutes of inactivity. `render.yaml` ships configured for the free
plan by default (zero cost, but data resets periodically); switching to real
persistence is a two-line change once you decide you want it — see "Adding
real persistence" below.

### Option A — Blueprint (recommended, fully automatic)
1. Push this `taskora-backend` folder to its own GitHub repo.
2. In the Render dashboard: **New +** → **Blueprint** → connect that repo.
3. Render reads `render.yaml` and creates the service and environment
   variables (including a freshly generated JWT secret) automatically.
   Nothing here references or reuses config from any other service on your
   account.
4. Every boot auto-seeds demo data if the datastore is empty — on the free
   plan (no disk), that means it re-seeds fairly often, since the
   filesystem doesn't survive spin-downs. That's expected on this plan.

If you want an even more distinct name than the default `taskora-api` (e.g.
if you're worried about visually telling it apart from your other project in
the dashboard list), change the `name:` field in `render.yaml` before you
connect the repo.

### Option B — Manual, no Blueprint
1. **New +** → **Web Service** → connect the repo.
2. Name it something distinct, e.g. `taskora-api` or `taskora-staging`.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Add environment variable `TASKORA_JWT_SECRET` — any long random string.
5. Deploy. Same auto-seed-on-first-boot behavior as Option A.

### Adding real persistence (data survives redeploys/idle spin-downs)
Persistent disks require a paid plan (Starter, ~$7/month). To turn this on:
1. In `render.yaml`, change `plan: free` to `plan: starter`
2. Uncomment the `DATA_DIR` env var and the `disk:` block (both are already
   written out in the file, just commented — see the inline instructions
   there)
3. Commit and push — Render picks up the change automatically on a
   Blueprint-connected repo
4. First deploy after this change starts with an empty disk and auto-seeds
   once; every deploy after that leaves your data alone

Once this is on, treat the deployment like a real (if small) system for
testing: sign up new users, post jobs, approve/reject things as admin — it
all persists. Only running `npm run seed` manually from a Render Shell
resets it back to clean demo data.

### Preparing for the actual live system
Neither option above is meant to be the permanent production setup — a
single disk (or no disk) isn't how you'd run this for real users. Follow the
Postgres migration path in `Taskora_Technical_Spec.docx` instead once you're
past testing.

## Quick start

```bash
cd taskora-backend
npm install
npm run seed      # creates /data with demo users, providers, contracts, etc.
npm start         # starts the API + frontend at http://localhost:3000
```

Open **http://localhost:3000** in your browser. That's the same Taskora
interface you've seen, now backed by a real API — sign in, post a job, accept
a match, approve a user as admin, refresh the page, and it's all still there.

### Demo accounts
Every seeded account uses the password `taskora123`:

| Role      | Email                  |
|-----------|-------------------------|
| Customer  | jordan@example.com      |
| Provider  | marcus@example.com      |
| Admin     | amara@example.com       |

The role-switcher in the navbar automatically logs in as the matching demo
account, so clicking "Customer / Provider / Admin" gives you a real,
authenticated session for each — not just a UI skin change.

You can also sign up as a brand-new customer or provider from the sign-in
screen; new accounts start unverified and show up in the Admin → User
Approvals queue.

## What's real vs. simulated

**Real:**
- Password hashing (bcrypt) and JWT-based authentication
- All data persistence — users, jobs, matches, contracts, escrow records,
  disputes, notifications, categories/countries — survives restarts
- The AI matching algorithm (scores available verified providers by rating,
  experience, and category fit — see `src/routes/marketplace.routes.js`)
- Role-based access control (a provider can't call admin endpoints, etc.)
- Settings changes, category/country toggles, dispute resolution, and
  approvals all write to the datastore

**Simulated (clearly labeled in the architecture doc as needing real vendors
before production):**
- Payment processing — no real money moves; escrow is tracked as a status
  field (`held` / `released`), not a live payment rail
- Identity verification — documents aren't actually checked against a KYC
  provider; admin approval is a manual toggle standing in for that pipeline
- Notifications are stored and fetched, but no real email/SMS/push is sent

This mirrors how most marketplace MVPs are actually built: the business logic
and data model are real from day one, and specific vendor integrations
(Stripe, a KYC provider, Twilio, etc.) get wired in against the same API
surface once you've picked partners.

## Project structure

```
taskora-backend/
  server.js                 — Express app entrypoint, serves API + frontend
  src/
    db.js                   — JSON-file datastore (see note below)
    auth.js                 — JWT + bcrypt helpers, requireAuth/requireRole middleware
    seed.js                 — resets /data to a known demo state
    routes/
      auth.routes.js         — signup, login, get/update current user
      marketplace.routes.js  — providers, jobs, AI matching, contracts
      payments.routes.js     — payouts, escrow release, escrow summary
      admin.routes.js        — approvals, verification queue, disputes, categories/countries, stats
      misc.routes.js         — notifications, verification submission, messages
  data/                      — JSON data files (created by seed, gitignored in real use)
  public/                    — the Taskora frontend (index.html)
```

## Why a JSON-file datastore instead of Postgres/MySQL?

So `npm install && npm start` works immediately on any machine, with no
database server to install, no native modules to compile, and no connection
string to configure. Every route talks only to `src/db.js`'s methods
(`all`, `find`, `filter`, `insert`, `update`, `remove`) — never to the JSON
files directly — so swapping in a real database later is a matter of
rewriting `db.js`, not touching route logic.

### Going to production
Before this handles real users and real money, at minimum:
1. Swap `src/db.js` for Postgres (Prisma or Knex are good fits) — the method
   signatures in this file are intentionally close to what an ORM query
   builder looks like, to make that swap mechanical.
2. Move `JWT_SECRET` in `src/auth.js` out of the code and into an environment
   variable / secrets manager, and rotate it.
3. Add a real payment processor + escrow provider integration behind
   `payments.routes.js`.
4. Add a real KYC/identity verification vendor behind the verification
   endpoints, per the per-country approach in the architecture doc (BVN/NIN
   for Nigeria, national ID for Ghana, etc.).
5. Add request validation (e.g. zod) and rate limiting on auth endpoints.
6. Add HTTPS/TLS termination (typically handled by your host/load balancer).

## API reference (short version)

All endpoints are prefixed with `/api`. Authenticated endpoints expect
`Authorization: Bearer <token>`.

| Method | Path                                  | Auth          | Purpose |
|--------|---------------------------------------|---------------|---------|
| POST   | /auth/signup                          | —             | Create account |
| POST   | /auth/login                           | —             | Get a token |
| GET    | /auth/me                              | any           | Current user |
| PATCH  | /auth/me                              | any           | Update profile/settings |
| GET    | /providers                            | —             | List/search providers |
| GET    | /providers/:id                        | —             | Provider profile + reviews |
| POST   | /jobs                                 | customer      | Post a job → runs AI matching |
| GET    | /jobs/mine                            | customer      | Your posted jobs |
| GET    | /matches/mine                         | provider      | Your pending AI matches |
| POST   | /matches/:id/respond                  | provider      | Accept/decline a match |
| POST   | /contracts                            | customer      | Book a specific provider directly |
| GET    | /contracts/mine                       | any           | Your bookings/contracts |
| POST   | /contracts/:id/complete               | customer      | Confirm job done → release escrow |
| GET    | /payouts/mine                         | provider      | Payout history |
| POST   | /payouts/request                      | provider      | Request a payout |
| GET    | /escrow/summary                       | admin         | Platform-wide escrow snapshot |
| GET    | /notifications/mine                   | any           | Your notifications |
| GET    | /verification/mine                    | any           | Your verification records |
| POST   | /verification/submit                  | any           | Submit documents for review |
| GET    | /admin/stats                          | admin         | Platform stats |
| GET    | /admin/users/pending                  | admin         | Unverified accounts |
| POST   | /admin/users/:id/decide                | admin         | Approve/reject a user |
| GET    | /admin/verification-queue             | admin         | Docs awaiting review |
| POST   | /admin/verification/:id/decide         | admin         | Approve/reject a document |
| GET    | /admin/disputes                       | admin         | All disputes |
| POST   | /admin/disputes/:id/resolve            | admin         | Resolve a dispute, release escrow |
| GET/PATCH | /admin/categories[/​:id]            | admin         | List / toggle categories |
| GET/PATCH | /admin/countries[/​:id]             | admin         | List / toggle countries |

## Frontend fallback behavior

The frontend (`public/index.html`) checks `/api/health` on load. If the
backend isn't reachable, it silently falls back to realistic in-memory demo
data so the UI still works if you open the HTML file directly without
running the server — useful for a quick visual look, but nothing you do in
that mode is saved. Run the backend for the real experience.
