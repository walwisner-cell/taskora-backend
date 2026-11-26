// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-pricing",
 "flow": "pricing",
 "section": "pricing",
 "area": "Plans & Pricing",
 "title": "Plans and pricing",
 "tagline": "Plan prices per country, and the monthly plan fee",
 "scenes": [
  {
   "kind": "title",
   "icon": "tag",
   "title": "Plans and **pricing**",
   "sub": "Plan prices per country, and the monthly plan fee.",
   "beats": [
    "This video explains Plans and Pricing: the pros' plans, their prices in each country, and the monthly plan fee."
   ]
  },
  {
   "kind": "table",
   "h": "The **plans**",
   "head": [
    "Plan",
    "Commission",
    "How a pro gets it"
   ],
   "rows": [
    {
     "c": [
      "Starter",
      "13%",
      "Everyone starts here"
     ]
    },
    {
     "c": [
      "Pro",
      "12%",
      "50 jobs, rating 4.7, few cancellations"
     ]
    },
    {
     "c": [
      "Super Pro",
      "10%",
      "500 jobs, rating 4.85, a year on Trothen"
     ]
    }
   ],
   "beats": [
    "There are three plans for pros.",
    "Starter: 13 percent commission. Everyone starts here.",
    "Pro: 12 percent. A pro moves up by themselves after 50 jobs, a rating of 4.7, and few cancellations.",
    "Super Pro: 10 percent, after 500 jobs, a rating of 4.85, and a year on Trothen."
   ]
  },
  {
   "kind": "list",
   "h": "**Prices** per country",
   "items": [
    {
     "icon": "money",
     "t": "A base price in US dollars"
    },
    {
     "icon": "globe",
     "t": "A country can have its **own** price",
     "sub": "In its own money."
    },
    {
     "icon": "refresh",
     "t": "Exchange rates update daily",
     "sub": "A super admin can set one by hand."
    }
   ],
   "beats": [
    "Each plan has a monthly price.",
    "A base price in US dollars.",
    "A country can have its own price, in its own money, that suits local incomes.",
    "Exchange rates update by themselves every day. A super admin can also set a rate by hand."
   ]
  },
  {
   "kind": "warn",
   "h": "The **monthly plan fee**",
   "lines": [
    {
     "t": "It is **off** until it is switched on in two places: on the server, and here."
    },
    {
     "ok": true,
     "icon": "clock",
     "t": "Then 30 days' notice before the first invoice. Nothing is back-billed."
    },
    {
     "ok": true,
     "icon": "money",
     "t": "Never charged to a card: taken from payouts, never more than half of one."
    }
   ],
   "beats": [
    "The monthly plan fee.",
    "It is off until it is switched on in two places: on the server, and here, by a super admin.",
    "Then every pro gets 30 days' notice before the first invoice. Nothing is ever back-billed.",
    "It is never charged to a card. It is taken from the pro's payouts, never more than half of one payout. You can waive an invoice if needed."
   ]
  },
  {
   "kind": "end",
   "title": "Fair **prices**",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Set prices people can afford, and give fair notice of any change."
   ]
  }
 ]
};
