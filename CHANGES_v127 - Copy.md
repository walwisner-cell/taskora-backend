# Trothen v127: pros review my job and accept my price

## What I asked for
When I post a job, I already put my price (budget) on it. I shouldn't have to type a price again after the match. Each matched pro should review the job and decide whether they can do it for my price.

## What changed
- **One price, set when I post the job.** I no longer have to send a separate offer to each pro after matching.
- **The pro reviews it.** In Job Matches, the pro sees my job and my price, with three choices:
  - **Accept the job at $50.00**: this means they agree to my price.
  - **Send a different price**: the pro answers with their own price, and I can accept it or answer back, as before.
  - **Decline**.
- **The first pro to accept gets the job.** Every other matched pro is told it's taken. If one of them presses Accept late, they see "Another pro has already taken this job."
- **I see it straight away, with no refresh.** On my side, each pro shows **"Reviewing your job"** until they answer. When one accepts, the card shows **"Price agreed $50.00"** and a **Pay $54.50** button (the price plus Trothen's fee). Nothing is booked until I pay.
- **Escrow works as in v126.** Payments aren't connected to real money yet.
- **Cash jobs** are booked as soon as the pro accepts. Trothen's commission is taken from the pro's tokens when they accept. If the pro doesn't have enough tokens, the app tells them exactly how many they need, and to buy tokens first.
- **Budgets given as a range** (for example "$80-150") can't be accepted with one press, because there's no single price. The pro sends a price instead, and we agree on it as before.

## What I tested
- I posted "My Sink is broken" at $50. Aisha pressed Accept, and my screen showed **Pay $54.50** about one second later, without refreshing.
- A second pro, Bola, tried to accept the same job and got "Another pro has already taken this job."
- I checked that range budgets are refused for one-press accept, and that a cash job is refused when the pro is short of tokens and accepted once they top up.
- I reran all the earlier checks for bookings, escrow, payment codes, card payments, live updates and rides. They all still pass.

## Files
`src/routes/marketplace.routes.js`, `public/app/trothen.js`, `public/app/pricing.js`, `public/index.html`, `CHANGES_v127.md`
