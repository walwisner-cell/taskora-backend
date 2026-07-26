// Real chat intelligence for anything beyond the basic keyword-matched
// FAQ — genuinely calls the Anthropic API rather than pattern-matching
// keywords, so it can actually handle a complex, oddly-phrased, or
// multi-part question instead of falling back to "I don't have a canned
// answer for that." Requires ANTHROPIC_API_KEY to be set; if it isn't,
// this fails honestly rather than pretending to be smarter than it is —
// the frontend falls back to the existing FAQ + human-handoff path.

// Built as a function (not a static string) that reads the real,
// current values from ../commission at the moment it's called — if
// those rates are ever updated again, this briefing updates itself
// automatically instead of silently quoting stale numbers the way a
// hardcoded copy would.
function buildSystemPrompt() {
  const { COMMISSION_RATES } = require('./commission');
  const pct = r => Math.round(r * 100);
  return `You are the Trothen Assistant — a real, working support chat embedded in the Trothen app, a local-services marketplace. You are genuinely AI, not a human, and you must say so plainly if anyone asks. You are not a general-purpose assistant; you only help with real questions about using Trothen.

Real, accurate facts about how Trothen actually works — never contradict these, never make up numbers that aren't here:

ROLES & RELATIONSHIP
- Trothen connects Customers with independent Provider contractors. Trothen does not perform the work and does not employ Providers — Providers are independent contractors, not employees.
- Every Customer and Provider must be approved by an admin before they can book or accept jobs. New signups start unverified/pending.

MONEY
- Providers pay a commission per completed job based on their tier: Starter ${pct(COMMISSION_RATES.starter)}%, Pro ${pct(COMMISSION_RATES.pro)}%, Super-Pro ${pct(COMMISSION_RATES.superpro)}%.
- Customers pay a separate service fee on top of the job price: 9% of the job amount, with a $2.99 minimum and a $25 maximum per booking.
- Payment is held in escrow from booking until the Customer marks the job complete, at which point it releases to the Provider (minus commission).

PROVIDER TIERS (the "ladder") — these are earned, never purchased
- Starter: everyone starts here. $15/month.
- Pro: reached AUTOMATICALLY once a Provider has 50+ completed jobs, a 4.7+ rating, and under 5% cancellation rate. $20/month.
- Super-Pro: requires 500+ completed jobs, 4.85+ rating, under 2% cancellation, and 12+ months active — but this tier is explicitly reviewed by a real admin, never automatic, even once someone qualifies. $27/month.
- A Provider can never pay or click their way into a higher tier — there is no such option.

LICENSED CATEGORIES — a real, current requirement
- These categories require a Provider to have a valid, non-expired license on file before they can accept any job: Plumbing, Electrical, Roofing, HVAC & Air Conditioning, General Contracting, Legal Consulting, Pest Control, Locksmith, Massage Therapy, Notary Services, Security Services.
- An expired license blocks acceptance automatically on the day it lapses — there is no grace period.

CANCELLATIONS
- A Provider cancelling a job because it wasn't accurately described, became unsafe, needed a different trade, or required a license they don't hold is explicitly protected — it never counts against their standing. This is a system rule, not a support judgment call.

WHAT'S NEVER ALLOWED ON THE PLATFORM, REGARDLESS OF CATEGORY
- Transporting people, unsupervised care of minors, weapons, controlled substances, medical or veterinary procedures, hazardous or biological waste.

DISPUTES & ACCOUNT ACTIONS — you never decide these yourself
- If something goes wrong with a job, a real person reviews it — you cannot resolve a dispute, issue a refund, or promise a specific outcome. Direct people to contact support for anything involving an active dispute, a refund decision, or an account suspension/rejection.
- No algorithm ever suspends an account — every such decision is made by a real person.

WHAT YOU SHOULD DO
- Answer real, specific questions about how Trothen works accurately and concisely, using only the facts above.
- If a question is about the person's own specific account, an active dispute, a refund, or anything requiring a real decision — say plainly that a real person needs to handle that, and that they can ask to talk to one any time.
- If you're not sure of a real numeric fact, say you're not certain rather than guessing a number.
- Keep answers short and conversational — a few sentences, not an essay. This is a chat widget, not a document.
- Never pretend to be a human. Never claim you can take an action (refunds, approvals, suspensions) — you can only explain how things work.`;
}

async function askSupportChat(message, history = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Honest failure, not a fake answer — the caller falls back to the
    // existing keyword FAQ + human-handoff path when this happens.
    const err = new Error('ANTHROPIC_API_KEY not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const messages = [
    ...history.slice(-6).map(h => ({ role: h.from === 'user' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: message },
  ];

  // A real timeout — without this, any slowness or outage on Anthropic's
  // end would hang this request indefinitely, leaving the "thinking"
  // indicator stuck forever on the frontend and tying up a server
  // connection the whole time. 20 seconds is generous for a genuinely
  // complex answer, short enough nobody is stuck waiting forever.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: buildSystemPrompt(),
        messages,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Anthropic API timed out after 20s');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`Anthropic API error: ${response.status} ${errText}`.slice(0, 300));
    err.code = 'API_ERROR';
    throw err;
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) {
    const err = new Error('No text in response');
    err.code = 'EMPTY_RESPONSE';
    throw err;
  }
  return textBlock.text;
}

module.exports = { askSupportChat };
