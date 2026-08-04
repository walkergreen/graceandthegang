# graceandthegang.com

Static site for **Grace and the Gang** — sketch comedy out of Washington, DC.

Live at **https://www.graceandthegang.com**

Domain registered at **Porkbun**, which also hosts the DNS and forwards
inbound mail. Hosting is GitHub Pages; outbound mail is Resend; form data
lands in a Google Sheet; ticket sales run on **Crowdwork**; traffic is
measured in **Google Analytics 4**.

---

## How it all fits together

```
                    ┌──────────────────────────────┐
  git push main ──► │  GitHub Pages                │
                    │  walkergreen/graceandthegang │
                    └──────────────┬───────────────┘
                                   │ served at
                                   ▼
                    ┌──────────────────────────────┐
                    │  www.graceandthegang.com     │  ← domain + DNS: Porkbun
                    │  index.html (one file)       │  ← GA4 G-QFXVH6RHDS
                    └──────────────┬───────────────┘
                                   │ forms POST JSON
                                   ▼
                    ┌──────────────────────────────┐
                    │  Google Apps Script web app  │  ← bound to the sheet
                    │  /exec                       │
                    └───────┬──────────────┬───────┘
                            │              │
                appends row │              │ sends mail
                            ▼              ▼
              ┌───────────────────┐   ┌──────────────────────────┐
              │ Google Sheet      │   │ Resend API               │
              │ · Newsletter      │   │ from grace@…  (DKIM)     │
              │ · Business Inq.   │   │ → inquirer + notify addr │
              └───────────────────┘   └──────────────────────────┘

  Ticket buttons leave the site entirely → Crowdwork hosts checkout.
  GA4 records the outbound click as `ticket_click` before the hand-off.
```

There is no build step, no framework, and no server. The whole site is one
HTML file plus images.

---

## 1. The website

### Files

```
index.html                 everything — markup, styles, script
CNAME                      www.graceandthegang.com (tells Pages the domain)
assets/
  logo.webp                transparent bubble wordmark (246 KB)
  favicon.svg
  audience.jpg             full house — used on the ticket CTA
  gang-sketchfest-2026.jpg cast poster — also the og:image
  gang-live-sketchfest-2025.jpg
  sf26/                    DC Sketchfest 2026 live shots
  sketchfest24/            DC Sketchfest 2024 live shots
  *.jpg                    Printify product mockups
apps-script/
  Code.gs                  the form receiver (paste into Apps Script)
  appsscript.json          its OAuth manifest
```

17 images, 2.4 MB total.

### Running it locally

```bash
python3 -m http.server 4325
```

### Deploying

Push to `main`. GitHub Pages rebuilds in roughly a minute. Nothing else.

```bash
git add -A && git commit -m "..." && git push
```

### Things you'll actually want to edit

All near the bottom of `index.html`, inside the `<script>`:

| What | Constant |
|---|---|
| Where both forms send | `ENDPOINT` |
| Which reels appear | `REELS` |
| The reel shown to managers | `REP_REEL` |
| Next show date, drives the countdown | `SHOW` |

Everything else — calendar rows, festivals, brand work, merch — is plain
markup in the body.

**Putting a new show on sale** touches four things:

1. `SHOW` — the date/time, which drives the countdown and the past-show state
2. The three Crowdwork links (nav, headliner CTA, calendar row)
3. The headliner copy — title, venue, support act, price line
4. A new `.gig` row in the calendar, and demote the old one to `gig-past`

### After a show passes

`SHOW` drives this automatically. Once the date is more than four hours
past, the page stops selling it: the badge flips to "This show has passed",
the ticket button becomes "See what's next" pointing at the newsletter, and
the calendar row greys out to "Played". Update `SHOW` and the calendar when
the next date is booked.

### Why the reels are YouTube

Instagram's embed renders "this post may have been removed" for perfectly
live public posts inside third-party iframes. YouTube embeds render
reliably, so `REELS` uses `type: 'yt'`. The loader still supports `'ig'`
and `'tt'` if that ever changes.

The cards are click-to-load facades — a thumbnail plus a play button, with
the real player swapped in on click. Six embedded players would pull
megabytes of YouTube JS before anyone pressed play. Thumbnails use
`oardefault.jpg`, the original-aspect still (1080×1920 for a Short), which
fills the 9:16 card without cropping.

The play button and the caption link go different places on purpose: play
loads the YouTube embed, while the caption's "Watch on Instagram" sends
people to the account — where the audience actually lives. Give a reel an
`ig: 'SHORTCODE'` field and its caption deep-links to that specific post
instead; without one it links to the profile's Reels page. The view counts
shown are Instagram totals summed across every post of a sketch.

### Google Analytics

GA4 property **G-QFXVH6RHDS**. The `gtag.js` snippet sits in `<head>`;
verified live, sending page views to `analytics.google.com/g/collect`.

Every meaningful action is also tracked, because a page view alone can't
tell you whether the site is doing its job:

| Event | Fires when | Parameters |
|---|---|---|
| `ticket_click` | any Crowdwork link is clicked | `placement` (headliner / other) |
| `newsletter_signup` | a signup is saved | `form_location` (hero / newsletter_block) |
| `business_inquiry` | an inquiry is saved | `budget`, `timeline` |
| `merch_click` | a Printify product is opened | — |
| `patreon_click` | the Patreon CTA is clicked | — |
| `reel_play` | a reel facade is played | `video_id` |

`track()` is a thin wrapper that no-ops if `gtag` is missing, so an ad
blocker eating googletagmanager.com can't break a form submission.

**To make these count as conversions:** GA4 → Admin → **Events** → mark
`ticket_click` and `business_inquiry` as **Key events**.

Two limits worth knowing. `ticket_click` counts the hand-off to Crowdwork,
**not** a completed purchase — GA can't see checkout, which happens on
Crowdwork's domain. And the budget/timeline parameters need registering as
custom dimensions (Admin → Custom definitions) before they show up in
reports; they're collected either way.

### Ticket sales — Crowdwork

Ticketing is not part of this site. Every ticket button links out to the
Crowdwork event page, which handles checkout, payment and the guest list:

```
https://www.crowdwork.com/e/grace-and-the-gang-summer-sketch-show-and-after-party
```

That URL appears in three places in `index.html` — the nav "Get tickets"
button, the headliner CTA, and the calendar row for the next show. When a
new show goes on sale, all three need the new event URL, alongside `SHOW`
and the calendar entry.

Prices shown on the page (`$20 · $21.94 with fees`) are hard-coded copy and
do not sync with Crowdwork — update them by hand if they change.

---

## 2. DNS — managed at Porkbun

Everything DNS happens in **Porkbun → Domain Management →
graceandthegang.com → DNS**. Porkbun is the registrar *and* the
nameserver (`curitiba/fortaleza/maceio/salvador.ns.porkbun.com`), so there
is no separate DNS provider to check.

Records currently set there:

| Type | Host | Value | Why |
|---|---|---|---|
| A ×4 | apex | `185.199.108–111.153` | GitHub Pages |
| AAAA ×4 | apex | `2606:50c0:800{0..3}::153` | GitHub Pages, IPv6 |
| CNAME | `www` | `walkergreen.github.io` | the canonical host |
| MX | apex | `fwd1` / `fwd2.porkbun.com` | inbound mail forwarding |
| TXT | apex | `v=spf1 include:_spf.porkbun.com ~all` | SPF for forwarding |
| TXT | `resend._domainkey` | (DKIM key) | lets Resend sign as the domain |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF for Resend's sender |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | Resend bounce handling |

`www` is canonical — the apex 301s to it. HTTPS is enforced; the
certificate is issued automatically by GitHub.

All of the below are edited in that same Porkbun DNS panel. Porkbun's
default TTL of 600s is fine; there's no reason to change it.

### Two outstanding DNS items (both in the Porkbun DNS panel)

- **Delete the wildcard** `*.graceandthegang.com` → `uixie.porkbun.com`.
  It makes every unset subdomain look configured, so `_dmarc` and DKIM
  lookups return Porkbun's parking host instead of a clean "not
  configured". `www` has its own record, so nothing depends on it.
- **No DMARC record.** Once mail is settled, add a TXT at `_dmarc`:
  `v=DMARC1; p=none; rua=mailto:grace@graceandthegang.com`. `p=none` only
  reports, so it can't hurt delivery.

---

## 3. Email

### Inbound — Porkbun forwarding

Set up under **Porkbun → Domain Management → Email Forwarding**.
`grace@graceandthegang.com` is a **forward, not a mailbox**. It relays to
Grace and to Walker. There is no password and no outbound SMTP:
`fwd1.porkbun.com` answers on port 25 but refuses 587 and 465, which is why
Gmail's "Send mail as" flow can never be completed with it.

### Outbound — Resend

`sendFrom()` in `Code.gs` tries three routes and degrades quietly rather
than dropping mail:

| | Route | From | Requires |
|---|---|---|---|
| 1 | **Resend API** | `grace@`, DKIM-signed | API key + verified domain |
| 2 | Gmail alias | `grace@` | a real mailbox — **disabled** |
| 3 | MailApp | script owner, reply-to `grace@` | nothing |

Route 2 is off (`USE_GMAIL_ALIAS = false`) on purpose: it needs
`gmail.readonly` / `gmail.settings.basic`, effectively read access to the
inbox, and only works with a mailbox that doesn't exist here.

**`RESEND_API_KEY` is deliberately blank in this repo.** The key lives only
in the Apps Script project. Never commit it.

### What gets sent

Submitting the business form sends two emails:

1. **Notification** → `NOTIFY_BUSINESS`, with reply-to set to the inquirer
2. **Confirmation** → the inquirer, branded, with a copy of what they sent
   and reply-to `grace@`

Newsletter signups send nothing — they'd be noise.

---

## 4. Google Sheet + Apps Script

Sheet: **Grace and the Gang Email Newsletter**. Two tabs, both created
automatically on first submission:

| Tab | Columns |
|---|---|
| `Newsletter` | Timestamp, Name, Email, Source |
| `Business Inquiries` | Timestamp, Name, Company, Email, Budget, Timeline, Project |

Duplicate newsletter addresses are skipped and reported back to the page,
which says "You're already on the list".

### First-time setup

1. Sheet → **Extensions → Apps Script**
2. Paste [`apps-script/Code.gs`](apps-script/Code.gs)
3. **Project Settings** → tick *Show appsscript.json manifest file in
   editor*, then paste
   [`apps-script/appsscript.json`](apps-script/appsscript.json)
4. Run **`authorizeAndTest`** once and approve the consent screen
5. **Deploy → New deployment → Web app**
   — Execute as **Me**, Who has access **Anyone**
6. Copy the `/exec` URL into `ENDPOINT` in `index.html`

### Changing the script later

**Deploy → Manage deployments → pencil → New version.**

Use *Manage deployments*, **not** *New deployment* — editing the existing
one keeps the same `/exec` URL, so `ENDPOINT` stays valid. A new deployment
mints a different URL and the site keeps posting to the old one.

Editing and saving alone changes nothing: a versioned web app serves a
frozen snapshot until you publish a new version.

---

## 5. When something breaks

Open `<your /exec URL>?diag=1`. It reports:

| Field | Meaning |
|---|---|
| `mailScopeGranted` | can the script send mail at all |
| `resendConfigured` | is `RESEND_API_KEY` set |
| `lastSendRoute` | which of the three routes actually sent, and when |
| `lastResendError` | why Resend was skipped, if it was |
| `lastNotifyError` / `lastConfirmError` | last failure per email |
| `businessHeaders` | proves which code version is deployed |

### The trap that caused most of the trouble

**Adding a new Google API needs a new OAuth scope, and nothing prompts you
for it.** Not saving, not deploying a new version. The call just throws and
the `catch` hides it, so mail silently stops.

Worse: if the manifest lists `oauthScopes` explicitly, that list *overrides*
Apps Script's auto-detection — so a newly used API can never be granted, no
matter how many times you run or redeploy. That's why
`apps-script/appsscript.json` exists and lists exactly three scopes: the
active spreadsheet, sending mail, external requests.

After any change touching a new API: update the manifest, run
`authorizeAndTest`, approve, then publish a new version.

---

## Credits

Live performance photography by **Mikail Faalasli**.
Site by [Walker Green](https://instagram.com/guywalks).
