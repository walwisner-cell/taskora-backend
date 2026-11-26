// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-payments",
 "flow": "payments",
 "section": "payments",
 "area": "Payments",
 "title": "Money held and payouts",
 "tagline": "See the money held, and send pros their payouts",
 "scenes": [
  {
   "kind": "title",
   "icon": "wallet",
   "title": "Money **held** and **payouts**",
   "sub": "See the money held, and send pros their payouts.",
   "beats": [
    "This video is for Finance. It explains the Payments area: the money Trothen holds, and sending pros their payouts."
   ]
  },
  {
   "kind": "list",
   "h": "The **numbers** at the top",
   "items": [
    {
     "icon": "shield",
     "t": "Escrow held",
     "sub": "Money customers paid, waiting for the work."
    },
    {
     "icon": "money",
     "t": "Escrow released",
     "sub": "Paid out to pros so far."
    },
    {
     "icon": "chart",
     "t": "Commission and service fees",
     "sub": "Trothen's own income."
    }
   ],
   "beats": [
    "At the top are the numbers.",
    "Escrow currently held: money customers paid, waiting for the work to be done.",
    "Escrow released: paid out to pros so far.",
    "And commission and service fees: Trothen's own income. Choose dates to see a period, and download the transactions as a PDF."
   ]
  },
  {
   "kind": "timeline",
   "h": "Sending a **payout**",
   "points": [
    {
     "icon": "bell",
     "t": "A pro cashes out",
     "sub": "it joins the queue"
    },
    {
     "icon": "eye",
     "t": "Check the details",
     "sub": "wallet and name"
    },
    {
     "icon": "money",
     "t": "Send the money",
     "sub": "Mobile Money or bank"
    },
    {
     "icon": "check",
     "t": "Mark as sent",
     "sub": "with the transaction ID"
    }
   ],
   "beats": [
    "Here is how a payout is sent.",
    "A pro taps Cash out, and the payout joins the queue.",
    "Check the details: the wallet or bank, and the name. The full number is shown only here.",
    "Send the money from Trothen's Mobile Money or bank account. Or, where it is set up, tap Send by MTN MoMo.",
    "Then tap Mark as sent, with the transaction ID from the receipt. The pro sees the reference."
   ]
  },
  {
   "kind": "warn",
   "h": "If you **can't send**",
   "lines": [
    {
     "t": "A wrong number, or a name that does not match: do **not** send."
    },
    {
     "ok": true,
     "icon": "flag",
     "t": "Tap **Can't send**, and say why. The pro is told what to fix."
    },
    {
     "ok": true,
     "icon": "refresh",
     "t": "The payout stays in the queue."
    }
   ],
   "beats": [
    "If something is wrong.",
    "A wrong number, or a name that does not match: do not send.",
    "Tap Can't send, and say why. The pro is told what to fix.",
    "The payout stays in the queue until it is fixed."
   ]
  },
  {
   "kind": "end",
   "title": "Every payout, **recorded**",
   "sub": "The pro gets a statement by email.",
   "beats": [
    "Every payout is recorded, and the pro gets a statement by email."
   ]
  }
 ]
};
