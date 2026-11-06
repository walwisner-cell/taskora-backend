# Trothen v144: Post a Job, redesigned (step by step, a real price, a date, and jobs that close by themselves)

This one package includes everything since the version on your GitHub `main` before v128: v128 to v143, plus this. Deploy only this one. It works whether or not v128 is already live.

## What I asked
I wasn't happy with the Post a Job form. I asked for the best solution and logic, with every gap fixed.

## What was wrong with the old form
- **Budget was free text.** A customer could type "$80-150", "L$5000" or "cheap". The app then guessed one number from it. When it couldn't, it **used $100**, so a pro could be booked at a price nobody chose.
- **No way to say "pros, send me your prices".** In Liberia that's how most work is priced: by the job, after the pro hears what it is.
- **No local money.** A Liberian customer had to think in US$.
- **No "when".** Pros couldn't tell an emergency from a job for next month.
- **"Materials cost" was a number the customer had to guess.** What pros need to know is *who* buys the materials.
- **The description could be 5 characters** ("fix it"), which no pro can price.
- **Jobs stayed open forever**, so pros kept seeing jobs that were long dead.
- **A bug:** a job with only a landmark and no map pin was refused, because the old form was cleared before the place was read.
- **If the server refused the job, the form came back empty**, and everything typed was lost.

## The new form: 5 short steps
This is how Thumbtack, Airtasker and TaskRabbit ask it. A bar at the top shows the step. Each step is checked before moving on. Going back keeps everything.

1. **What.** One search box. As the customer types ("plumber", "braids", "keke"), the kinds of work appear, each with how many pros offer it nearby ("3 pros near you", "No pros yet"). The ones most offered nearby show first. There is also "Something else (not listed)".
2. **Details.**
   - A bigger box to describe the job, with a prompt (what, where, how big, access, power or water) and a counter. At least 15 characters.
   - Photos or videos, as before.
   - **Materials:** "I have the materials" / "The pro brings the materials" (in their price) / "Not sure". If the customer has them, they can say what they have.
3. **When and where.**
   - **When:** "As soon as possible" / "On a date" (with an optional time) / "I'm flexible".
   - **Where:** the same location picker as before (pin, map, or landmark).
4. **Price.**
   - **"Pros send me their prices" (recommended):** pros answer with a price, and the customer compares and chooses.
   - **"My price is…":** a pro can accept at that price in one tap, or offer another.
   - **"My budget is…":** from and to.
   - Amounts can be in **L$ or US$** (or the customer's own money elsewhere). L$5,000 shows "≈ US$26.32" as it is typed.
   - Trothen's service fee is explained, and the payment choice (protected or cash) is in this step.
5. **Check.** Everything on one screen, each with **Change**. It also says who will see the job (how many pros), that the exact location goes only to the pro hired, and how long the job stays open. Then **Post my job**.

## What changed behind the form
- **The price is stored properly.**
  - The server keeps the price in US$ for payments, and the customer's own amount for display: "L$5,000 (≈ $26.32)".
  - The rate is the one set in Admin.
  - Pros and the customer see the same words on the job.
- **No more made-up $100.**
  - Hiring uses the pro's own price, or the customer's single price.
  - If there's neither, the app asks the customer to type the agreed price. It never invents one.
  - The same rule applies in the app and on the server.
- **Pros see more on each job:** when it's needed, who brings the materials, and how it's priced. The landmark still stays hidden until they're hired.
- **Jobs close by themselves.**
  - **When:** a job nobody was hired for closes after **14 days**. A job with a date closes the day after that date, if that's sooner.
  - **What happens:** the customer is told ("Post it again any time, or book a pro directly"), and the pros who were waiting are let go.
  - **How often:** the check runs every hour.
- **If the server refuses the job** (for example, cash jobs are switched off), the form comes back exactly as it was, at the same step, with the reason.
- **The landmark-only bug is fixed.**

## What I tested (40 new checks)
- **Pricing:**
  - "Pros send me their prices": no budget is stored, and the label says so;
  - my price $85, and a budget of $60 to $120;
  - a range the wrong way round, a price of 0, and an unknown pricing choice are refused.
- **Liberia:**
  - L$5,000 is kept as $26.32 and shown as "L$5,000 (≈ $26.32)";
  - a budget of L$3,000–6,000 shows as "(≈ $15.79–$31.58)".
- **No made-up price:** hiring a pro who sent no price, on a job with no price, is refused with a clear message, and no booking is made. "$80-150" is never guessed as one number.
- **Dates:**
  - a date in the past, more than 6 months ahead, or "on a date" with no date is refused;
  - a job on a date closes the day after it.
- **Closing:** a 14-day job closes, the customer is told, and the waiting pros are let go.
- **The pro's view:** they see when, materials and pricing, but not the landmark.
- **On screen:**
  - all 5 steps, the search ("electric" finds Electrical), and each step catching a missing answer;
  - L$ or US$, with the US$ amount shown as it is typed;
  - the Check screen, with Change keeping what was typed;
  - posting with every answer saved;
  - a refused job bringing the form back as it was;
  - the customer's job card;
  - a phone screen;
  - the pro's job list.
- **Earlier tests:** all still pass (listed in the deployment steps).

## Good to know
- **Business:** "Pros send me their prices" is the default, because it suits pricing by the job. If you'd rather lead with "My price is…", it's one word to change.
- **The 14 days** is a setting in the code (`OPEN_DAYS` in `src/job-details.js`). Tell me if you want it in Admin instead.
- **Exchange rates:** the L$ ⇄ US$ conversion uses the rate in Admin. Keep it current, because it decides what a pro is paid in US$ for an L$ price.

## Files
- **New:**
  - `src/job-details.js`
  - `public/app/postjob.js`
- **Changed:**
  - `src/routes/marketplace.routes.js`
  - `server.js`
  - `public/app/trothen.js`
  - `public/index.html`

**What's needed:** no new packages, database changes or settings.
