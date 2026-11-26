// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-people",
 "flow": "people",
 "section": "people",
 "area": "Customers & Providers",
 "title": "Customers and providers",
 "tagline": "Find a person, see their account, and pause or reactivate it",
 "scenes": [
  {
   "kind": "title",
   "icon": "users",
   "title": "**Customers** and **providers**",
   "sub": "Find a person, see their account, and act on it.",
   "beats": [
    "This video explains Customers and Providers: the list of everyone in your region, and what you can do with an account."
   ]
  },
  {
   "kind": "list",
   "h": "Find a **person**",
   "items": [
    {
     "icon": "search",
     "t": "Search by name, email or phone"
    },
    {
     "icon": "users",
     "t": "Filter: customers, or providers"
    },
    {
     "icon": "eye",
     "t": "Open their account",
     "sub": "bookings, verification, score, flags"
    }
   ],
   "beats": [
    "Search for a person by name, email or phone.",
    "Filter to see only customers, or only providers.",
    "Open an account to see their bookings, their verification, their score, and any fraud flags."
   ],
   "from": 0
  },
  {
   "kind": "table",
   "h": "What you can **do**",
   "head": [
    "Action",
    "When"
   ],
   "rows": [
    {
     "c": [
      "Suspend",
      "Serious problem: fraud, threats, repeated no-shows"
     ]
    },
    {
     "c": [
      "Reactivate",
      "The problem is resolved"
     ]
    },
    {
     "c": [
      "Ask a pro to pause",
      "A low Trothen Score: talk first"
     ]
    }
   ],
   "beats": [
    "What can you do with an account?",
    "Suspend it, for a serious problem: fraud, threats, or repeated no-shows. A suspended person cannot book or be booked, and is not shown in search.",
    "Reactivate it, when the problem is resolved.",
    "For a pro with a low Trothen Score, talk to them first. A pause is recommended by the system, but only an administrator applies it."
   ]
  },
  {
   "kind": "warn",
   "h": "Be **fair**",
   "lines": [
    {
     "t": "Never suspend because of one complaint you have not checked."
    },
    {
     "ok": true,
     "icon": "doc",
     "t": "Write the reason. The person is told."
    },
    {
     "ok": true,
     "icon": "lock",
     "t": "Closing an account is the person's own choice, in their Settings."
    }
   ],
   "beats": [
    "Be fair.",
    "Never suspend someone because of one complaint you have not checked.",
    "Always write the reason. The person is told.",
    "Closing an account is the person's own choice, in their Settings. Their personal data is then removed."
   ]
  },
  {
   "kind": "end",
   "title": "People, **treated fairly**",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Every action is recorded. Be careful, and be fair."
   ]
  }
 ]
};
