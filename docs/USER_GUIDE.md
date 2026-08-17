# User Guide

How to use Marketeers Club day to day. The walkthrough follows the Ann and Bob scenario from the project
brief, so you can read it start to finish or jump to the section you need.

- [Core idea](#core-idea)
- [Getting started](#getting-started)
- [Teams](#teams)
- [Inventory](#inventory)
- [Trips](#trips)
- [Agreements](#agreements)
- [After the trip](#after-the-trip)
- [Notifications](#notifications)
- [Privacy](#privacy)
- [FAQ](#faq)

---

## Core idea

You keep a private catalog of merchandise. Friends in your team post **trips** — shows, markets, or
conventions they are attending. You can ask a traveling friend to sell some of your items for you, and
they earn a commission on each unit sold.

Nothing is binding until **both people approve the same terms**. Your inventory count changes only when
you personally confirm you received your money and unsold items back.

## Getting started

1. Open the app and choose **Create your account**.
2. Enter a display name, email, and password. Your display name is how teammates find you, so use
   something they will recognize.
3. Sign in. You land on **Overview**, which summarizes upcoming trips, your catalog, agreements waiting on
   you, and unread notices.

Navigation lives in the left sidebar on a computer. On a phone, tap the menu button in the top bar.

> If the sign-in screen shows a configuration notice and the button is disabled, the app has not been
> connected to a database yet. See the [Deployment Guide](DEPLOYMENT.md).

## Teams

Teams are your friend groups. You only see trips from people you share a team with.

**Create a team**

1. Go to **Teams** → **Create your first team**.
2. Name it and confirm. You become the team owner automatically.

**Invite people**

1. Open your team and search by display name.
2. Send the invitation. Search shows names only — never inventory.

**Accept an invitation**

Invitations appear under **You've been invited** on the Teams page and as a notification. Membership is
`pending` until you accept, and pending members cannot see the team's trips.

> Only the team owner can invite members.

## Inventory

Your catalog is **private**. No teammate can browse it.

**Add an item**

1. Go to **Inventory** → **Add your first item**.
2. Enter a name, and optionally a SKU, description, quantity on hand, and default price.

In the running example, Bob adds `Robot Dog` with a quantity of `20` and a default price of `$50.00`.

Use the search box to filter by name or SKU. Edit an item any time to correct counts or pricing.

## Trips

A trip announces that you are traveling somewhere and can carry merchandise.

**Publish a trip**

Go to **Trips** → **Plan a trip** and fill in:

| Field | Meaning | Example |
| --- | --- | --- |
| Trip title | Where you are going | `Going to Tradeshow in DC` |
| Team | Which team can see it | `Makerspace Friends` |
| Event date and time | When the event happens | `Oct 5, 2026, 9:00 AM` |
| Pickup time | When you collect merchandise | `Oct 4, 2026, 3:00 PM` |
| Pickup location | Where you collect it | `Local makerspace, 1234 Dr. Leesburg` |
| Return time | When you hand everything back | `Oct 6, 2026, 3:00 PM` |
| Return location | Where you hand it back | Leave blank to reuse the pickup location |
| Note | Anything teammates should know | `Have to get gas on the way back so may be late` |

Every time is captured **to the minute**, and pickup and return locations are separate fields, so
"same place, different day" is one click while a different drop-off point is fully supported.

Pickup must be on or before the event, and return on or after it. Teammates see the trip under
**Trips** as soon as you publish it. Past trips are listed separately at the bottom of the page.

## Agreements

An agreement is the contract for one item on one trip.

**Propose merchandise (the item owner)**

1. Go to **Agreements** → **Make a proposal**.
2. Pick the trip, the item, the quantity, the sale price per unit, and the commission per unit.
3. Send it.

Bob proposes `10` robot dogs at `$50.00` each with a `$5.00` commission per dog on Ann's DC trip.

Sending a proposal counts as **your** approval of version 1. The seller is notified immediately.

**Respond (the seller)**

Ann opens **Agreements** and can either:

- **Approve** — both sides now agree, and the agreement becomes `Approved`.
- **Request change** — adjust quantity, price, or commission and explain why. This creates a new version
  and Bob must approve it.

Either side can request a change, and the loop can repeat as often as needed. The rule never varies:

> Whenever anyone changes the terms, the other person's approval is cleared and they must approve again.

Each card shows the current terms version, so you always know what you are agreeing to. Change requests
require a short message, which is kept as a record on the agreement.

**Availability check**

When the second approval lands, the app verifies that your uncommitted stock still covers the agreement.
If you have already promised those units to another trip, approval is refused rather than silently
overcommitting you.

## After the trip

**1. Seller reports sales**

Ann returns from DC and opens the agreement → **Report sales**, entering how many units sold. She sold
`5` of the `10` robot dogs. Bob is notified.

The app calculates the settlement:

| | |
| --- | --- |
| Gross sales | 5 × $50.00 = **$250.00** |
| Commission | 5 × $5.00 = **$25.00** |
| Payout to owner | **$225.00** |
| Unsold items to return | **5** |

**2. Meet up**

Use the trip's return time and location for the handoff. Ann brings Bob $225.00 and the 5 unsold dogs.

**3. Owner confirms**

Bob confirms he received the money and merchandise. Only now does his inventory update: `20 − 5 = 15`
robot dogs. Ann is notified that the agreement is settled.

Because settlement is the only step that touches inventory, an unconfirmed trip never silently changes
your counts.

### Status reference

| Status | Meaning | Who acts next |
| --- | --- | --- |
| `Proposed` | Waiting on the seller's first response | Seller |
| `Changes requested` | Terms changed; needs the other party's approval | The other party |
| `Approved` | Both parties agreed; the trip can proceed | Seller, after the trip |
| `Reported` | Seller submitted results | Owner |
| `Settled` | Payout and returns confirmed; inventory updated | Nobody — complete |
| `Cancelled` | Called off | Nobody |

## Notifications

The bell page lists everything that needs your attention: team invitations, new proposals, term changes,
approvals, sales reports, and settlements. New items arrive live — no refresh required. Unread entries
show a dot; opening one marks it read and jumps to the relevant page.

## Privacy

- Your inventory is visible only to you. The one exception is a seller who has an agreement for a
  specific item, and they see only that item.
- Member search returns display names only.
- Trips are visible only to **active** members of the team they were posted to.
- Agreements and their messages are visible only to the two people involved.

These rules are enforced by the database, not just the interface.

## FAQ

**Can I sell for myself without a teammate?**
Trips are for lending merchandise between people, so an agreement always involves two different users.
Track your own sales by adjusting your item quantity directly.

**What if the seller loses items or sells at a different price?**
Request a change on the agreement before reporting sales, so the recorded terms match what happened.

**Can I cancel?**
Yes — before settlement. Cancelled agreements never touch inventory.

**Why didn't my inventory drop right after the trip?**
By design. Inventory changes only when you confirm the handoff, which keeps your counts accurate if a
meetup is delayed.

**I can't see my friend's trip.**
Confirm you both belong to the same team and that the invitation was **accepted**. Pending members cannot
see trips.
