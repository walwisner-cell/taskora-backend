// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-messages",
 "flow": "messages",
 "section": "contact-submissions",
 "sections": ["contact-submissions","careers"],
 "area": "Contact, Careers",
 "title": "Messages from the website",
 "tagline": "Contact Us messages and job applications",
 "scenes": [
  {
   "kind": "title",
   "icon": "chat",
   "title": "Messages from the **website**",
   "sub": "Contact Us messages and job applications.",
   "beats": [
    "This video explains two lists of messages that come from the Trothen website: Contact Us messages, and job applications from the Careers page."
   ]
  },
  {
   "kind": "list",
   "h": "**Contact Us** messages",
   "items": [
    {
     "icon": "chat",
     "t": "Questions and requests from the public"
    },
    {
     "icon": "pin",
     "t": "Sent to the admin for that city"
    },
    {
     "icon": "doc",
     "t": "Reply by email, then mark it done"
    }
   ],
   "beats": [
    "Contact Us messages are questions and requests from the public.",
    "They go to the admin for that city, or to everyone if no one covers it.",
    "Reply by email, then change the status, so the team knows it is done."
   ],
   "from": 0
  },
  {
   "kind": "list",
   "h": "**Job applications**",
   "items": [
    {
     "icon": "doc",
     "t": "From the Careers page"
    },
    {
     "icon": "users",
     "t": "Seen by the HR team"
    },
    {
     "icon": "check",
     "t": "Change the status as you go"
    }
   ],
   "beats": [
    "Job applications come from the Careers page.",
    "They are seen by the HR team.",
    "Change the status as you go: new, being reviewed, and done."
   ],
   "from": 0
  },
  {
   "kind": "warn",
   "h": "**Personal** information",
   "lines": [
    {
     "t": "Applications and messages contain people's personal details.",
     "b": 0
    },
    {
     "ok": true,
     "icon": "lock",
     "t": "Never share them outside the team.",
     "b": 1
    }
   ],
   "beats": [
    "Remember: these messages contain people's personal details.",
    "Never share them outside the team."
   ]
  },
  {
   "kind": "end",
   "title": "Every message **answered**",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Answer every message, even with a short reply."
   ]
  }
 ]
};
