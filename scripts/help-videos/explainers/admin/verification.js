// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-verification",
 "flow": "verification",
 "section": "verification",
 "area": "Verification Queue",
 "title": "Check IDs and guarantors",
 "tagline": "Approve identities, chase missing IDs, and call guarantors",
 "scenes": [
  {
   "kind": "title",
   "icon": "id",
   "title": "Check **IDs** and **guarantors**",
   "sub": "Approve identities, chase missing IDs, and call guarantors.",
   "beats": [
    "This video explains the Verification Queue: checking people's IDs, chasing people who have not sent one, and calling pros' guarantors."
   ]
  },
  {
   "kind": "list",
   "h": "Check each **ID**",
   "items": [
    {
     "icon": "id",
     "t": "The name matches the account",
     "sub": "Spelling may differ slightly; the person must not."
    },
    {
     "icon": "user",
     "t": "The face photo matches the ID photo"
    },
    {
     "icon": "eye",
     "t": "The document is real and readable",
     "sub": "Not a screenshot, not a photo of a screen."
    },
    {
     "icon": "clock",
     "t": "Not expired"
    }
   ],
   "beats": [
    "For each ID in the queue, check four things.",
    "The name on the ID matches the account. Small spelling differences are fine; a different person is not.",
    "The face photo matches the photo on the ID.",
    "The document is real and readable. Not a screenshot, and not a photo of a screen.",
    "And the document has not expired."
   ]
  },
  {
   "kind": "table",
   "h": "Then **decide**",
   "head": [
    "Decision",
    "When"
   ],
   "rows": [
    {
     "c": [
      "Approve",
      "All four checks pass"
     ]
    },
    {
     "c": [
      "Reject, with a reason",
      "Something is wrong. Say exactly what to fix: \"the back is blurred\""
     ]
    }
   ],
   "beats": [
    "Then decide.",
    "Approve, when all four checks pass. The person can then book, or be found by customers.",
    "Reject, when something is wrong, and say exactly what to fix, like: the back of the ID is blurred. They are told, and can send it again."
   ]
  },
  {
   "kind": "list",
   "h": "**Not verified yet**: chase them",
   "items": [
    {
     "icon": "bell",
     "t": "People with no ID sent, or one turned down",
     "sub": "Use **Remind** to nudge them."
    },
    {
     "icon": "warning",
     "t": "\"Verified\" with no approved ID",
     "sub": "Old accounts. Ask everyone on this list for their ID.",
     "tone": "bad"
    }
   ],
   "beats": [
    "Below the queue are people who are not verified yet: they never sent an ID, or theirs was turned down. Tap Remind to nudge them.",
    "There is also a list of accounts marked verified without an approved ID on file. These are old accounts. Ask everyone on that list for their ID."
   ],
   "from": 0
  },
  {
   "kind": "list",
   "h": "**Guarantors** to call",
   "items": [
    {
     "icon": "call",
     "t": "Call each guarantor",
     "sub": "Is the person real, and do they know the pro?"
    },
    {
     "icon": "check",
     "t": "Mark confirmed, or not"
    },
    {
     "icon": "x",
     "t": "Same phone or name as the pro? Not valid",
     "tone": "bad"
    }
   ],
   "beats": [
    "Pros add guarantors: people who vouch for them. They take the place of a background check.",
    "Call each guarantor. Ask if they know the pro, and how.",
    "Then mark them confirmed, or not. Confirmed guarantors raise the pro's Trothen Score.",
    "A guarantor with the pro's own phone number or name is not valid. Trothen flags these for you."
   ]
  },
  {
   "kind": "warn",
   "h": "ID photos are **private**",
   "lines": [
    {
     "t": "Never download, copy or share ID photos."
    },
    {
     "ok": true,
     "icon": "lock",
     "t": "Every document you open is in the access log."
    },
    {
     "ok": true,
     "icon": "clock",
     "t": "ID files are deleted by themselves after a while."
    }
   ],
   "beats": [
    "ID photos are private.",
    "Never download, copy or share them.",
    "Every document you open is written to the access log.",
    "And ID files are deleted by themselves some time after the decision. Past checks stay listed, without the photos."
   ]
  },
  {
   "kind": "end",
   "title": "Trust starts **here**",
   "sub": "Every customer and pro on Trothen passed this check.",
   "beats": [
    "Every customer and pro on Trothen passed your check. Take your time, and be fair."
   ]
  }
 ]
};
