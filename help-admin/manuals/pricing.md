---
key: pricing
title: Plans & Pricing: plan prices, memberships, exchange rates and billing
sections: pricing
video: pricing
updated: 2026-11-26
---
## What this part of Admin is for

**Plans & Pricing** sets what pros pay for their **plan** (Starter, Pro, Super Pro), what customers pay for a **membership** (Plus, Pro, Elite), **local prices** for each country, the **exchange rates**, and whether the monthly plan fee is **charged** yet.

> **Rule:** A price change affects real people's money. Change prices only with a super admin's decision, and tell the people affected first.

## Who can change what

| What | Who |
|---|---|
| Global plan prices, membership prices, exchange rates, billing | **Super admins only.** |
| A country's local plan price | Super admins (any country), and a regional admin (their **own country** only). |
| Look at all of it | Admins who can open Plans & Pricing. |

## Global Base Price (USD)

One price per plan, in US dollars. **Every country without its own override follows this price**, converted to its own money at the current exchange rate. Type the **New Price** and press `Save` on that row.

## Customer Membership Pricing (USD)

- **Free** is always $0.
- **VIP** is by invitation only (granted by a super admin in Customers & Providers): it can't be bought.
- Only **Plus**, **Pro** and **Elite** can be edited. The table shows what each gives (for example Plus: 20% off the service fee).

These prices are shown and charged everywhere in the app, converted to each customer's own money.

## Country Overrides

A country can have its **own local price** for a plan, for example a round amount people understand.

1. Choose the **Country** and the **Plan**.
2. Type the **Local Price**, in that country's money.
3. Press `Set Price`.

A regional admin can set or remove prices **for their own country only**. Countries without an override follow the global price.

## Exchange Rates

The rate for each currency (units per US$1), its **source**, and when it was **last updated**. Rates are updated **daily** from a live rate provider; `↻ Refresh Live Rates Now` updates them at once. You can type a **New Rate** and `Save` it on a row.

> **Warning:** Exchange rates are also used for **job payments and payouts**. A wrong rate means wrong amounts for real people. Change one by hand only with Finance, and only when the live rate is clearly wrong.

## Charging the monthly plan fee

Built and ready, but **off until real payments are live**. A pro is **never charged on a card**: once a month they get an **invoice**, and it is taken **from their own payouts**, never more than half of a payout, oldest invoice first.

Two locks must both be open before anything is charged:

- **Lock 1, server:** the `PLAN_BILLING_ENABLED` setting on the server (Render). Set only once real payments are live.
- **Lock 2, this switch:** `Switch on`, with the **notice before the first invoice** (30 days by default), so every pro is told in advance.

**If billing ran today** shows how many pros would be billed on each plan, and how much a month. **Invoices so far** shows what was billed, taken from payouts, and still open.

> **Policy:** When to start charging plan fees, and the notice to give, is a business decision for Trothen, and may need a lawyer's review of the terms.

## Mistakes to avoid

- Changing a global price without telling pros first.
- Typing a local price in US dollars by mistake (it is in the country's money).
- Changing an exchange rate by hand without Finance.
- Switching billing on before real payments are live.
