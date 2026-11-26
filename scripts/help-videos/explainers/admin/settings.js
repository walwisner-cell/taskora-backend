// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-settings",
 "flow": "settings",
 "section": "settings",
 "area": "Settings",
 "title": "Admin settings",
 "tagline": "Support numbers, booking answer time, wording and backups",
 "scenes": [
  {
   "kind": "title",
   "icon": "settings",
   "title": "Admin **settings**",
   "sub": "Support numbers, booking answer time, wording and backups.",
   "beats": [
    "This video explains the Admin settings: the things that change how Trothen works for everyone in your area."
   ]
  },
  {
   "kind": "list",
   "h": "**Support** numbers",
   "items": [
    {
     "icon": "call",
     "t": "Your city's WhatsApp and phone number",
     "sub": "Shown in \"Chat with us\" and \"Call\"."
    },
    {
     "icon": "globe",
     "t": "Otherwise, the platform-wide number"
    }
   ],
   "beats": [
    "Support numbers.",
    "Set your city's WhatsApp and phone number. People in your city see it in Chat with us, and Call.",
    "If you set none, they see the platform-wide number."
   ]
  },
  {
   "kind": "list",
   "h": "**Booking** answer time",
   "items": [
    {
     "icon": "clock",
     "t": "How long a pro has to accept a new booking"
    },
    {
     "icon": "calendar",
     "t": "Shorter when the job is soon"
    },
    {
     "icon": "refresh",
     "t": "No answer: cancelled, and the customer refunded"
    }
   ],
   "beats": [
    "The booking answer time.",
    "How long a pro has to accept or decline a new booking.",
    "It is shorter when the job is soon.",
    "If the pro does not answer in time, the booking is cancelled, and the customer refunded. Changes apply to new bookings only."
   ]
  },
  {
   "kind": "list",
   "h": "For a **super admin**",
   "items": [
    {
     "icon": "doc",
     "t": "The getting-started guide (a PDF)"
    },
    {
     "icon": "doc",
     "t": "The wording of the app, and the privacy notice"
    },
    {
     "icon": "lock",
     "t": "How long people stay signed in"
    },
    {
     "icon": "box",
     "t": "Nightly **backups**"
    }
   ],
   "beats": [
    "A super admin also manages:",
    "the getting-started guide, a PDF offered to every new customer and pro,",
    "the wording of the app, and the privacy notice,",
    "how long people stay signed in,",
    "and the nightly backups of Trothen's records."
   ]
  },
  {
   "kind": "end",
   "title": "Settings that **matter**",
   "sub": "Stuck? Ask your super admin.",
   "beats": [
    "Change settings carefully. They affect everyone in your area."
   ]
  }
 ]
};
