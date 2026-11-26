// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-approvals",
 "flow": "approvals",
 "section": "approvals",
 "area": "User Approvals",
 "title": "Approve new people",
 "tagline": "Check new sign-ups before they go live",
 "scenes": [
  {
   "kind": "title",
   "icon": "users",
   "title": "Approve **new people**",
   "sub": "Check new sign-ups before they go live.",
   "beats": [
    "This video explains User Approvals: where new sign-ups wait before they can use Trothen fully."
   ]
  },
  {
   "kind": "flow",
   "h": "What **approval** means",
   "nodes": [
    {
     "icon": "user",
     "t": "Someone signs up",
     "sub": "a customer or a pro"
    },
    {
     "icon": "eye",
     "t": "You check the account",
     "sub": "name, place, kind of work",
     "tone": "gold"
    },
    {
     "icon": "check",
     "t": "Approve or reject",
     "sub": "they are told"
    }
   ],
   "foot": "For a pro, approval is **not** enough to be found: their ID must also be approved, and they need a profile photo.",
   "footAt": 3,
   "beats": [
    "What does approval mean?",
    "Someone signs up, as a customer or a pro.",
    "You check the account: does the name look real, is the place right, and for a pro, is the kind of work right?",
    "Then approve, or reject. They are told.",
    "For a pro, approval is not enough to be found by customers. Their ID must also be approved in the Verification Queue, and they need a profile photo."
   ]
  },
  {
   "kind": "list",
   "h": "Signs to **look** for",
   "items": [
    {
     "icon": "warning",
     "t": "A name like \"asdf\", or a business name for a person",
     "tone": "bad"
    },
    {
     "icon": "warning",
     "t": "A place that does not match the phone number's country",
     "tone": "bad"
    },
    {
     "icon": "warning",
     "t": "The same phone or email as another account",
     "tone": "bad"
    },
    {
     "icon": "chat",
     "t": "Not sure? Message them, or ask your manager"
    }
   ],
   "beats": [
    "Signs to look for.",
    "A name that is not a real name, like random letters.",
    "A place that does not match the phone number's country.",
    "The same phone number or email as another account.",
    "Not sure? Message the person in Trothen, or ask your manager, before you decide."
   ]
  },
  {
   "kind": "end",
   "title": "Fair and **careful**",
   "sub": "Reject with a clear reason, so the person can fix it.",
   "beats": [
    "Always give a clear reason when you reject, so the person can fix it and try again."
   ]
  }
 ]
};
