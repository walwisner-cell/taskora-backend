---
key: payments
title: Payments and payouts
sections: payments
video: payments
updated: 2026-11-26
---
## What this part of Admin is for

**Payments** is where the finance team sees the money that moves through Trothen, and **sends pros the money they have earned**.

- When a customer pays through Trothen, the money is **held** (escrow) until the job is done.
- When the customer marks the job complete (or the 3 days to check pass, or a dispute is decided for the pro), the money is **released** to the pro's balance.
- The pro then asks for a **payout**. Trothen takes its **commission** at that moment, and the payout waits here, in **Payouts being sent**, until someone in Finance sends it.

> **Rule:** A payout is real money leaving Trothen. Never mark a payout as sent until the money has really gone, and you have the receipt's transaction ID in front of you.

## Who can do what

| Who | Totals and transactions | Commission and region totals | Download PDF | Payouts being sent (see, send, mark sent) |
|---|---|---|---|---|
| Financial team | Yes | Yes | Yes | Yes |
| Accountant | Yes | Yes | Yes | No |
| Controller | Yes | Yes | Yes | No |
| Legal team | Yes | Yes | Yes | No |
| Super admin | Yes | Yes | Yes | Yes |
| Custom admin | With "See transactions" | With "See the commission ledger" | With "Download transactions" | With "See payouts being sent" |

- A team member who covers **one city or one country** sees only the money of pros in that area.
- Pressing `Show full number`, `Mark as sent`, `Send by MTN MoMo` or `Can't send` is written in the **Access Logs** with your name and the time.

## The page, from top to bottom

### 1. The totals

- **Escrow Currently Held:** money customers have paid that Trothen is holding for jobs not yet finished.
- **Escrow Released (Total):** money released to pros after the job was confirmed.
- **Commission Revenue:** Trothen's commission received.
- **Service Fee Revenue:** the service fee customers paid on top of the price (not on cash jobs).

> **Note:** Held money is **not Trothen's money**. It belongs to the customer until the job is done, then to the pro. Never count it as income.

### 2. Date range

Choose a **From** and a **To** date: the panels below show only that period. `Clear` shows everything again. `Download Transactions PDF` makes a report of the transactions shown, for the accounts or an audit. Keep it in Trothen's own files only.

### 3. Funds by Region

One row per city: escrow held, escrow released, commission, service fees, number of transactions, the average transaction, and the share of all of Trothen's volume. Use it to see where the business is growing, and to spot a city where held money is building up (jobs not being finished, or disputes).

### 4. Commission Received

How much commission Trothen has received:

- **Taken from payouts:** commission taken when pros cash out (jobs paid through Trothen).
- **Paid with tokens:** commission on **cash jobs**, which pros pay with tokens when they accept the job, and commission that pros chose to pay with tokens instead of from their payout.

### 5. Platform Transactions

Every booking, newest first. Use the status list to show only **Active**, **Completed**, **Cancelled** or **Disputed** ones.

| Column | What it shows |
|---|---|
| Date, Customer, Provider, Category, Service | The booking. |
| Amount | The price of the booking, in US dollars. |
| Materials Adv. | Money the customer agreed to pay early for materials. |
| Escrow | *held*, *released*, or *refunded*. |
| Commission | Trothen's commission. "est." means an estimate: it is final only when the pro is paid out (their plan may change before then). |
| Status | Active, Completed, Cancelled, Disputed. |
| Action | `PDF`: the record of this one booking. |

## How the commission is worked out

The commission is taken **when the pro asks for a payout**, on the money released to them:

| Pro's plan | Commission |
|---|---|
| Starter | 13% |
| Pro | 12% |
| Super Pro | 10% |

- An approved **custom rate**, or the rate of the pro's **organization**, is used instead when there is one.
- **Store goods** and **tips** carry no commission. **Rides** carry the ride rate, or none with a **Driver Pass**.
- A pro who won a **top-score award** can have one payout with no commission.
- A pro who chose "pay my commission with tokens" has it taken from their tokens first; they get that much more in the payout.
- Open **monthly plan fees** come out of the payout too, oldest first, never more than half of it.

## Payouts being sent

This list, at the bottom of the page, is the most important part for Finance. Each line is one payout a pro has asked for:

- the pro's name, the amount in US dollars (and in local money, when the pro chose it), and their city and country;
- **where it goes:** the Mobile Money network and the last 4 digits, or the bank;
- when it was asked for;
- a **warning in orange** when the account is in someone else's name;
- a **warning** when a problem was already reported on it.

Payouts are listed **oldest first**. Send them in that order.

### Before you send: the checks

1. **Is the account in the pro's name?** If you see "⚠️ The account is in the name … not the pro", **stop**. Contact the pro and check before sending. Money sent to someone else's wallet is very hard to get back.
2. **Is the pro's account in good standing?** Look them up in Customers & Providers: not suspended or paused, and no open fraud flag.
3. **Do the amounts make sense?** A first payout far larger than usual, or a pro who joined only days ago, deserves a second look (see Fraud & Safety).
4. **Did the payout details change recently?** Pros can't cash out for **24 hours** after changing where their money goes. This protects them if someone takes over their account.

### Show full number

The list shows only the last 4 digits. Press `Show full number` to see the whole wallet or account number, the name on it, and the bank details. **Every press is recorded** in the Access Logs. Only press it when you are about to send.

### Sending by hand, then Mark as sent

1. Press `Show full number`.
2. Send the money from **Trothen's own** Mobile Money or bank account, to exactly that number and name.
3. Copy the **transaction ID** from the receipt (at least 4 characters).
4. Type it in the box **Transaction ID from the receipt**.
5. Press `Mark as sent`.

The payout becomes **paid**, and the pro is told: "Your payout of $… was sent to … Reference: …". The reference lets the pro and the accounts match it to the receipt.

> **Warning:** Press `Mark as sent` only **after** the money has gone. If a transfer fails after you pressed it, tell your manager at once.

### Send by MTN MoMo

For a payout to an **MTN Mobile Money** wallet in Liberia, when Trothen's MTN payouts are switched on, a button `Send by MTN MoMo` appears.

- Press it once. The payout goes to MTN and is listed under **Waiting for MTN to confirm**.
- A check every few minutes marks it **paid**, with MTN's transaction ID, or puts it back in the list with MTN's reason.
- If MTN payouts are not switched on, the line says so: send it by hand from Trothen's MTN account, then press `Mark as sent`.

### Can't send

If the number is wrong, the name doesn't match, or the wallet refuses the money:

1. Press `Can't send`.
2. Write what is wrong, in words the pro understands (at least 5 characters), for example: "The MTN number does not accept transfers. Please check it in Settings."
3. Press `Tell the pro`.

The pro is told to fix their payout details. The payout **stays in the list** with your note, until they fix it and you send it.

### When two people press at the same moment

If two people in Finance press a button on the same payout at the same moment, only one goes ahead. The other sees "Someone else is updating this payout right now." Refresh, and check before trying again.

## While real payments are not switched on

Until real payments are switched on (Admin → Tokens → Settings → Real payments only), no real money comes in, so payouts **are marked paid by themselves after 2 days**. The note at the bottom of the list says so. Once real payments are on, a payout is paid **only** when someone marks it sent with the transaction ID, or MTN confirms it.

## Refunds and disputes

- Refunds after a dispute are decided in **Disputes**, not here. Here you see the result: the escrow shows *refunded*.
- If a refund is decided after the pro was already paid out, it can't be done in the app. Finance settles it by hand with the Disputes team, and records what was done.

## Daily routine for Finance

1. Open Payments, then **Payouts being sent**.
2. For each payout, oldest first: run the checks, send, and mark as sent with the transaction ID.
3. Clear any **Waiting for MTN to confirm** older than a day: check with MTN.
4. Answer pros whose payout had a problem, once they have fixed their details.
5. At the end of the month, download the transactions PDF for the accounts.

> **Policy:** How fast payouts must be sent is for Trothen to set. Until it is set, send every payout within **2 working days** of the request.

## Mistakes to avoid

- Marking a payout as sent before the money has gone.
- Sending to an account in someone else's name without checking with the pro.
- Pressing `Show full number` just to look. Every press is recorded.
- Typing a made-up reference. It must be the real transaction ID from the receipt.
- Counting held money as Trothen's income.
