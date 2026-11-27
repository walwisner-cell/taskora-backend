---
key: rides
title: Rides: drivers, safety alerts, fares and rules
sections: rides
video: fares
updated: 2026-11-26
---
## What this part of Admin is for

Trothen Rides lets customers book a motorbike, keke, car or van with a **verified driver**. In **Admin → Rides** the team:

- turns Rides **on or off for each country**;
- **approves drivers** after checking their papers;
- handles **safety alerts** from riders and drivers;
- sets the **fares**, the **ride rules** and the **Driver Pass**;
- keeps the list of **places riders can search** (for example "ELWA Junction").

> **Rule:** No ride can happen until a person approves a driver. Approve only when **every required paper** is there, readable and valid, and the photos show the real person and vehicle.

## Who can do what

- **Super admins** change the settings, fares and rules ("Only a super admin can change these settings").
- **Regional admins**, the **Verification** and **Customer service** teams, and custom admins with "Rides" can review drivers and handle safety alerts.

## Where rides are on

At the top: drivers **waiting for review**, **approved drivers**, **rides open now**, and **open safety alerts**.

### Rides by country

Each live country, with its approved drivers, whether **Trothen fares** are set, and an **On/Off** switch.

- Changes take effect **at once**. Rides already under way finish normally.
- Turning a country off with drivers online asks you first: new ride requests stop.
- **Switch Rides on in another live country:** choose it and press `Switch on`.

> **Rule:** Turn a country on only after checking its **transport rules**, and setting its **fares**. Even then, no ride happens until you approve a driver there.

## Driver applications

Each driver who applied, with their vehicle and papers. The papers required depend on the **country and vehicle** (see Settings). For a motorbike in Liberia, by default: **driver's licence, vehicle registration, photo of the vehicle with its plate, insurance or road permit, police clearance, a photo of the driver, and a helmet**.

The card warns you:

- **Missing required:** papers not uploaded;
- **NO helmet** (motorbikes);
- the licence and insurance **expiry dates**.

### Checking a driver

1. Open each paper (`Open`): it must be **real, readable, in the driver's name**, and **not expired**.
2. The **photo of the vehicle** must show the **plate**, matching the registration.
3. The **photo of the driver** must match their **ID** in Trothen. Check that their ID has been approved in the Verification Queue.
4. For a motorbike: the **helmet** is confirmed.

Then:

- `Approve`: "Check the licence and the vehicle photo first." The driver can then go online.
- `Reject`: type a **reason for the driver** (at least 5 characters), for example: "Your licence has expired. Please upload a valid licence."

## Safety alerts

Two kinds of alert appear here:

- **SOS:** a rider or driver pressed SOS during a ride. The team is told at once ("🚨 SAFETY ALERT on ride #… Open Rides now"), with **where** it happened (`Open location`). The other person on the ride is told an alert was raised. The rider is told to call the local emergency number if they are in danger.
- **A problem reported** on a ride. A **cash ride** can't be disputed (Trothen held no money), so riders use this instead.

1. **Act at once.** Open the location and read what was reported.
2. **Contact the person** who raised it. If anyone is in danger, tell your manager straight away, and the police if needed.
3. When it is dealt with, press `Mark handled`.

> **Policy:** Who is on call for safety alerts, and at what hours, is for Trothen to set. An alert must never wait until the next working day.

## Settings (super admin)

| Setting | What it does | Default |
|---|---|---|
| Longest ride (km) | Rides longer than this can't be booked. | 40 |
| Show drivers within (km) | How far away drivers are offered to a rider. | 15 |
| Minutes for a driver to answer | Then the request goes to another driver. | 5 |
| Trothen fee on top of the fare (%) | Added to what the rider pays in the app. | 9 |
| Driver commission on ride earnings (%) | Taken from the driver's ride earnings. None with a Driver Pass. | 5 |
| Insurance or road permit | Required to be approved, or optional. | Required |
| Papers a driver must upload | One rule per line: country \| vehicle \| papers. `*` means any. Every rule must include licence, registration and vehicle. | Liberia motorbike: all papers and helmet |
| Driver Pass | Drivers can buy passes and pay no commission while one is active. | On |
| Cash rides | Off (app payment only), or On: commission from the driver's tokens (none with a pass). | — |
| Free first pass for new drivers (days) | 0 = off. | 7 |
| Pass prices | One per line: short name, label, days, price in US$. **Placeholders**: set real prices. | — |
| Release the fare automatically after the driver ends the trip (hours) | 0 = never. | 12 |
| Cancel and refund a ride that never started after (hours) | | 3 |
| Flag a started trip nobody ended after (hours) | | 6 |
| Driver waits for a rider (minutes) | | 10 |
| Keep GPS routes of finished rides (days) | Then they are deleted. | 30 |
| No motorbike rides between … and … o'clock | Each person's local time. | — |

**Ride Rules** for riders and for drivers are written here too. They are a **starting draft**: have a lawyer review them before real riders use them. Saving changed wording makes everyone accept them again. Before allowing **cash rides**, have the lawyer add them to the Ride Rules.

Press `Save` at the bottom.

## Fares

Trothen proposes every fare from the **road distance** and the **time**, per vehicle, in the country's own money. **No surge pricing.** A country without fares uses each driver's own rates.

- Choose the **country**. The **currency** follows it (LRD for Liberia).
- For each vehicle: **starting fare**, **per km**, **per minute**, and **lowest fare**.
- Starter fares are a starting point for Monrovia, **not official fares**: compare them with what riders pay today, change them if needed, and press `Save fares for …`.

### Fuel price link

Enter the pump price the fares were set at, and **today's** price. Fares move only when the price has changed by more than the **threshold** (10% by default), and then by the **share of a fare that is fuel** (40%). Drivers are told.

### Other rules

- **Drivers may be above or below the fare by up to (%)**: 20.
- **Lowest offer a rider can make (% of the fare)**: 70.
- **Round fares to the nearest**: 5.
- **Night extra (%)**, with the hours it starts and ends.
- **Hours from UTC** for the country (Liberia 0).

The **example fares** table shows the result for 2, 5 and 10 km. Riders always see the fare before they book, and a change applies only to **new** rides.

`Stop Trothen fares here (drivers set their own)` removes the country's fares.

## Driver Passes and recent rides

- **Driver Passes:** drivers with an active pass, passes sold in 30 days, and the amount. "simulated" means payments are not live yet.
- **Recent rides:** the latest rides and their status.

## Places riders can search

Riders can pick up at a **known name** ("ELWA Junction", "Red Light"). **Only pinned places are offered.**

- `Pin it`: place the pin on the map. Use the **satellite view** to check it is exactly right.
- `Remove`: take a place off the list.
- **New place:** type the name, the area, choose the kind (landmark, junction, market, hospital…), and press `Add and pin it`.

## Mistakes to avoid

- Approving a driver with a missing or expired paper.
- Leaving a safety alert for later.
- Turning a country on before setting its fares and checking its rules.
- Leaving placeholder pass prices on the live site.
- A pin in the wrong place: riders are sent there.
