// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-golive",
 "flow": "golive",
 "section": "golive",
 "sections": ["golive","datacleanup"],
 "area": "Go-Live & Data Cleanup",
 "title": "Go-Live and data cleanup",
 "tagline": "Launch for real, and remove test accounts safely",
 "scenes": [
  {
   "kind": "title",
   "icon": "flag",
   "title": "**Go-Live** and data cleanup",
   "sub": "Launch for real, and remove test accounts safely.",
   "beats": [
    "This video is for super admins. It explains Go-Live, the checklist before real people use Trothen, and Data Cleanup."
   ]
  },
  {
   "kind": "timeline",
   "h": "**Go-Live**, step by step",
   "points": [
    {
     "icon": "check",
     "t": "Test the email",
     "sub": "codes and resets"
    },
    {
     "icon": "user",
     "t": "Create your super admin",
     "sub": "with your own email"
    },
    {
     "icon": "x",
     "t": "Remove the demo data",
     "sub": "preview first"
    },
    {
     "icon": "globe",
     "t": "Choose your countries",
     "sub": "only these show"
    }
   ],
   "beats": [
    "Go-Live, step by step.",
    "First, send yourself a test email. Sign-in codes and password resets go by email, so check it works.",
    "Step one: create your super admin account, with your own email.",
    "Step two: remove all the demo data. Preview what will be removed first.",
    "Step three: choose the countries you serve. Only these appear on the home page and at sign-up."
   ]
  },
  {
   "kind": "warn",
   "h": "**Data cleanup**",
   "lines": [
    {
     "t": "Removes unused **test** accounts in a country.",
     "b": 0
    },
    {
     "ok": true,
     "icon": "lock",
     "t": "Accounts with any booking, payment or dispute are **never** removed.",
     "b": 1
    },
    {
     "ok": true,
     "icon": "eye",
     "t": "Always preview, then tick what to remove.",
     "b": 2
    }
   ],
   "beats": [
    "Data Cleanup removes unused test accounts in a country.",
    "Accounts with any booking, payment, or dispute history are never removed.",
    "Always preview first, then tick exactly what to remove. Every cleanup is logged."
   ]
  },
  {
   "kind": "end",
   "title": "Launch **safely**",
   "sub": "Only a super admin can do these.",
   "beats": [
    "Only a super admin can do these. Take it one step at a time."
   ]
  }
 ]
};
