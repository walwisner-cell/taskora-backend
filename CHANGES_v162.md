# Trothen v162: a shopping cart

What Walter asked: "can you implement shopping Cart".

## What was there before
Each store had a basket inside its own window: tap + on a good, then "Buy these goods". But that basket:
- **disappeared on a refresh,** when the store window closed, or on another phone;
- **was separate for every store,** with nothing showing what was waiting in the others;
- **couldn't be filled from the Market.** A tap on a store good just opened the store;
- **wasn't kept for a visitor who wasn't signed in.** The page said "Your basket is kept" when they were asked to sign in, but it wasn't.

## What the cart does now
It works the way Etsy, Jumia and Amazon's marketplace do it.

**One cart, kept:**
- One cart across every store, with a **cart icon and count in the top bar** on every screen (next to the bell), for customers, pros and visitors.
- **Kept on the account.** It's the same cart on any phone or computer you sign in on, and it survives a refresh.
- **Visitors not signed in** have their cart kept in their browser. When they sign in, it's **added to their account's cart** (where both have the same good, the larger amount is kept), and they're told. Signing out leaves nothing behind on a shared phone.

**The cart page** (the icon, "Cart" in the customer's menu, or "View cart" in a store):
- Goods are **grouped by store**, with the store's name (tap to open it), the seller and the town.
- Each good shows **its photo, its size or colour, today's price** (with the old price crossed out when it's on sale, and the trade price for pros), **+ and −**, **Remove** and **Save for later**.
- **Saved for later** keeps a good out of the total, under its own heading, with **Move to cart**.
- **Each store's subtotal**, worked out exactly as its checkout will: sales, trade prices and local money included.
- **Check out with this store** opens that store's own checkout with the cart's goods. Everything already there still works: collect, the seller brings it, or a driver; discount codes; returns; local money; paying by card, code or Mobile Money.

**Why one store at a time:**
- Each store has its own delivery, its own discount codes and its own held money, paid to that seller only when you have the goods. Etsy works the same way.
- The cart says this in one line when it holds goods from more than one store.

**Today's prices and stock, every time the cart opens:**
- **A price that went up or down** since you added the good is pointed out once, with the old price.
- **An amount above what's left** is brought down to what's left, and the cart says so ("Only 5 left").
- **A sold-out good, or one taken off the shelf,** stays in the cart, marked, and is left out of that store's checkout. You can remove it, or save it for later.
- **A closed store** is marked the same way.
- **The cart doesn't hold stock.** Stock is held when an order is placed, as everywhere: a cart is a list, not a promise.

**Goods leave the cart when they're ordered,** whether on their own or added to a booking with the pro. Anything else from that store stays.

**From the Market:**
- Each store good now has **Add to cart**.
- A good that comes in sizes or colours says **Choose options** and opens the store, where you choose one.

**Limits, so it stays usable:**
- up to 60 goods in the cart (saved ones included);
- up to 20 different goods from one store (what one order can hold);
- up to 99 of a good;
- you can't put your own store's goods in your cart;
- admins have no cart;
- goods nobody has touched for 90 days are cleared.

**Private sellers' items in the Market** (one used item, with its own Buy button) aren't cart goods, as on Jiji and Facebook Marketplace.

## A gap found on the way: goods with sizes or colours never showed in the Market
The Market checked stock without a size or colour chosen, which for such a good always came out as "none left". So every good with sizes or colours (added in v143) was hidden from the Market. The Market now shows a good when any of its sizes or colours is in stock.

## In Spanish
Everything in the cart is in Spanish too (Tu carrito, Añadir al carrito, Guardar para después, Pagar en esta tienda…).

## What I tested
- **New `t162` (44 checks).**
- **The rules:**
  - adding, adding again, and setting an amount;
  - a size that must be chosen, or is sold out;
  - more than is left, more than 99, and your own store;
  - two stores and their subtotals;
  - Save for later and back;
  - a price going up (pointed out once);
  - stock dropping, and a good leaving the shelf;
  - a visitor's cart joining the account;
  - ordering taking those goods out;
  - the icon's count;
  - the Market saying which goods need a size chosen.
- **Real taps on a phone:**
  - a visitor adds goods in a store and the count shows;
  - after a refresh they're still there;
  - the cart page asks them to sign in;
  - they sign in and the goods are in their account;
  - Add to cart from the Market;
  - + on the cart page, Save for later, Remove;
  - nothing wider than the phone;
  - Check out with this store opens that store's checkout, they pay, and the goods leave the cart;
  - the cart in Spanish;
  - no page errors.
- **The top bar on the smallest phone (320 px),** for a visitor, a customer (English and Spanish) and a pro: everything fits.
- **Every earlier suite,** on the file store and on Postgres.

## Files
- **New:**
  - `src/cart.js` (the cart's rules)
  - `src/routes/cart.routes.js` (the cart's addresses)
  - `public/app/cart.js` (the cart page, the icon, keeping the stores' baskets in step)
  - `CHANGES_v162.md`
- **Changed:**
  - `server.js` (the cart's addresses)
  - `src/store.js` (in stock when any size or colour is)
  - `src/routes/orders.routes.js` and `src/routes/marketplace.routes.js` (ordered goods leave the cart)
  - `src/routes/market.routes.js` (goods with sizes or colours in the Market; which need a choice)
  - `public/app/market.js` (Add to cart on Market cards)
  - `public/index.html` (the cart's look; fingerprints refreshed)

No database changes (the cart is kept like every other record, on the file store and on Postgres), no new packages.
