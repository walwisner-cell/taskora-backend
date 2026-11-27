---
key: custpay
title: Customer Payments: payment codes and refunds
sections: custpay
video: custpay
updated: 2026-11-26
---
## What this part of Admin is for

A customer can pay for a **protected booking** by sending **mobile money themselves** to Trothen's account, with a **payment code** in the reference. The booking waits until **Finance confirms the money arrived**. Then the payment is **held** like any protected payment, and the pro is told to go ahead.

When such a booking is refunded, Trothen sends the money **back by mobile money**, and Finance records it here.

> **Rule:** Confirm a payment only when you can see it **on Trothen's own statement**, with **that code in the reference**, and the **full amount**.

Payment codes are switched on for each country in **Admin → Tokens → Countries**.

## Who can do what

- **See** the payments: super admins, customer service and the finance team (Financial, Accountant, Controller), and custom admins with "Customer Payments".
- **Confirm, reject, and mark refunds sent:** super admins and the finance team, and custom admins with those permissions.

Every confirmation and refund is in the **Access Logs**.

## Payments to confirm

Search a **code** or a **transaction ID** and press `Find`, or press `Show all waiting`. Payments the customer **says they made** come first, with the transaction ID they typed.

To confirm:

1. Open **Trothen's mobile money statement**. Find the payment with **the code in the reference**.
2. Type **Trothen's transaction ID** (from the statement, not the customer's).
3. Type the **amount that arrived**.
4. Press confirm.

The money is then **held** for the booking, and the pro and the customer are told.

What the system refuses:

| Message | What to do |
|---|---|
| "Only … arrived but the booking needs …" | **Don't confirm.** Ask the customer to send the rest, or cancel the booking and refund what arrived. |
| "Transaction … has already been used" | The same transaction can't pay twice. Check the statement line. |
| "This booking is no longer waiting for payment" | It was cancelled or ran out. If the money arrived anyway, **refund it**. |
| "… being confirmed by someone else right now" | A colleague is on it. Refresh. |

If **more** arrived than needed, it is confirmed and the extra is noted as **overpaid**: refund the difference.

### Reject

If no payment can be found after a reasonable wait, reject it with a reason (at least 5 characters). **The customer sees it.** For example: "We can't find a payment with this code on our statement. Please send us the transaction ID from your SMS."

## Refunds to send

Refunds due to customers who paid **by code**:

1. Send the money **to the number they paid from**, from Trothen's mobile money account.
2. Type the **transaction ID** of the refund you sent.
3. Mark it **sent**. The customer is told.

A refund can be marked sent only once.

> **Policy:** How fast refunds must be sent is for Trothen to set. Until it is set, send every refund within **2 working days**.

## Mistakes to avoid

- Confirming before seeing the money on Trothen's statement.
- Confirming a short payment.
- Typing the customer's transaction ID instead of Trothen's.
- Marking a refund sent before sending it.
