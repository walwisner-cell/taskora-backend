# Trothen v133: pros customers can't find, and the Super-Pro panel rates

This one package includes everything since the version on your GitHub `main` before v128: v128 to v132, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
I have Landscaping, but I can't find it.

## What was wrong
- **Search and the homepage used different rules.** Search, and job matching, only show a pro once their ID is verified and they have a profile photo (the "Mandatory Profile Picture" rule). The homepage category counts, Popular Projects and Featured pros did not check for the photo.
- **So the homepage advertised pros nobody could find.** The only Landscaping pro was verified but had no photo. The homepage said "Landscaping · 1 pro · from $80", but clicking it or searching for it found nobody. Any category whose only pros have no photo had the same problem.
- **The pro was never told.** A verified pro with no photo was hidden from search and got no job matches, and nothing on their dashboard said why.

While testing this I found a second mistake: the "Your Path to Super-Pro" panel on a pro's dashboard had its own commission rates typed in (Pro 9%, Super-Pro 7%). Payouts, the pricing page and your policy all use 13% / 12% / 10%, so a pro on the Pro plan was told they pay 9% when payouts take 12%.

## What changed
- **One rule everywhere.** A pro appears in search, in the homepage category counts, in Popular Projects, in Featured pros and in job matches once their ID is verified and they have a profile photo (`src/listing.js`). The homepage never shows a pro that a customer can't then find.
- **Pros are told.** A verified pro with no profile photo sees "Customers cannot find you yet" on their Overview, Job Matches and Settings pages, with an Add Profile Photo button. It disappears as soon as they add one.
- **Admins can see it.** Admin → Categories & Countries has a new "Customers Can Find" column next to "Verified Pros". For example, "Landscaping: 1 verified, 0 (1 with no profile photo)".
- **The Super-Pro panel shows the real rates.** It now reads them from the server, the same numbers payouts charge.

## What needs your action
- **For Landscaping to show:** the pro needs to add a profile photo (Settings → Profile Photo). Once they do, they appear in Landscaping straight away. To find other pros in the same position, look for red "with no profile photo" counts on the admin Categories page.
- **If you would rather not require a photo,** that is a business choice. It's a one-line change in `src/listing.js`, but your "Mandatory Profile Picture" rule exists to build trust, so I left it in place.

## What I tested
- **15 + 1 new checks, with no page errors:**
  - with no photo, the homepage count, Popular Projects and Featured all leave the pro out, and search agrees;
  - the admin sees 1 verified pro and 0 that customers can find;
  - the pro sees the warning on laptop and phone, with no sideways scroll;
  - the Super-Pro panel shows 12% for Pro;
  - once the pro adds a photo, Landscaping shows 1 pro, search finds them (including "landscaper"), they are a popular project, the homepage → Landscaping list shows them, and the warning goes away.
- **Earlier tests.** All still pass on a copy deployed from the zip.

## Files
- **New:** `src/listing.js`, `public/app/listing.js`.
- **Changed:** `src/routes/marketplace.routes.js`, `src/routes/admin.routes.js`, `public/app/trothen.js`, `public/index.html`.

No new packages, environment variables or database changes.
