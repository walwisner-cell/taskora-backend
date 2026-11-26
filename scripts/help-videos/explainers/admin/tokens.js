// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-tokens",
 "flow": "tokens",
 "section": "tokens",
 "area": "Tokens",
 "title": "Tokens: sales, top-ups and settings",
 "tagline": "What pros bought and spent, and recording cash top-ups",
 "scenes": [
  {
   "kind": "title",
   "icon": "coin",
   "title": "**Tokens**: sales, top-ups and settings",
   "sub": "What pros bought and spent, and recording cash top-ups.",
   "beats": [
    "This video explains the Tokens area: what pros have bought and spent, checking payment codes, and recording top-ups paid outside the app."
   ]
  },
  {
   "kind": "list",
   "h": "What you **see**",
   "items": [
    {
     "icon": "coin",
     "t": "Tokens pros hold now",
     "sub": "A balance Trothen owes them in service."
    },
    {
     "icon": "chart",
     "t": "Spent in the last 30 days"
    },
    {
     "icon": "clock",
     "t": "Waiting for Mobile Money",
     "sub": "Purchases not yet confirmed."
    }
   ],
   "beats": [
    "At the top, you see the tokens pros hold now. That is money paid in advance, owed to them in service.",
    "What was spent in the last 30 days.",
    "And purchases still waiting for their Mobile Money payment to be confirmed."
   ],
   "from": 0
  },
  {
   "kind": "list",
   "h": "**Codes** and top-ups",
   "items": [
    {
     "icon": "key",
     "t": "Pro says paid: check it",
     "sub": "Match the code and the amount on the statement."
    },
    {
     "icon": "money",
     "t": "Record a cash top-up",
     "sub": "From the receipt. Tokens are worked out from what was paid."
    },
    {
     "icon": "lock",
     "t": "A receipt number can be used **once**",
     "sub": "The same payment can never be recorded twice."
    }
   ],
   "beats": [
    "Pros who send Mobile Money themselves get a code. When a pro says they paid, check the code and the amount on the statement, then confirm.",
    "A top-up paid outside the app, like cash at an office, is recorded from the receipt. You never type a number of tokens: they are worked out from what was paid.",
    "Each receipt or transaction number can be used once, so the same payment is never recorded twice."
   ],
   "from": 0
  },
  {
   "kind": "warn",
   "h": "**Settings**: super admin only",
   "lines": [
    {
     "t": "Packs, limits and countries are set by a super admin."
    },
    {
     "t": "\"Test purchases\" must stay **off** on the live site."
    },
    {
     "ok": true,
     "icon": "doc",
     "t": "Token sales count as income only when tokens are spent."
    }
   ],
   "beats": [
    "Settings are for a super admin only.",
    "The packs, the limits, and the countries where tokens are on.",
    "The test-purchase switch must stay off on the live site, or pros would get tokens for free.",
    "For the accounts: token sales count as income only when tokens are spent. Unspent tokens are a balance owed to pros."
   ]
  },
  {
   "kind": "end",
   "title": "Every token **accounted** for",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Every token is a line in the ledger, with what it was for."
   ]
  }
 ]
};
