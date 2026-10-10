# Trothen v108.2: signing out now really starts sign-in again from the beginning

What I saw: after signing out and pressing Sign In, the site sometimes went straight to "Enter your two-factor code", with the last code still typed in, instead of the email and password form.

Why: after a code was accepted, the code step was never put away. It stayed on the sign-in screen, hidden behind the account. Signing out did end the session (the old code could not be used again), but the next Sign In showed that leftover step.

Now:
- When a code is accepted, the code step is put away and the code is cleared.
- Signing out clears the sign-in screen as well as the session.
- Pressing Sign In always opens at the email and password form, including after leaving a sign-in half way.

Tested on a computer and a phone screen: sign in with password and code, sign out, reload, sign in again, and leave a sign-in half way. 25 new checks, and every earlier browser suite passed again.

Two-factor sign-in itself is unchanged. Admin accounts always ask for a code after the password, every time.

Files changed: `public\index.html` (only the version tag on the script line), `public\app\trothen.js`.

This package includes everything from v86 onward, including v108 and v108.1.
