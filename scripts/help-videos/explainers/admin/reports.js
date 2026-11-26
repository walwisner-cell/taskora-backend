// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-reports",
 "flow": "reports",
 "section": "reports",
 "sections": ["reports","referrals"],
 "area": "Reports & Referrals",
 "title": "Reports and referrals",
 "tagline": "Where demand is, how pros perform, and who invites others",
 "scenes": [
  {
   "kind": "title",
   "icon": "chart",
   "title": "**Reports** and **referrals**",
   "sub": "Where demand is, how pros perform, and who invites others.",
   "beats": [
    "This video explains Reports and Referrals: where customers need work, how each kind of work performs, and who is inviting new people."
   ]
  },
  {
   "kind": "list",
   "h": "**Reports**",
   "items": [
    {
     "icon": "chart",
     "t": "Demand: jobs **booked** in each kind of work"
    },
    {
     "icon": "calendar",
     "t": "The last 30 days, day by day"
    },
    {
     "icon": "warning",
     "t": "Where customers waited with **no pro**",
     "tone": "bad"
    },
    {
     "icon": "star",
     "t": "The top pros"
    }
   ],
   "beats": [
    "Reports show demand: how many jobs were booked in each kind of work.",
    "The last 30 days, day by day.",
    "Where customers posted a job and no pro was found. This tells you where to find more pros.",
    "And the top pros."
   ],
   "from": 0
  },
  {
   "kind": "list",
   "h": "**Referrals**",
   "items": [
    {
     "icon": "users",
     "t": "Who invited others"
    },
    {
     "icon": "check",
     "t": "Sign-ups through each person's link"
    }
   ],
   "beats": [
    "Referrals show who invited others to Trothen,",
    "and the sign-ups that came through each person's link."
   ],
   "from": 0
  },
  {
   "kind": "end",
   "title": "Decisions from **facts**",
   "sub": "Stuck? Ask your manager.",
   "beats": [
    "Use these numbers to decide where to find pros, and what to promote."
   ]
  }
 ]
};
