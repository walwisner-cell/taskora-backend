---
key: tokens
title: Tokens: pros' prepaid credit
sections: tokens
video: tokens
updated: 2026-11-26
---
## What this part of Admin is for

**Tokens** are prepaid credit that pros buy from Trothen. **1 token = US$1.** Pros use them to pay Trothen:

- the **commission on cash jobs** (the customer pays the pro directly, so Trothen can't take it from a payout);
- and, if they choose, their commission on other jobs, their monthly plan fee, ads and Driver Passes.

Tokens **never touch customers' money**. A pro who owes tokens can't accept new cash jobs until they top up.

In **Admin → Tokens** the team sees what pros have bought and spent, confirms **mobile money payments**, records **payments made outside the app**, and (super admins) sets the rules.

> **Rule:** Never add tokens for money you have not seen arrive in Trothen's own account. Tokens are money.

## Who can do what

| Who | See totals, codes, balances | Confirm a payment code, or say no payment was found | Record a payment (cash, agent, bank) | Settings, packs, countries, adjust a balance |
|---|---|---|---|---|
| Customer service | Yes | No | No | No |
| Financial, Accountant, Controller | Yes | Yes | Yes | No |
| Super admin | Yes | Yes | Yes | Yes |
| Custom admin | With "See token balances" | With "Confirm or reject token payments" | With "Record a cash token top-up" | No |

Opening the page, looking up a pro, confirming, rejecting, recording and adjusting are all written in the **Access Logs**.

## The totals

- **Tokens pros hold now:** the unspent balance of all pros, and what it is worth. This is money pros have **paid Trothen in advance**.
- **Sold, last 30 days:** money from token sales, and how many tokens, including **bonus** tokens.
- **Spent, last 30 days:** tokens used to pay Trothen, and those given back on refunds.
- **Sold, all time.**

> **Note (for Finance):** A token sale is **revenue only when the token is spent**. Unspent tokens are a **balance owed to pros**. Bonus tokens are a discount, counted when they are spent. Report them this way in the accounts.

## Mobile money payment codes

A pro who pays by sending mobile money **themselves** gets a **payment code** from Trothen (for example `TK7H3M9Q`) to write in the reference of their transfer. They then say they have paid.

To confirm one:

1. Open **Trothen's own mobile money statement**.
2. Find the payment with **that code in the reference**.
3. In **Mobile money payment codes**, search the code (or the pro's transaction ID) and press `Find`, or press `Show all open`. Codes the pro says are paid come first.
4. Type **Trothen's transaction ID** (from the statement) and the **amount received**.
5. Press `Confirm payment`, and confirm again: "Only do this once you can see the money on Trothen's statement with this code in the reference."

The tokens are added to the pro at once, and they are told.

- A pro can have at most **3 codes** waiting at a time.
- A code **expires** after a set number of hours if nothing is paid. An expired code can still be confirmed if the money did arrive.

What the system refuses, and why:

| Message | What to do |
|---|---|
| "Only … arrived but the code is for …" | **Don't confirm.** Ask the pro to send the rest, or reject the code and use **Record a payment** for what arrived. |
| "Transaction … has already been used" | The same transaction can't pay twice. Check you have the right line on the statement. |
| "Code … was already confirmed" | Nothing to do: it is done. |
| "… would take … over the …-token limit" | Refund the payment to the pro by hand, or ask a super admin. |

If **more** arrived than the code asked for, it is confirmed and the extra is noted as **overpaid**: tell Finance, who decide whether to refund it.

### When no payment can be found

If the pro says they paid but nothing with that code is on the statement after a reasonable wait, type the reason in **If no payment found: reason (the pro sees it)** and press `No payment found`, for example: "We can't find a payment with code TK7H3M9Q on our statement. Please send us the transaction ID from your SMS."

## Record a payment made outside the app

For a pro who paid **in cash, through an agent, by bank deposit, or by mobile money to Trothen's number without a code**:

1. In **Look up a pro**, search their **email or name**, and press `Search`.
2. Under their name, in **Record a payment**:
   - choose **a pack** they paid for, **or** type the **amount paid** in their currency;
   - choose **how they paid**: cash, agent, bank deposit or mobile money;
   - type the **receipt or transaction number** (3 to 60 characters);
   - add a **note** if useful: where it was paid, who took it.
3. Press the button, and confirm: "Only do this once you have checked the money has really arrived."

The same receipt number can't be used twice.

> **Warning:** For **cash**, the person who took the money must give a receipt, and the cash must reach Trothen's account. Never record cash you have not seen counted.

## Adjust a balance (super admin)

Under a pro in **Look up a pro**, a super admin can add or take away tokens: type **+ or -** and a number, and a **reason (the pro sees this)**. Use it only to correct a mistake, never as a gift without your manager's agreement.

## Settings (super admin)

- **Tokens are on:** pros can buy them and pay Trothen with them. Turning it off keeps pros' balances, but they can't buy or pay with tokens until it is on again.
- **LIVE SITE: pay out only money Trothen really received.** Payouts include only bookings paid by code or mobile money; test bookings are left out.
- **Real payments only:** tick it once card payments or Trothen's accounts are set up. If something is not ready, the page lists what, and asks before switching it on.
- **TEST SITES ONLY: "Pay in the app" adds tokens without a real payment.** It must stay **off** on the live site, or pros get tokens for free.
- **Cash jobs are on:** customers may pay the pro directly after the job, and the commission comes from the pro's tokens.
- **Most tokens one pro can hold** and **Most a pro can buy in 24 hours (US$)**.
- **Countries where tokens are on** (empty means every country).
- **Packs:** a code, a name, a price in US dollars, and the tokens. Tokens must be **at least** the price; anything above is **bonus**. `+ Add a pack`, `Remove`, then `Save settings`.

### Countries

Choose a country and press `Show`, to see exactly what pros there are offered, in their own money. A country can have its **own packs**, a **fixed local price** per pack (round amounts like L$950), and its **own limits**. A warning shows when a fixed local price has drifted **5% or more** from the US dollar price because of the exchange rate: update it.

## Recent activity

The latest purchases, payments with tokens and adjustments, with the pro and the amounts. Use it to answer a pro who asks "where did my tokens go?".

## Answering pros

| The pro says | Check |
|---|---|
| "I paid but have no tokens" | Mobile money codes: is their code there? Find it on Trothen's statement, then confirm or reject. |
| "My tokens went down" | Recent activity: a cash job's commission, a plan fee, an ad, a Driver Pass. |
| "I can't accept cash jobs" | Their balance: they owe tokens. They need to top up. |
| "I can't buy more" | The limits: most they can hold, and most per 24 hours. |

## Mistakes to avoid

- Confirming a code before seeing the money on Trothen's statement.
- Confirming a payment that is short.
- Recording cash nobody has counted.
- Leaving "TEST SITES ONLY" switched on in the live site.
- Counting unspent tokens as revenue.
