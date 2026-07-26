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

### Why the reels are YouTube

Instagram's embed renders "this post may have been removed" for perfectly
live public posts in third-party iframes. YouTube embeds render reliably,
so `REELS` uses `type: 'yt'`. The loader still supports `'ig'` and `'tt'`
if that ever changes.

## Photo credit

Live performance photography by **Mikail Faalasli**.
