// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-rides",
 "flow": "fares",
 "section": "rides",
 "area": "Rides",
 "title": "Rides: drivers, safety and fares",
 "tagline": "Approve drivers, watch safety alerts, and set fares",
 "scenes": [
  {
   "kind": "title",
   "icon": "bike",
   "title": "Rides: **drivers**, **safety** and **fares**",
   "sub": "Approve drivers, watch safety alerts, and set fares.",
   "beats": [
    "This video explains the Rides area: approving drivers, watching safety alerts, and the settings for fares and countries."
   ]
  },
  {
   "kind": "list",
   "h": "**Approve** drivers",
   "items": [
    {
     "icon": "doc",
     "t": "Check the licence and vehicle papers",
     "sub": "The list depends on the country and vehicle."
    },
    {
     "icon": "camera",
     "t": "The vehicle photos match the papers"
    },
    {
     "icon": "check",
     "t": "Approve, or ask for what is missing"
    }
   ],
   "beats": [
    "No ride can happen in a country until you approve a driver there.",
    "Check the licence and the vehicle papers. The list depends on the country and the vehicle.",
    "Check that the vehicle photos match the papers.",
    "Then approve the driver, or ask for what is missing."
   ]
  },
  {
   "kind": "warn",
   "h": "**Safety** alerts",
   "lines": [
    {
     "t": "An SOS from a rider or driver comes here, with where they are."
    },
    {
     "ok": true,
     "icon": "call",
     "t": "Act at once: call them, and the police if needed."
    }
   ],
   "beats": [
    "Safety alerts.",
    "When a rider or a driver presses SOS, the alert comes here, with where they are.",
    "Act at once. Call them, and call the police if needed."
   ]
  },
  {
   "kind": "list",
   "h": "**Settings**: super admin only",
   "items": [
    {
     "icon": "globe",
     "t": "Rides on or off, per country"
    },
    {
     "icon": "money",
     "t": "Fares per vehicle, in the country's money"
    },
    {
     "icon": "star",
     "t": "Driver Pass prices"
    },
    {
     "icon": "doc",
     "t": "The papers drivers must upload"
    }
   ],
   "beats": [
    "The settings are for a super admin only.",
    "Turn rides on or off for each live country, only after checking the local transport rules.",
    "Set fares per vehicle, in the country's own money.",
    "Set the Driver Pass prices.",
    "And the papers drivers must upload. Ask a lawyer or the Ministry of Transport which papers are legally required."
   ]
  },
  {
   "kind": "end",
   "title": "Safe **rides**",
   "sub": "Watch the step-by-step video on fares too.",
   "beats": [
    "For the exact clicks on fares, watch the step-by-step video on the real screens."
   ]
  }
 ]
};
