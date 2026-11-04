# Trothen v135: choose exactly what each admin can see and do

This one package includes everything since the version on your GitHub `main` before v128: v128 to v134, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
Can I give privileges to admins, instead of only choosing one fixed role?

## What changed
**A new role, "Custom permissions".** Admin → Locations & Admins → New Admin → Role now has the option "Custom permissions: choose exactly what they can see and do". It works the way staff accounts work in Shopify or Stripe:
- **Every section, with three choices:** Overview, User Approvals, Customers & Providers, Verification Queue, Stores & Skills, Rides, Provider Scores, Disputes, Fraud & Safety, Payments, Tokens, Customer Payments, Plans & Pricing, Advertising, Promotions, Job Applications, Contact Us Messages, Reports, Sales Inquiries, Organizations and Access Logs. Each can be set to:
  - **Off:** hidden from their menu and blocked.
  - **View:** they can open the section and see its records.
  - **Manage:** they can also act in it (approve, resolve, edit).
- **Start from a role.** Pick Disputes Team, Financial Team, Customer Service and so on, and the ticks fill in for that role. Then change any of them.
- **Where they work.** Choose one city, one country, or every region. They only see people and records in that area.

**Changing someone later.** Under Functional Team Members, every team member now has a **Permissions** button. It changes what they can do, and the change applies to their very next action, with no new sign-in. It also turns an existing fixed-role admin (for example a Customer Service admin) into a custom one, starting from their current role.

**What a custom admin sees.** Their menu shows only the sections they were given, plus their own Settings. The sidebar shows their area ("Admin · Every region", "Admin · Ghana"). If they try something they can only view, they get a clear message: "You can view Disputes but not make changes there. Ask a super admin for Manage access."

**Notifications.** Custom admins also receive the notices for their sections, for example new ID documents to check (Verification, Manage), token or customer payment codes (Tokens or Customer Payments, Manage), and new job applications (Job Applications).

## Always yours alone (super admin)
These are never part of custom permissions, whatever is ticked:
- creating or changing admins;
- Go-Live and Data Cleanup;
- platform settings, wording and homepage images;
- the legal and policy pages;
- categories and countries changes;
- announcements to all admins;
- token balance corrections and token settings.

Only a super admin can create a custom admin. The Customer Service team can still only add Customer Service colleagues, as before.

## How it is kept safe
- **Checked on the server, not just the menu.** Every request a custom admin makes to an admin address is checked against their permissions before any work happens. Hiding a menu item alone is never enough, so this check is what protects you.
- **Disguised addresses are caught.** The check reads every address the way the server does, so capitals or doubled slashes ("/API/ADMIN//users/all") can't slip past it. During my final check I found that capitals did slip past at first, and fixed it before delivering.
- **Two locks.** Inside the admin area there's a second lock. If a custom admin's request ever got past the first check without being approved, it is refused there anyway.
- **Default deny.** Any admin address that isn't on the list of sections is refused. If I add a new admin feature later and forget to list it, custom admins are blocked from it, not let in.
- **View vs Manage.** View allows reading only; any change needs Manage.
- **Existing admins are unchanged.** Regional admins, the fixed team roles and super admins work exactly as before.

## What I tested
- **Every admin address, both ways.** I took all 176 admin addresses on the server:
  - an admin with only "Overview" was refused on every other one, in normal, capitalised and double-slash form;
  - an admin given every section reached every section address, while the super-admin-only ones stayed refused.
- **13 disguised forms** (capitals, double slashes, trailing slash, "..", encoded letters, extra characters) of 12 sensitive addresses were all refused.
- **64 + 1 checks on permissions and screens:**
  - an admin with Disputes = View can read disputes but not resolve them;
  - with Verification = Manage they can decide documents;
  - 18 sections they weren't given are each refused;
  - 13 super-admin-only or unknown addresses are refused, including creating admins, changing their own permissions, Go-Live, data cleanup, the legal pages and an address that doesn't exist;
  - their verification queue only shows their country;
  - a change of permissions takes effect at once;
  - token balance changes stay super-admin only;
  - a suspended custom admin is refused;
  - Customer Service can't create a custom admin;
  - regional admins and the super admin are unchanged.
- **On screen:** New Admin with the 21 sections, "Start from a role", every-region option, creating from the screen, the team list, the Permissions dialog saving a change, and a custom admin's menu and sidebar.
- **Earlier tests.** All still pass on a copy deployed from the zip.

## Good to know
- **Buttons in view-only sections.** Inside a section someone can only view, the action buttons are still on the page. Pressing one shows the "you can view but not make changes" message, and nothing changes.
- **Contract PDFs.** Any admin can still open a booking's contract PDF from a link, as before this change.
- **Plans & Pricing.** Manage lets a custom admin set local prices for their own country only, the same rule regional admins have.
- **Area and notifications.** A custom admin limited to one area still receives the team-wide notices (for example a new ID document anywhere), but the lists they open only show their area.

## Files
- **New:**
  - `src/admin-permissions.js`: the sections, which admin addresses belong to each, and the check.
  - `public/app/permissions.js`: the screens.
- **Changed:**
  - `server.js`: runs the check before every route.
  - `src/routes/admin.routes.js`
  - `src/routes/payments.routes.js`
  - `src/routes/store.routes.js`
  - `src/routes/rides.routes.js`
  - `src/routes/tokens.routes.js`
  - `src/routes/custpay.routes.js`
  - `src/routes/misc.routes.js`
  - `src/tokens.js`
  - `src/customer-payments.js`
  - `src/provider-score-scheduler.js`
  - `public/app/trothen.js`
  - `public/index.html`

No new packages, environment variables or database changes.
