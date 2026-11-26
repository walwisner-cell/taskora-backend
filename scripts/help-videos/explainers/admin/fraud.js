// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-fraud",
 "flow": "fraud",
 "section": "fraud",
 "area": "Fraud & Safety",
 "title": "Fraud and safety flags",
 "tagline": "What the automatic checks catch, and what to do",
 "scenes": [
  {
   "kind": "title",
   "icon": "shield",
   "title": "**Fraud** and **safety** flags",
   "sub": "What the automatic checks catch, and what to do.",
   "beats": [
    "This video explains Fraud and Safety: flags raised automatically when something looks wrong, and what to do with them."
   ]
  },
  {
   "kind": "list",
   "h": "What gets **flagged**",
   "items": [
    {
     "icon": "users",
     "t": "Two accounts with the same phone, booking each other"
    },
    {
     "icon": "money",
     "t": "Many purchases in a day"
    },
    {
     "icon": "chat",
     "t": "Messages asking to pay outside Trothen"
    },
    {
     "icon": "x",
     "t": "A host who cancels often",
     "sub": "3 times in 90 days."
    }
   ],
   "beats": [
    "Trothen screens sign-ups, bookings and messages automatically. Here are examples of what gets flagged.",
    "Two accounts with the same phone number, booking each other.",
    "Unusually many purchases in one day.",
    "Messages asking to pay outside Trothen.",
    "A host who cancels three times in 90 days."
   ]
  },
  {
   "kind": "flow",
   "h": "What to **do**",
   "nodes": [
    {
     "icon": "eye",
     "t": "Look at the flag",
     "sub": "and the account"
    },
    {
     "icon": "call",
     "t": "Talk to the person",
     "sub": "if needed",
     "tone": "gold"
    },
    {
     "icon": "check",
     "t": "Resolve it",
     "sub": "with a note"
    }
   ],
   "foot": "A flag **never** suspends anyone by itself. A person decides.",
   "footAt": 3,
   "beats": [
    "What do you do?",
    "Look at the flag, and the account behind it.",
    "Talk to the person, if you need to.",
    "Then resolve the flag, with a note saying what you found and did.",
    "A flag never suspends anyone by itself. A person always decides."
   ]
  },
  {
   "kind": "end",
   "title": "Keep Trothen **safe**",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Most flags are innocent. Some are not. Look carefully, and write what you found."
   ]
  }
 ]
};
