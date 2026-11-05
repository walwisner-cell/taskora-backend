# Trothen v138: "Download a copy of my data", done properly

This one package includes everything since the version on your GitHub `main` before v128: v128 to v137, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
In Settings, "Download the complete file (.json)": is there a better way?

## What I found
- **Two confusing buttons.** "Download my data" gave a short PDF summary. "Download the complete file (.json)" gave a raw data file that most people can't open, and that a phone shows as code.
- **A real gap: messages were missing.** The data file looked for messages under the wrong field names, so it held **no messages at all**. It also missed:
  - the reviews a customer wrote;
  - favourite pros;
  - referrals;
  - calls;
  - ride passes;
  - a customer's job responses.
- **Not the files themselves.** Photos and voice messages weren't in it at all.

## What changed: one button, one file with everything
This is how Google Takeout and Facebook's "Download your information" work, and what data protection laws ask for: a copy a person can read, and one they can take to another service.

Settings → Your data and your account now has one button: **Download a copy of my data**. It gives a single ZIP file containing:

| Inside the ZIP | What it is |
|---|---|
| `Start here.html` | Opens in any browser: profile, every booking, payment, token, payout, review, dispute, call, job posted, and **every conversation in full**, with voice messages that play and photos that show. Works on a phone. |
| `Summary.pdf` | The short printable summary (the same as before). |
| `spreadsheets\` | Bookings, payments, messages, calls, reviews, disputes, tokens, payouts, jobs and notifications as CSV files for Excel or Google Sheets. |
| `data.json` | Everything, exactly, for moving to another service. |
| `files\` | Profile photo, portfolio and store photos, receipts, dispute evidence they uploaded, and the voice messages in their conversations. |
| `README.txt` | What each part is, and how to open it on a phone. |

The short PDF is still there as a small link under the button: "Only need something to print? Download a short summary (PDF)".

## Keeping it safe
- **Confirm it's you.** The ZIP has someone's whole history, so they enter their password first, as when closing the account. People who only sign in with Google type DOWNLOAD instead.
- **A notice after every download:** "A copy of your Trothen data was downloaded on … If this wasn't you, change your password now."
- **At most 6 data downloads an hour,** including wrong passwords, so a password can't be guessed this way.
- **Never included:**
  - passwords (never stored in a readable form);
  - ID document images. The README says to contact support for a copy.
- **Only their own records,** and files are decrypted only for the owner.
- **Safe to open:** spreadsheet cells can't run as Excel formulas, and message text in the page can't run as code.
- **Missing files are listed honestly.** If a photo or voice message is recorded but no longer on the server (for example a deploy without the permanent disk), it's listed as "no longer on our servers" rather than left out silently.

## What I tested (43 checks)
- **Refusals:** no password, a wrong password, DOWNLOAD on a password account, and not signed in.
- **The ZIP itself:**
  - every file inside passes Python's integrity check;
  - it opens with `tar`, the tool Windows uses.
- **The contents:**
  - all the parts are inside, and `data.json` now has the messages;
  - nothing secret is included;
  - the voice message and photo are the real files;
  - CSVs open correctly in Excel, and a message starting with "=" stays text;
  - `Start here.html` shows conversations in full, with voice messages playing from the files beside it;
  - a missing file is reported, and the pro's ZIP has only the pro's records.
- **Afterwards:** the notice is sent, and the old PDF address still works.
- **On screen:**
  - the new panel and the password box;
  - a wrong password is told so;
  - the browser downloads `trothen-my-data-DATE.zip`;
  - the PDF link works;
  - `Start here.html` on a laptop and on a phone.
- **Earlier tests, all still passing:**
  - calls and voice messages (67 + 22);
  - permissions (95), all admin addresses and disguised addresses;
  - instant updates;
  - commission, categories, accepting jobs, listed pros.

## Good to know
- **On a phone,** the ZIP has to be unzipped first. On iPhone, tap it in Files. On Android, open it in Files by Google. Then open `Start here.html`. The README says this too.
- **Size.** The file is built while it downloads, one file at a time, so a pro with many photos doesn't strain the server. It isn't compressed again, because photos and audio are already compressed.
- **Your privacy policy** (section 7, "Your Choices") now names the new button and what's in the download. If you edited the privacy policy in Admin before, update that line there too.

## Files
- **New:**
  - `src/zip-stream.js`: builds the ZIP as it downloads, with no extra package.
  - `src/account-export-zip.js`: what goes in the ZIP, and `Start here.html`.
- **Changed:**
  - `src/account-privacy.js`: messages, calls, reviews, favourites, referrals and more now included.
  - `src/routes/auth.routes.js`: the new download, with the password check and the notice.
  - `src/platform-settings.js`: the privacy policy line.
  - `public/app/trothen.js`: the new panel.
  - `public/index.html`

No new packages, environment variables or database changes.
