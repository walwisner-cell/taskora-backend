// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-overview",
 "flow": "overview",
 "section": "overview",
 "area": "Getting started",
 "title": "Your first day in Admin",
 "tagline": "What you see, and what you can do",
 "scenes": [
  {
   "kind": "title",
   "icon": "settings",
   "title": "Your first day in **Admin**",
   "sub": "What you see, and what you can do.",
   "beats": [
    "This video is for new members of the Trothen team. It explains how Admin is organised, and what you can see and do."
   ]
  },
  {
   "kind": "list",
   "h": "The **menu** on the left",
   "items": [
    {
     "icon": "check",
     "t": "Each area is one job",
     "sub": "Approvals, verification, disputes, payments, and more."
    },
    {
     "icon": "lock",
     "t": "You see **only your areas**",
     "sub": "Your role decides which areas you can open."
    },
    {
     "icon": "pin",
     "t": "And **only your region**",
     "sub": "A city, a country, or everywhere."
    }
   ],
   "beats": [
    "On the left is the Admin menu.",
    "Each area is one job: approving people, checking IDs, deciding disputes, sending payouts, and more.",
    "You only see the areas your role allows. For example, the Verification Team sees verification, and Finance sees payments.",
    "And you only see people in your region: one city, one country, or everywhere, as your super admin decided."
   ]
  },
  {
   "kind": "table",
   "h": "The **roles**",
   "head": [
    "Role",
    "Can do"
   ],
   "rows": [
    {
     "c": [
      "Regional Admin",
      "Everything for their city or country"
     ]
    },
    {
     "c": [
      "Verification Team",
      "Identity checks"
     ]
    },
    {
     "c": [
      "Finance",
      "Money held, payouts, payment codes"
     ]
    },
    {
     "c": [
      "Customer Service",
      "Approvals, verification and disputes"
     ]
    },
    {
     "c": [
      "Legal",
      "Read disputes and transactions"
     ]
    },
    {
     "c": [
      "Custom",
      "Exactly the actions the super admin ticked"
     ],
     "b": 5
    }
   ],
   "beats": [
    "These are the roles.",
    "A Regional Admin can do everything for their city or country.",
    "The Verification Team checks identities.",
    "Finance handles money held by Trothen, payouts and payment codes.",
    "Customer Service handles approvals, verification and disputes.",
    "Legal can read disputes and transactions, without changing them. And a custom admin can do exactly the actions a super admin ticked for them."
   ]
  },
  {
   "kind": "warn",
   "h": "Your **duties**",
   "lines": [
    {
     "t": "Everything you open about a person is **written to the access log**."
    },
    {
     "t": "Never share what you see outside Trothen, and never ask anyone for a password or PIN."
    },
    {
     "ok": true,
     "icon": "eye",
     "t": "Help videos for each area are in **Admin → Help videos**."
    }
   ],
   "beats": [
    "Your duties.",
    "Everything you open about a person, like an ID or a payment, is written to the access log, with your name and the time.",
    "Never share what you see outside Trothen. And never ask anyone for their password or PIN.",
    "For each area, there is a help video like this one, in Admin, under Help videos."
   ]
  },
  {
   "kind": "end",
   "title": "Welcome to the **team**",
   "sub": "Start with the help video for your own area.",
   "beats": [
    "Welcome to the team. Start with the help video for your own area."
   ]
  }
 ]
};
