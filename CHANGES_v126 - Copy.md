# Trothen v126: escrow is back, without connecting real payments yet

## What I asked for
After v125, "Protected by Trothen" (escrow) disappeared, and I couldn't see where to pay or how much. I want escrow included, but I don't want real payments connected yet (not in Liberia either), and the token system should stay as it is.

## What changed
- **Escrow is offered again everywhere**, with the clear pay step from v125: the price, the fee and the total, then **Pay**. The money is held until the customer says the job is done (or confirms they arrived, for a ride).
- **Nothing is connected to real money.** No Stripe and no accounts are needed. The app says so plainly, so nobody is misled: "Payments aren't connected yet, so no real money moves for now." The same goes for the banner at the top and the Go-Live checklist.
- **Tokens are unchanged.** Pros still pay Trothen's commission on cash jobs from their tokens.
- **When I'm ready for real money,** one switch does it: Admin → Tokens → Settings → **Real payments only**. Once card payments (Stripe) or Trothen's accounts are set up, ticking it means escrow is only offered where real money can be paid. Until then it stays unticked.

## How much to pay
- In the booking window, typing an offer fills in the fee and the total straight away: $120 + $10.80 fee = $130.80.
- **Check my booking →** shows everything before it's sent.
- When a price is agreed, the **Pay** screen shows the exact total.

## Liberia
Liberia was set earlier to "Pay to Trothen's account with a code". If you don't want that connected yet, open Admin → Tokens → Countries → Liberia, set **Protected payments** to **"Escrow without real money (payments not connected yet)"**, and Save.

## Files
`server.js`, `src/customer-payments.js`, `src/platform-settings.js`, `src/go-live.js`, `src/routes/tokens.routes.js`, `public/app/trothen.js`, `public/app/payways.js`, `public/app/pricing.js`, `public/app/tokens.js`, `public/index.html`
