# graceandthegang.com

Static site for **Grace and the Gang** — sketch comedy out of Washington, DC.

One file, no build step, no dependencies. Open `index.html` or serve the folder.

```bash
python3 -m http.server 4325
```

## Layout

```
index.html            everything — markup, styles, script
assets/
  logo.webp           the bubble wordmark
  gang-sketchfest-2026.jpg
  gang-live-sketchfest-2025.jpg
  sketchfest24/       live shots, DC Improv 2024 (photos: Mikail Faalasli)
  *.jpg               Printify product mockups
```

## Things you'll want to edit

All of these are near the bottom of `index.html`, in the `<script>`:

| What | Where |
|---|---|
| Where both forms send | `ENDPOINT` |
| Which reels appear | `REELS` array |
| The reel shown to managers | `REP_REEL` |
| Next show date + countdown | `SHOW` |

### Wiring the forms

Both forms post to one Apps Script web app that writes straight into the
**Grace and the Gang Email Newsletter** spreadsheet — signups to a
`Newsletter` tab, brand inquiries to a `Business Inquiries` tab. Both tabs
are created automatically on first submission, and duplicate newsletter
emails are skipped.

Setup is in [`apps-script/Code.gs`](apps-script/Code.gs) — paste it into
the sheet's Apps Script editor, deploy as a web app with access set to
**Anyone**, then put the `/exec` URL into `ENDPOINT`.

Business inquiries also email `NOTIFY_BUSINESS` on arrival. Sending needs
an OAuth scope that writing a row doesn't, and neither pasting new code nor
"Deploy → New version" re-prompts for it — so after any change that touches
email, run any function once from the editor and approve the consent screen.
Check it with `<your /exec URL>?diag=1`: you want `"mailScopeGranted": true`.

Until `ENDPOINT` is set, submitting shows an inline note pointing at
grace@graceandthegang.com. It never opens a mail client.

### Sending the confirmation from grace@graceandthegang.com

Porkbun's **free forwarding is not a mailbox**, so the Gmail "Send mail as"
route cannot work. `fwd1.porkbun.com` is inbound only — port 25 answers,
587 and 465 refuse the connection — so the SMTP server Gmail auto-suggests
will never authenticate, and there is no password to enter because there is
no account.

`sendFrom()` therefore tries three routes in order and degrades quietly:

| | Route | From address | Needs |
|---|---|---|---|
| 1 | Resend API | `grace@`, DKIM-signed | free account + DNS records |
| 2 | Gmail alias | `grace@` | a real mailbox (paid hosting) |
| 3 | MailApp | script owner, reply-to `grace@` | nothing — works today |

**To get route 1:** create a free account at resend.com, add the domain
`graceandthegang.com`, copy the DKIM/SPF records it gives you into Porkbun
DNS, wait for "Verified", then paste an API key into `RESEND_API_KEY`.

**Delete the wildcard DNS record first.** `*.graceandthegang.com` →
`uixie.porkbun.com` makes every unset subdomain look configured, so DKIM
lookups like `resend._domainkey` and `_dmarc` return Porkbun's parking host
instead of a clean "not configured". `www` has its own CNAME, so nothing
depends on the wildcard.

### If Resend keeps falling back to MailApp

Symptom: `?diag=1` shows `resendConfigured: true` but
`lastSendRoute: mailapp`, and `lastResendError` says

> You do not have permission to call UrlFetchApp.fetch.
> Required permissions: .../auth/script.external_request

Running a function does **not** always prompt for the missing scope. If the
project has an explicit `oauthScopes` list in its manifest, that list
overrides Apps Script's auto-detection — it requests exactly those scopes
and nothing else, so a newly added API silently has no permission.

Fix:

1. Apps Script → **Project Settings** (gear) → tick
   *"Show appsscript.json manifest file in editor"*
2. Open `appsscript.json` and replace it with
   [`apps-script/appsscript.json`](apps-script/appsscript.json)
3. Run `authorizeAndTest` — it should now show a consent screen. Approve it.
4. Deploy → Manage deployments → pencil → New version

The manifest requests only what this script actually uses: the active
spreadsheet, sending mail, and external requests. The Gmail-alias fallback
is disabled (`USE_GMAIL_ALIAS = false`) precisely so the invasive
`gmail.*` scopes are never requested.

### Why the reels are YouTube

Instagram's embed renders "this post may have been removed" for perfectly
live public posts in third-party iframes. YouTube embeds render reliably,
so `REELS` uses `type: 'yt'`. The loader still supports `'ig'` and `'tt'`
if that ever changes.

## Photo credit

Live performance photography by **Mikail Faalasli**.
