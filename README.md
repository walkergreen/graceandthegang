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

The auto-reply can appear to come from `grace@`, but three things must all
be true. `MailApp` has no `from` option at all — only `GmailApp` does, and
only for a **verified alias** on the account that owns the script.

1. **Verify the alias.** In that Google account: Gmail → Settings →
   Accounts and Import → *Send mail as* → Add another email address →
   `grace@graceandthegang.com`, "Treat as an alias". Google emails a code;
   Porkbun forwarding delivers it. Enter it.
2. **Authorise the wider scope.** `GmailApp` needs more than `MailApp`, so
   run any function once from the editor and approve the new consent screen.
   Run `checkAliases()` — it logs whether the alias is ready.
3. **Fix SPF, or it lands in spam.** The domain currently publishes
   `v=spf1 include:_spf.porkbun.com ~all`, which does not authorise Google
   to send for it. Change the TXT record at the apex to:

   ```
   v=spf1 include:_spf.porkbun.com include:_spf.google.com ~all
   ```

Until the alias is verified, `sendFrom()` falls back to `MailApp` and mail
still goes out — just from the script owner's address. It degrades rather
than breaking.

**Also delete the wildcard DNS record.** `*.graceandthegang.com` →
`uixie.porkbun.com` makes `_dmarc` and `google._domainkey` resolve to
Porkbun's parking host, so DKIM and DMARC lookups return junk instead of
"not configured". It serves no purpose now that `www` has its own CNAME.

### Why the reels are YouTube

Instagram's embed renders "this post may have been removed" for perfectly
live public posts in third-party iframes. YouTube embeds render reliably,
so `REELS` uses `type: 'yt'`. The loader still supports `'ig'` and `'tt'`
if that ever changes.

## Photo credit

Live performance photography by **Mikail Faalasli**.
