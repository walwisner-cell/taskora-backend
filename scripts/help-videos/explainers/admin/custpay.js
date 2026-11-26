// Animated explainer for the Trothen team (Admin only, never on the public site).
module.exports = {
 "key": "adm-custpay",
 "flow": "custpay",
 "section": "custpay",
 "area": "Customer Payments",
 "title": "Payment codes from customers",
 "tagline": "Confirm what arrived, and send refunds back",
 "scenes": [
  {
   "kind": "title",
   "icon": "key",
   "title": "Payment **codes** from customers",
   "sub": "Confirm what arrived, and send refunds back.",
   "beats": [
    "This video is for Finance. It explains Customer Payments: bookings paid by Mobile Money with a payment code."
   ]
  },
  {
   "kind": "flow",
   "h": "How a **code** payment works",
   "nodes": [
    {
     "icon": "key",
     "t": "The customer gets a code",
     "sub": "and Trothen's number"
    },
    {
     "icon": "phone",
     "t": "They send the money",
     "sub": "with the code in the reference",
     "tone": "gold"
    },
    {
     "icon": "check",
     "t": "You confirm it",
     "sub": "then the pro is asked"
    }
   ],
   "foot": "Only after you confirm is the pro asked to confirm the booking.",
   "footAt": 3,
   "beats": [
    "How does a code payment work?",
    "When a customer books, they get a one-time code and Trothen's number.",
    "They send exactly the amount, with the code in the reference, and press I have sent it.",
    "You find the payment on Trothen's statement, and confirm it.",
    "Only after you confirm is the pro asked to confirm the booking."
   ]
  },
  {
   "kind": "table",
   "h": "**Each** payment",
   "head": [
    "What you see",
    "What to do"
   ],
   "rows": [
    {
     "c": [
      "Customer says paid: check it",
      "Find it on the statement. The code must match."
     ]
    },
    {
     "c": [
      "The right amount arrived",
      "Confirm payment"
     ]
    },
    {
     "c": [
      "Nothing arrived",
      "No payment found: cancel booking"
     ]
    }
   ],
   "beats": [
    "For each payment.",
    "When the customer says they paid, find it on Trothen's statement. The code in the reference must match.",
    "If the right amount arrived, tap Confirm payment.",
    "If nothing arrived, tap No payment found. The booking is cancelled, and the customer is told."
   ]
  },
  {
   "kind": "list",
   "h": "**Refunds** to send",
   "items": [
    {
     "icon": "refresh",
     "t": "Refunds due to code payments are listed"
    },
    {
     "icon": "phone",
     "t": "Send to the **number they paid from**"
    },
    {
     "icon": "check",
     "t": "Then mark it sent"
    }
   ],
   "beats": [
    "Below are the refunds due to customers who paid by code.",
    "Send the money back to the number they paid from.",
    "Then mark it sent."
   ],
   "from": 0
  },
  {
   "kind": "end",
   "title": "Money **confirmed**",
   "sub": "Never confirm a payment you have not seen arrive.",
   "beats": [
    "Never confirm a payment you have not seen arrive on the statement."
   ]
  }
 ]
};
