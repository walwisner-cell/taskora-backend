// v185: the detailed videos for the Admin team, one for each part of Admin.
// Each is recorded on the real screens (a laptop) with demo cases (scripts/help-videos/demo.js),
// in chapters the viewer can jump to. They go with the manual of the same name
// (help-admin/manuals/<key>.md) and say the same things.
'use strict';

const open = (d, label) => d.tap(`.dash-nav-item:has-text("${label}")`, `Open ${label}, in the menu on the left.`);

module.exports = [
  {
    key: 'verification', group: 'admin', section: 'verification', as: 'u_superadmin', title: 'Verification Queue: check an ID, step by step', tagline: 'Real, not expired, readable, same name, same face: then approve, or reject with a clear reason',
    async steps(d) {
      await d.chapter('Why this check matters');
      await d.say('Every customer and pro proves who they are, with an ID and a face photo. A person on the team checks each one, here.', 3600);
      await d.say('When you approve an ID, the person becomes Verified. Customers let pros into their homes because of this check.', 3600);
      await d.say('If you are not sure, do not approve. Reject with a clear reason, and the person can send a better photo.', 3400);
      await open(d, 'Verification Queue');

      await d.chapter('The queue');
      await d.show(':text("Chioma Kollie")', 'Each row is one ID waiting. Work oldest first, and anything overdue before the rest.', 3200);
      await d.show(':text("Matches account")', 'Trothen compares the name on the ID with the name on the account. Green means they match.', 3400);
      await d.show(':text("Doesn\'t match account")', 'Red means they don\'t. Those are marked Needs review. Look at them very carefully.', 3400);
      await d.show(':text("Overdue")', 'Each ID should be checked within 48 hours. Past that, it shows Overdue.', 3000);

      await d.chapter('Look at the documents');
      await d.tap('button[onclick*="viewVerificationDocument(\'ver_film_chioma\')"]', 'Click View documents. Every file you open is written in the Access Logs.');
      await d.show('#id-viewer-document', 'The front of the ID. Is it a real ID, of the type chosen? Not a screen, a printout, or a picture from the internet?', 4200);
      await d.say('Read the expiry date. It must not be expired. And the photo, the name, the date and the number must be clear.', 3800);
      await d.show('#id-viewer-back', 'The back of the ID, when there is one.', 2600);
      await d.show('#id-viewer-selfie', 'The face photo. Is it the same person as the photo on the ID? Look at the face, not the hair or glasses.', 4000);
      await d.say('Is it a live photo of a real person? Not a photo of a photo, a screen, or the ID itself.', 3200);
      await d.say('Signs of a false ID: the letters look wrong, the photo looks pasted on, blurred edges around the name or dates.', 3800);
      await d.run(() => closeIdViewer());

      await d.chapter('Approve');
      await d.say('Here, everything is right: a real ID, not expired, clear, the same name, and the same face.', 3200);
      await d.tap('button[onclick*="adminDecide(\'verification\',\'ver_film_chioma\',\'approve\'"]', 'Click Approve. Chioma becomes Verified at once, and is told.');

      await d.chapter('Reject, with a reason the person can act on');
      await d.tap('button[onclick*="viewVerificationDocument(\'ver_film_ama\')"]', 'This ID has a different name, and the expiry date has passed. Open it.');
      await d.show('#id-viewer-document', 'The ID expired in March 2024. It can\'t be approved.', 3000);
      await d.run(() => closeIdViewer());
      await d.tap('button[onclick*="adminDecide(\'verification\',\'ver_film_ama\',\'reject\'"]', 'Click Reject.');
      await d.type('#confirm-dialog-textinput', 'Your ID expired on 11 March 2024. Please send an ID that is still valid, in the same name as your account.', 'Write what to fix, in plain words. The person sees it. Never write fake or fraud. If you suspect fraud, report it in Fraud and Safety.');
      await d.tap('#confirm-dialog-confirm-btn', 'Click Reject. The person is told why, and can send a new ID.');

      await d.chapter('People with no ID yet');
      await d.show(':text("Not verified yet")', 'Not verified yet lists people who have not sent an ID. Click Remind to send them a reminder.', 3400);
      await d.show(':text("with no reviewed ID")', 'This list shows accounts marked Verified without an approved ID. Ask them for their ID, or remove the badge until it is checked.', 4000);

      await d.chapter('Guarantors to call');
      await d.show('#guarantors-review-panel', 'Pros give up to three guarantors. Each card shows the people still to call first.', 3400);
      await d.show('#guarantors-review-panel a:has-text("Call")', 'Click Call, or WhatsApp. Say you are calling from Trothen about the pro, by name.', 3400);
      await d.say('Ask how they know the pro, for how long, and whether they would trust them in their own home.', 3400);
      await d.tap('#guarantors-review-panel button[data-gname="Musu Johnson"][onclick*="verified"]', 'Only after you have spoken with them, click Verified.');
      await d.type('#confirm-dialog-textinput', 'Former employer, 4 years. Would trust him in her home.', 'Write what they said. The pro is told.');
      await d.tap('#confirm-dialog-confirm-btn', 'Click Verified.');
      await d.say('At least one guarantor should not be family. A sister alone is not enough: ask for an employer, a client or a community leader.', 4000);

      await d.chapter('How ID files are kept');
      await d.show('#id-retention-days', 'ID and face photos are deleted after a decision, after this number of days. Change it only with your manager.', 3600);
      await d.show('[data-admin-manual]', 'Everything in this video is in the Manual, with a table of good reasons to give.', 3200);
    },
  },
  {
    key: 'approvals', group: 'admin', section: 'approvals', as: 'u_superadmin', title: 'User Approvals: new sign-ups', tagline: 'Approving gives access only: the ID is checked in the Verification Queue',
    async steps(d) {
      await d.chapter('Two different checks');
      await d.say('When someone signs up, they appear in User Approvals. You decide whether the account may use Trothen at all.', 3600);
      await d.say('Approving an account gives access only. The person becomes Verified only when their ID is approved, in the Verification Queue.', 4000);
      await open(d, 'User Approvals');
      await d.show(':text("Approving an account gives access only")', 'The page reminds you of this at the top.', 2800);

      await d.chapter('The list');
      await d.show('th:has-text("Role")', 'Each row is a new sign-up: the name, customer or pro, the city and country, and when they signed up.', 3600);
      await d.show('th:has-text("ID")', 'The ID column says whether they have sent an ID yet, and whether it is waiting in the Verification Queue.', 3600);

      await d.chapter('What to check');
      await d.say('One. The name looks real: a first and a family name, not test, or random letters.', 3200);
      await d.say('Two. The phone number fits the country. Three. The city is in the country they chose.', 3400);
      await d.say('Four. It is not a second account. Search the name, phone and email in Customers and Providers.', 3400);
      await d.say('If something is unusual but not false, approve, and let the ID check settle who they are.', 3200);

      await d.chapter('Approve or reject');
      await d.show('button[onclick*="adminDecide(\'users\'"][onclick*="approve"]', 'Approve lets them in. If they have no ID yet, a window says so, and they are told to send one.', 3800);
      await d.show('button[onclick*="adminDecide(\'users\'"][onclick*="reject"]', 'Reject blocks them from signing in. Use it only for a false account, a duplicate, or someone banned before.', 3800);
      await d.say('Write a reason that is true and neutral. For example: you already have a Trothen account; please sign in with it.', 3800);
      await d.say('Never accuse anyone in a reason. If you suspect fraud, reject neutrally, and report it in Fraud and Safety.', 3400);
      await d.show('[data-admin-manual]', 'The Manual has the full checklist, and examples of good reasons.', 3000);
    },
  },
  {
    key: 'fraud', group: 'admin', section: 'fraud', as: 'u_superadmin', title: 'Fraud & Safety: flags and holds', tagline: 'A flag is a signal, not proof: look at the facts, then decide',
    async steps(d) {
      await d.chapter('What a flag is');
      await d.say('Trothen checks sign-ups, bookings, payouts and disputes all the time. When a check finds a risky pattern, it raises a flag here.', 4000);
      await d.say('A flag is a signal, not proof. Most have an innocent explanation. Your job is to tell them apart.', 3400);
      await open(d, 'Fraud & Safety');

      await d.chapter('Reading the list');
      await d.show(':text("Duplicate Identity")', 'This flag says a new account uses a phone number already on another account.', 3200);
      await d.show('.badge-danger:has-text("High")', 'It is High. A High flag about one account pauses that account at once: no new bookings or payouts, until someone clears it.', 4200);
      await d.say('So High flags have a two-hour target. Every hour of a wrong hold costs someone their work.', 3200);
      await d.show(':text("Price Anomaly")', 'This one is Medium: a price more than three times the usual for that work. Medium flags pause nobody.', 3600);

      await d.chapter('Looking into it');
      await d.say('Open the person in Customers and Providers. When did they join? Is their ID approved? Any disputes, holds or warnings?', 3800);
      await d.say('For a duplicate, open both accounts. A shared family phone is common. A banned person signing up again is not.', 3600);
      await d.say('For repeat disputes, read them in Disputes. For payouts, check Payouts being sent, and whose name the account is in.', 3800);
      await d.say('If you need their side, ask politely, without accusing them.', 2800);

      await d.chapter('Deciding');
      await d.show('button[onclick*="resolveFraudFlag(\'flag_film_price\',\'dismissed\')"]', 'Dismiss: you looked, and it was a false alarm.', 3000);
      await d.show('button[onclick*="resolveFraudFlag(\'flag_film_dup\',\'reviewed\')"]', 'Mark Reviewed: you looked into it, and acted, or it needs watching.', 3200);
      await d.say('Marking a flag does not lift a hold. If you found nothing wrong, release the hold too, in Customers and Providers.', 3800);
      await d.say('If it is real: keep the hold, tell your manager, and tell Finance at once if money is at risk.', 3400);
      await d.show('[data-admin-manual]', 'The Manual explains every kind of flag: what raises it, innocent explanations, and signs it is real.', 3400);
    },
  },
  {
    key: 'tokens', group: 'admin', section: 'tokens', as: 'u_superadmin', title: 'Tokens: confirm payments and keep the accounts right', tagline: 'Never add tokens for money you have not seen arrive',
    async steps(d) {
      await d.chapter('What tokens are');
      await d.say('Tokens are credit that pros buy from Trothen. One token is one US dollar.', 3000);
      await d.say('Pros use them to pay Trothen\'s commission on cash jobs, and if they choose, their plan fee, ads and Driver Passes.', 3600);
      await d.say('Tokens never touch customers\' money. And tokens are money: never add them for money you have not seen arrive.', 3600);
      await open(d, 'Tokens');

      await d.chapter('The totals');
      await d.show(':text("Tokens pros hold now")', 'Tokens pros hold now: money pros paid Trothen in advance.', 3000);
      await d.show(':text("Token sales are recorded as revenue only when tokens are spent")', 'For the accounts: a sale is revenue only when the token is spent. Unspent tokens are owed to pros.', 3800);

      await d.chapter('Confirm a mobile money payment code');
      await d.say('A pro who sends mobile money themselves gets a code, to write in the reference. This pro says they paid code T K 7 H 3 M 9 Q.', 4000);
      await d.say('First, open Trothen\'s own mobile money statement, and find the payment with that code in the reference.', 3400);
      await d.show('#tkx-tx-TK7H3M9Q', 'Then type Trothen\'s transaction ID, from the statement, not the one the pro typed.', 3400);
      await d.type('#tkx-tx-TK7H3M9Q', 'LM26112609153', 'Here it is.');
      await d.type('#tkx-amt-TK7H3M9Q', '1900', 'Type the amount that really arrived.');
      await d.say('If less arrived than the code asks for, the system refuses it. Ask the pro to send the rest.', 3200);
      await d.tap('button[onclick*="tokensAdminConfirmCode"][onclick*="TK7H3M9Q"]', 'Click Confirm payment.');
      await d.tap('#confirm-dialog-confirm-btn', 'Confirm again, only if you can see the money on Trothen\'s statement. The tokens are added, and the pro is told.');
      await d.say('If nothing is on the statement after a reasonable wait, write the reason in the box, and click No payment found. The pro sees it.', 3600);

      await d.chapter('Payments made outside the app');
      await d.show('#tka-q', 'For cash, an agent, or a bank deposit: find the pro here by email or name.', 3200);
      await d.say('Then, under their name, use Record a payment: the pack or the amount, how they paid, and the receipt number.', 3600);
      await d.say('For cash, the person who took it must give a receipt, and the cash must reach Trothen\'s account.', 3200);

      await d.chapter('Settings, for super admins');
      await d.show('#tka-max', 'Super admins set the limits: the most tokens one pro can hold, and the most they can buy in a day.', 3400);
      await d.show(':text("TEST SITES ONLY")', 'This must always be off on the live site. Otherwise pros get tokens for free.', 3400);
      await d.show('#tka-country', 'Each country can have its own packs, in round local prices, and its own limits.', 3200);
      await d.show('[data-admin-manual]', 'The Manual has a table for answering pros, and every message the system can show.', 3200);
    },
  },
  {
    key: 'payments', group: 'admin', section: 'payments', as: 'u_superadmin', title: 'Payments and payouts: send pros their money', tagline: 'Read the totals, check each payout, send it, and mark it sent with the receipt',
    async steps(d) {
      await d.chapter('What Payments is for');
      await d.say('When a customer pays through Trothen, the money is held until the job is done. Then it is released to the pro.', 3400);
      await d.say('The pro asks for a payout. Trothen takes its commission then, and the payout waits here until Finance sends it.', 3600);
      await d.say('A payout is real money leaving Trothen. Never mark it sent until the money has really gone.', 3200);
      await open(d, 'Payments');

      await d.chapter('The totals');
      await d.show(':text("Escrow Currently Held")', 'Escrow Currently Held is money customers paid for jobs not finished yet. It is not Trothen\'s money. Never count it as income.', 4000);
      await d.show(':text("Escrow Released (Total)")', 'Escrow Released is money released to pros after the job was confirmed.', 3000);
      await d.show(':text("Commission Revenue")', 'Commission Revenue is Trothen\'s commission. Service Fee Revenue is the fee customers paid on top.', 3400);
      await d.show('#fin-filter-from', 'Choose a From and a To date, and the panels below show only that period.', 3000);
      await d.show('#admin-financial-region-wrap', 'Funds by Region shows each city: money held, money released, commission, and its share of all of Trothen.', 3600);
      await d.show(':text("Commission Received")', 'Commission Received: taken from payouts, and paid with tokens on cash jobs.', 3200);

      await d.chapter('Every booking and its money');
      await d.show('#admin-transactions-table-wrap th:has-text("Escrow")', 'Platform Transactions lists every booking. Escrow says held, released or refunded.', 3400);
      await d.show('#admin-transactions-table-wrap th:has-text("Commission")', 'Commission marked est. is an estimate. It is final when the pro is paid out.', 3200);
      await d.say('The commission is thirteen percent on Starter, twelve on Pro, and ten on Super Pro. Store goods and tips carry none.', 3800);

      await d.chapter('Payouts being sent');
      await d.show('#admin-payouts-send', 'At the bottom is Payouts being sent: each payout a pro asked for, oldest first. Send them in that order.', 3800);
      await d.show('#admin-payouts-send :text("Joseph Kamara")', 'Look for warnings. This account is in the name of someone else, not the pro. Stop, and check with the pro before sending.', 4200);
      await d.say('Before sending, also check the pro in Customers and Providers: not suspended, and no open fraud flag.', 3400);
      await d.tap('button[onclick*="pdReveal(\'po_film_1\')"]', 'For this one, the name matches. Click Show full number. Every click is written in the Access Logs.');
      await d.show('#pd-rev-po_film_1', 'Here is the full wallet number and the name. Send the money from Trothen\'s own account, to exactly this number.', 4000);
      await d.type('#pd-ref-po_film_1', 'MP261126.1432.A07', 'Copy the transaction ID from the receipt, and type it here.');
      await d.tap('button[onclick*="pdMarkSent(\'po_film_1\')"]', 'Click Mark as sent. The pro is told, with the reference, so the receipt can be matched.');
      await d.say('If an MTN wallet can be paid directly, a button Send by MTN MoMo appears instead. MTN then confirms it by itself.', 3600);

      await d.chapter('When you can\'t send');
      await d.tap('button[onclick*="pdProblem(\'po_film_2\')"]', 'If the number is wrong, or the name doesn\'t match, click Can\'t send.');
      await d.type('#pd-why-po_film_2', 'The Orange Money account is in another person\'s name. Please add your own number in Settings.', 'Write what is wrong, in words the pro understands.');
      await d.tap('button[onclick*="pdProblemSend(\'po_film_2\')"]', 'Click Tell the pro. The payout stays in the list, with your note, until they fix it.');

      await d.chapter('A daily routine');
      await d.say('Every day: open Payouts being sent, check each one, send it, and mark it sent with the transaction ID.', 3600);
      await d.say('Check anything waiting for MTN for more than a day. And at the end of the month, download the transactions PDF for the accounts.', 3800);
      await d.show('[data-admin-manual]', 'Everything in this video is in the Manual, with more detail.', 3000);
    },
  },
  {
    key: 'disputes', group: 'admin', section: 'disputes', as: 'u_superadmin', title: 'Disputes: decide fairly, step by step', tagline: 'Read everything, then release, refund or split, with a clear note',
    async steps(d) {
      await d.chapter('What Disputes is for');
      await d.say('A dispute is a problem on a booking that the customer and the pro could not settle themselves.', 3200);
      await d.say('While a dispute is open, Trothen holds the money. Nobody is paid, and nobody is refunded, until you decide.', 3400);
      await d.say('Your decision moves real money, and often cannot be undone. Decide on the facts, never on who is louder.', 3400);
      await open(d, 'Disputes');

      await d.chapter('The list of disputes');
      await d.show('#admin-disputes-table-wrap th:has-text("Parties")', 'Each row is one dispute. Parties shows the pro, then the customer.', 3000);
      await d.show('#admin-disputes-table-wrap th:has-text("Reason")', 'Reason is what the person who opened it wrote.', 2600);
      await d.show('#admin-disputes-table-wrap th:has-text("Amount")', 'Amount is the price of the booking, in US dollars.', 2600);
      await d.show('#admin-disputes-table-wrap th:has-text("Status")', 'Status is open, escalated, resolved, rejected, or closed. Open and escalated ones still need a decision.', 3400);
      await d.show('#dispute-filter-from', 'To see only some dates, choose a From date and a To date. Clear shows them all again.', 3000);
      await d.show('button:has-text("Download PDF")', 'Download PDF makes a report of the disputes shown, for a meeting or an audit. Keep it in Trothen\'s own files only.', 3400);

      await d.chapter('Open a dispute and read everything');
      await d.tap('tr[onclick*="dp_film_paint"]', 'Click a dispute to open it. This one is about a painting job.');
      await d.show('#dispute-modal-body .booking-summary', 'At the top: the reason, the amount Trothen holds, and the status.', 3200);
      await d.say('Here the customer says only two of the three rooms were painted, and the pro did not come back.', 3200);
      await d.show('#dispute-modal-body a:has-text("third-room")', 'Under Evidence are the files both sides added. This photo is from the customer: the third room, not painted.', 3600);
      await d.show('#dispute-modal-body a:has-text("rooms-1-and-2")', 'This one is from the pro: the first two rooms, finished. Open every file before you decide.', 3400);
      await d.show('#dispute-calls', 'Here are the calls between them: one missed, then one answered, of two minutes. Calls are never recorded. You see that they happened, not what was said.', 4200);
      await d.say('Also read the booking in Customers and Providers: what was agreed, any extra work, and their messages.', 3400);
      await d.say('Check when the pro pressed Arrived and I\'ve finished the job. The customer then has three days to check the work.', 3600);
      await d.say('And check Fraud and Safety. Someone in three or more disputes in thirty days is flagged there.', 3200);

      await d.chapter('Decide: release, refund or split');
      await d.show('button[onclick*="release_to_provider"]', 'Release Escrow to Provider: the work was done as agreed. The pro is paid, less the commission, and the booking is completed.', 4000);
      await d.show('button[onclick*="refund_customer"]', 'Refund Customer Instead: the work was not done as agreed. The customer gets the money back, and the booking is cancelled.', 4000);
      await d.say('Here, two of the three rooms were painted, as both photos show. So part of the money goes to each side.', 3400);
      await d.tap('button[onclick*="openSplitDispute"]', 'Click Split the payment.');
      await d.type('#split-refund', '100', 'Type how much goes back to the customer. One room of three: one hundred dollars.');
      await d.show('#split-preview', 'The window shows what each side gets. The pro\'s commission is taken from their part only.', 3200);
      await d.type('#split-note', 'Two of the three rooms were painted, as the photos show. The customer gets $100 back for the third room.', 'Write a note both people will understand: what you decided, and why. Be neutral, and never put anyone\'s phone or address in it.');
      await d.tap('#split-confirm-btn', 'Click Split the payment. The money moves, and both people are told, with your note.');

      await d.chapter('After the decision');
      await d.tap('tr[onclick*="dp_film_paint"]', 'The dispute is now resolved. Open it again.');
      await d.show('#dispute-modal-body :text("Resolved: split")', 'The timeline shows the split: what went back to the customer, and what went to the pro.', 3200);
      await d.show('#dispute-modal-body :text("Audit trail")', 'The audit trail records every decision, with your name, the time and your note. It can\'t be changed.', 3600);
      await d.show('button[onclick*="reopen"]', 'A dispute is decided once. Only a super admin can reopen it, and only while the money is still inside Trothen.', 3600);
      await d.say('If the pro has already been paid out, a refund can\'t be done in the app. Settle it by hand, and tell your manager and Finance.', 3800);
      await d.run(() => closeDisputeModal());

      await d.chapter('Cash jobs');
      await d.tap('tr[onclick*="dp_film_cash"]', 'This dispute is about a cash job. The customer paid the pro directly.');
      await d.say('On a cash job, Trothen never held the money. So there is nothing to refund or split in the app.', 3200);
      await d.show('button[onclick*="refund_customer"]', 'You can still decide for the customer or for the pro, so it is on record. In the note, say what the pro should pay back, if anything.', 4000);

      await d.chapter('Super admin actions');
      await d.show('button[onclick*="request_info"]', 'Request Info asks both sides for more information. Your note is the question they receive.', 3400);
      await d.show('button[onclick*="escalate"]', 'Escalate sends it up for a senior decision: a large amount, a legal question, or a safety matter.', 3400);
      await d.show('button[onclick*="\'reject\'"]', 'Reject means not upheld. The booking carries on as before, and the money stays held for it.', 3400);
      await d.show('button[onclick*="\'close\'"]', 'Close ends it without a decision, for example when the two sides settled it themselves.', 3200);
      await d.run(() => closeDisputeModal());

      await d.chapter('Before you decide: a checklist');
      await d.say('One. Read the reason. Two. Read the booking. Three. Open every piece of evidence.', 3400);
      await d.say('Four. Check Arrived, I\'ve finished the job, and the three days. Five. Check the calls. Six. Check Fraud and Safety.', 3800);
      await d.say('Then choose release, refund or split, and write a clear, polite note with the reason.', 3200);
      await d.show('[data-admin-manual]', 'All of this is in the Manual, with more detail. Click Manual on any Admin page to read it.', 3400);
    },
  },
];
