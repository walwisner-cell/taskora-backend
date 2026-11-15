# Trothen v116: Tokens made to work well in Liberia, Ghana and Nigeria

You asked me to make tokens best practice so they work well in an African setting without issues. v116 builds on v115, which isn't deployed yet, so the package includes both. Here's what I changed and why.

## 1. Prices in people's own money, rounded to amounts they actually pay
- A customer in Liberia now sees **L$950**, not "$5.00 ≈ L$947.32". The local price comes first and the dollar amount is a small guide next to it.
- Prices are rounded the way people pay: to L$10, ₦50 and GH₵0.50 steps.
- In Admin → Tokens → **Countries**, a pack can be given a **fixed local price** (for example ₦7,500) that doesn't move with the exchange rate.
- If a fixed price drifts 5% or more from today's rate, the admin page marks it ⚠️, because customers are then getting noticeably more or less than they paid for. This matters most for the naira, which can move a lot.
- On Liberian mobile money, MTN is asked for exactly the L$ amount shown on screen. It isn't converted a second time.
- 1 token is still always worth $1. Customers keep the value of their tokens even if their currency falls. The risk of that sits with Trothen, which is one reason I kept the balance limits low (see 3).

## 2. Smaller packs, like airtime
- In Liberia, Ghana and Nigeria the packs start at $2: Mini $2 = 2 tokens, Small $5 = 5, Medium $10 = 10.5, Large $25 = 26.5. People top up little and often, so a $50 or $100 pack shuts most of them out.
- Other countries keep the v115 packs. Every pack is editable per country.

## 3. Limits that protect customers and Trothen
- **Most one customer can hold:** 200 tokens in Liberia, Ghana and Nigeria (500 elsewhere). This keeps the stored balance small, which is what regulators look for in small-value e-money and limits the loss if an account is taken over.
- **Most a customer can buy in 24 hours:** $100 in those three countries ($200 elsewhere). A stolen phone or mobile money account can't be emptied into tokens in one go.
- **4 or more purchases in 24 hours** raises a fraud flag for the team to check. It does not pause the account, so a genuine customer isn't locked out.
- Customers see how much more they can buy today, and the page tells them Trothen staff will never ask for their PIN or a code.
- Tokens can be switched on country by country, so you can start in one country and add the others when ready.

## 4. Weak or dropped connections can't charge someone twice
Every purchase now carries a one-time code from the phone. If the signal drops after paying and the customer presses Pay again, the server recognises it and returns the first purchase instead of charging again. The page tells them this: "If your connection drops, just press Pay again: you will not be charged twice." Tested: the same purchase sent twice gave tokens once.

## 5. Paying in cash or by mobile money to Trothen's own number
Many customers have no card and won't always use in-app mobile money. In Admin → Tokens → Look up a customer, there's now **Record a payment made outside the app**:
- **Ways to pay:** cash at an office, a Trothen agent, a bank deposit, or mobile money sent to Trothen's own number.
- **Staff can't type in a number of tokens.** The tokens come from the pack chosen or the amount paid. A custom amount gets no bonus.
- **Each receipt or transaction number can be used only once**, so the same payment can't be added twice.
- The customer gets a message with the receipt number and a reference, and the change is logged with who recorded it.
- Only super admins and the finance team can record payments. Customer service can only look.
- The customer's Tokens page explains this route and warns them to pay only through official channels, never to a private number. That's the most common agent scam.

## 6. Clearer records for support
Every purchase shows a reference number (and the receipt number for cash or agent payments) in the customer's history. Pending mobile-money payments show their reference too, so a customer and support can trace a payment MTN hasn't confirmed.

## What I tested (live)
- **Nigerian customer:** 4 packs in naira, rounded to ₦50 (₦3,100 / ₦7,750 / ₦15,500 / ₦38,750).
  - A dollar amount sent where the customer sees naira was refused.
  - Buying worked, and a repeated request was charged once.
  - The team was flagged after the 4th purchase, and the account stayed active.
  - The 5th purchase was refused at the $100 daily limit.
- **Fixed naira prices:** saved, shown to the customer, and the one 22% off the rate was marked ⚠️.
- **Ghana customer:** GH₵153 by mobile money recorded as 10 tokens. The same transaction number was refused the second time. A cash pack top-up worked.
- **Countries switch:** turning tokens on for Liberia and Ghana only switched them off for the Nigerian customer. An unknown country name was refused.
- **Liberia:** prices of L$380 / L$950 / L$1,900 / L$4,750. Bought in the browser at phone width, with no sideways scrolling and no errors.
- The v115 checks (paying, refunds, splits, extras, admin) still pass.

## Still needs business or legal action (code can't settle these)
1. **Licences:** a stored balance is regulated e-money in Liberia (Central Bank of Liberia), Ghana (Bank of Ghana) and Nigeria (CBN). The usual route is to partner with a licensed mobile-money or payment provider rather than hold the money yourself. Ask your attorney in each country before real sales. The low caps help, but they don't replace that check.
2. **The real limits:** each regulator sets its own limits for small accounts. I chose 200 tokens and $100 a day as cautious starting points. Change them in Admin → Tokens → Countries to whatever the regulator or your payment partner requires.
3. **Cash and agent top-ups:** before switching these on you need real procedures: who can take cash, daily cash counts, a receipt book or mobile-money statement to check against, and an agent agreement. The app makes double-recording impossible and logs everything, but it can't confirm the cash really arrived. Staff must check that first.
4. **Exchange rate:** local prices use the rate in Admin. For the naira especially, keep it current, or use fixed local prices and review them when the ⚠️ mark appears.
5. **Token money:** whatever Trothen holds for unspent tokens should sit in a separate account (ideally in US dollars, since tokens are worth $1). It's owed to customers.
