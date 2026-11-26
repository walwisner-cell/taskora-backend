// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-systemcheck",
 "flow": "systemcheck",
 "section": "systemcheck",
 "area": "System Check",
 "title": "System Check",
 "tagline": "What needs attention right now, and what to do",
 "scenes": [
  {
   "kind": "title",
   "icon": "bolt",
   "title": "**System Check**",
   "sub": "What needs attention right now, and what to do.",
   "beats": [
    "This video explains System Check: Trothen watching itself, and telling you when something needs attention."
   ]
  },
  {
   "kind": "list",
   "h": "What it **checks**",
   "items": [
    {
     "icon": "doc",
     "t": "Emails are going out"
    },
    {
     "icon": "wallet",
     "t": "Payments waiting for Finance"
    },
    {
     "icon": "refresh",
     "t": "Refunds and payouts not sent"
    },
    {
     "icon": "clock",
     "t": "Every 15 minutes, or when you press **Check now**"
    }
   ],
   "beats": [
    "System Check looks at the live system.",
    "Are emails going out?",
    "Are payments waiting for Finance?",
    "Are refunds or payouts waiting to be sent?",
    "It checks by itself every 15 minutes, or when you press Check now."
   ]
  },
  {
   "kind": "flow",
   "h": "When something is **wrong**",
   "nodes": [
    {
     "icon": "bell",
     "t": "You are alerted"
    },
    {
     "icon": "eye",
     "t": "It says the likely cause",
     "tone": "gold"
    },
    {
     "icon": "wrench",
     "t": "And what to do"
    }
   ],
   "foot": "Fix the cause, then press **Check now** to confirm.",
   "footAt": 3,
   "beats": [
    "When something is wrong.",
    "You are alerted.",
    "It shows the likely cause.",
    "And what to do about it.",
    "Fix the cause, then press Check now, to confirm it is fixed."
   ]
  },
  {
   "kind": "end",
   "title": "A healthy **Trothen**",
   "sub": "Watch the step-by-step video too.",
   "beats": [
    "For the exact clicks, watch the step-by-step video on the real screens."
   ]
  }
 ]
};
