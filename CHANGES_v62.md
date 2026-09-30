# Trothen v62: pro quick view, recent work, reviews wall, dark mode, add to phone

## What I added

### Pro quick view
Tapping any pro card (front page, all pros, search results) now slides open a panel instead of leaving the page. On computers it comes in from the right; on phones it rises from the bottom.

The panel shows:
- the pro's photo, name, role and "ID checked"
- their rating, jobs done, rate and Trothen Score
- where they work and their skills
- up to six of their work photos, which open larger when tapped
- their three most recent reviews

"Book" and "Full profile" buttons stay at the bottom. It closes with the X, by tapping outside, or with the Esc key.

### Recent work on Trothen
A new front-page section of real photos from pros' portfolios. It scrolls sideways with arrows or a swipe, and tapping a photo opens that pro's quick view.

### What customers say
A new front-page section where real customer reviews drift slowly across the screen in two rows going opposite ways. It stops while the mouse is over it, and tapping a review opens that pro's quick view.
- It shows recent 4- and 5-star reviews, and the heading says so plainly.
- Reviewer names are shortened to first name and last initial (for example "Renee P.").
- If someone's device is set to reduce motion, the reviews sit still in a grid.

### Dark mode
The footer has an Auto / Light / Dark switch.
- Auto follows the visitor's phone or computer setting. A choice of Light or Dark is remembered on that device.
- The page opens straight in the right colours, with no flash of the wrong ones.
- Dark mode covers the public pages: the front page, categories, all pros and the quick view. Dashboards and forms stay light for now.

### Add Trothen to your phone
A yellow "Add Trothen to your phone" button appears in the footer, and in the phone Menu, only when installing is actually possible:
- On Android phones and in Chrome or Edge on a computer, it opens the normal install prompt.
- On iPhones and iPads, which don't have that prompt, it shows three short steps for "Add to Home Screen" in Safari.
- It hides itself once Trothen is installed.

## Server change
There is a new public address, `/api/showcase`, which sends the front page its real reviews and work photos:
- It only uses pros who are verified and have a profile photo, the same rule as the public directory.
- It sends at most 24 of each.
- It sends nothing until there are at least 3 qualifying reviews or 4 work photos. Until then, those two sections stay hidden, so the front page never shows a half-empty wall.

## Worth knowing
- **These two sections will stay hidden on the live site at first.** Go-Live removed the demo data, so they fill in as real customers leave reviews and pros upload work photos. To see them sooner, ask your pros (starting with Joseph) to add work photos in their dashboard.
- **A real photo for the top of the page** can be uploaded in Admin → Settings. A photo of a Trothen pro at work would add the most human touch of anything.

## Tested
With test pros, photos and reviews on my own computer only (none of it is in these files):
- The quick view opens from pro cards and photos, shows real details, and closes with X, outside tap or Esc.
- The work photos scroll.
- The reviews move and stop on hover.
- Dark mode switches correctly.
- On an iPhone, the install button shows and opens the steps.

Nothing runs off the edge at any phone width. Search and the job ticket still work, with no script errors. My logo is unchanged.

## Byte counts
| File | Bytes |
|---|---|
| public\index.html | 1,098,318 |
| src\routes\marketplace.routes.js | 118,242 |

index.html replaces the v61 one. marketplace.routes.js replaces the v56 one; the only change is the new `/api/showcase` address.
