// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-locations",
 "flow": "locations",
 "section": "locations",
 "sections": ["locations","accesslogs","myteam"],
 "area": "Locations & Admins",
 "title": "Admins and their access",
 "tagline": "Add team members, choose their role and area",
 "scenes": [
  {
   "kind": "title",
   "icon": "team",
   "title": "Admins and their **access**",
   "sub": "Add team members, choose their role and area.",
   "beats": [
    "This video is for super admins and team managers. It explains Locations and Admins: adding team members, and choosing what they can see and do."
   ]
  },
  {
   "kind": "list",
   "h": "Add a **team member**",
   "items": [
    {
     "icon": "user",
     "t": "Name, email, and a temporary password",
     "sub": "They set their own at first sign-in."
    },
    {
     "icon": "pin",
     "t": "Their city"
    },
    {
     "icon": "settings",
     "t": "Their role",
     "sub": "Regional Admin, Verification, Finance, Customer Service, Legal, Sales, HR, or Custom."
    },
    {
     "icon": "globe",
     "t": "What they cover",
     "sub": "The whole country (recommended), or one city."
    }
   ],
   "beats": [
    "To add a team member, type their name, their email, and a temporary password. They set their own when they first sign in.",
    "Choose their city.",
    "Choose their role: Regional Admin, Verification, Finance, Customer Service, Legal, Sales, HR, or Custom.",
    "And what they cover: the whole country, which we recommend, or only one city. One city only finds people who typed the city exactly the same way."
   ],
   "from": 0
  },
  {
   "kind": "warn",
   "h": "Give **only** what is needed",
   "lines": [
    {
     "t": "Team roles see every country, unless you limit them to the area."
    },
    {
     "ok": true,
     "icon": "settings",
     "t": "**Custom**: tick exactly the actions a person may do."
    },
    {
     "ok": true,
     "icon": "eye",
     "t": "**Access Logs** show who viewed sensitive data, and when."
    }
   ],
   "beats": [
    "Give only what is needed.",
    "Team roles like Finance see every country, unless you tick the box to limit them to the area.",
    "With Custom, you tick exactly the actions a person may do, in each area.",
    "And Access Logs show which administrator viewed sensitive data, and when. Check them regularly."
   ]
  },
  {
   "kind": "list",
   "h": "When someone **leaves**",
   "items": [
    {
     "icon": "pause",
     "t": "Turn their account off **the same day**"
    },
    {
     "icon": "team",
     "t": "A team manager can add and suspend people in their team"
    }
   ],
   "beats": [
    "When someone leaves the team, turn their admin account off the same day.",
    "A team manager can add people to their team, and suspend them."
   ],
   "from": 0
  },
  {
   "kind": "end",
   "title": "The right **access**",
   "sub": "Stuck? Ask your super admin.",
   "beats": [
    "The right people, with the right access, and nothing more."
   ]
  }
 ]
};
