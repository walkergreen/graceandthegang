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
| Newsletter signups | `LIST` config |
| Business inquiries | `BIZ` config |
| Which reels appear | `REELS` array |
| The reel shown to managers | `REP_REEL` |
| Next show date + countdown | `SHOW` |

### Wiring the two forms

A Google Sheet can't receive form posts directly, so each form posts to a
Google Form that feeds a sheet. For each one:

1. In the destination sheet: **Tools → Create a new form**.
2. Add the questions (newsletter: Name, Email — business: Name, Company,
   Email, Budget range, Timeline).
3. Open the live form, View Source, search for `entry.` — you'll find one
   id per question.
4. Paste the form's `.../formResponse` URL and the entry ids into the config.

Until a config is filled in, that form falls back to opening a pre-filled
email so no submission is lost.

## Photo credit

Live performance photography by **Mikail Faalasli**.
