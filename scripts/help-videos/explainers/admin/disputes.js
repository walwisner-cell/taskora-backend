// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-disputes",
 "flow": "disputes",
 "section": "disputes",
 "area": "Disputes",
 "title": "Decide disputes fairly",
 "tagline": "Read both sides, then refund, release or split",
 "scenes": [
  {
   "kind": "title",
   "icon": "flag",
   "title": "Decide **disputes** fairly",
   "sub": "Read both sides, then refund, release or split.",
   "beats": [
    "This video explains Disputes: what to do when a customer and a pro, a buyer and a seller, or a guest and a host disagree about money."
   ]
  },
  {
   "kind": "flow",
   "h": "While a dispute is **open**",
   "nodes": [
    {
     "icon": "flag",
     "t": "Someone reports a problem",
     "sub": "before the money is released"
    },
    {
     "icon": "shield",
     "t": "The money stays **held**",
     "sub": "nobody gets it",
     "tone": "gold"
    },
    {
     "icon": "eye",
     "t": "You decide",
     "sub": "with a written reason"
    }
   ],
   "foot": "Both people see your decision and your reason.",
   "footAt": 3,
   "beats": [
    "While a dispute is open.",
    "Someone reports a problem, before the money was released.",
    "The money stays held. Nobody gets it until you decide.",
    "You decide, and write the reason.",
    "Both people see your decision, and your reason."
   ]
  },
  {
   "kind": "list",
   "h": "**Read** everything first",
   "items": [
    {
     "icon": "chat",
     "t": "Their messages in Trothen",
     "sub": "What was agreed."
    },
    {
     "icon": "photo",
     "t": "The photos and evidence"
    },
    {
     "icon": "map",
     "t": "Times and places",
     "sub": "Leave Now, Arrived, handover photos."
    },
    {
     "icon": "call",
     "t": "Call both sides if needed"
    }
   ],
   "beats": [
    "Read everything first.",
    "Their messages in Trothen: what was agreed.",
    "The photos and evidence each side sent.",
    "The times and places Trothen recorded: when the pro left and arrived, and the handover photos for deliveries.",
    "And call both sides if you need to."
   ]
  },
  {
   "kind": "table",
   "h": "Your **decision**",
   "head": [
    "Decision",
    "When"
   ],
   "rows": [
    {
     "c": [
      "Refund the customer",
      "The work was not done, or not as agreed"
     ]
    },
    {
     "c": [
      "Release to the pro",
      "The work was done as agreed"
     ]
    },
    {
     "c": [
      "Split",
      "Part was done: refund part, release the rest"
     ]
    }
   ],
   "beats": [
    "Then decide one of three things.",
    "Refund the customer, when the work was not done, or not as agreed.",
    "Release to the pro, when the work was done as agreed.",
    "Or split: part goes back to the customer, and the rest to the pro."
   ]
  },
  {
   "kind": "warn",
   "h": "Good to **know**",
   "lines": [
    {
     "t": "On a **cash** job, Trothen holds no money: decide for one side, and explain."
    },
    {
     "ok": true,
     "icon": "doc",
     "t": "Download the list as a PDF for your records."
    },
    {
     "ok": true,
     "icon": "lock",
     "t": "Every decision is in the audit log."
    }
   ],
   "beats": [
    "Good to know.",
    "On a cash job, Trothen holds no money, so there is nothing to split. Decide for one side, and explain in the note.",
    "You can download the list of disputes as a PDF.",
    "Every decision is kept in the audit log."
   ]
  },
  {
   "kind": "end",
   "title": "Fair to **both** sides",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Read, listen, then decide. Be fair to both sides."
   ]
  }
 ]
};
