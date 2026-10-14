# Mt Zion House of Prayer website — instructions for Claude

Static site for Mt Zion House of Prayer, a Mennonite church at 20875 Clutter Rd,
Utica, OH 43080. Plain HTML/CSS/JS, no build step, hosted on Netlify from GitHub.
The people updating it are NOT coders. Explain changes in plain words, keep edits
small, and always show the result in the preview before committing.

## Design

The page *format* is modeled on our mother church's site, Gospel Haven
(gospelhavenchurch.com): photo hero, three big tiles (Listen / Bulletin / Visit),
photo + text rows, gray footer. The *identity* is Mt Zion's own: brick red taken
from our building, Marcellus headings that echo the MtZion logo, and our own photos
and wording. Never copy Gospel Haven's text, photos, or logo.

Photos: `images/church.jpg` (hero) and `images/church-building.jpg` (crop) are the
only real Mt Zion photos so far. More photos of people and services would help most.

## Layout

| File | What it is |
|---|---|
| `index.html` | Home: welcome, service times, latest sermon + bulletin, map |
| `visit.html` | Plan a visit / who we are |
| `sermons.html` | Searchable sermon list (filled from `data/sermons.json`) |
| `bulletins.html` | Bulletins by year (filled from `data/bulletins.json`) |
| `css/style.css` | All styling. Colors are variables at the top |
| `js/site.js` | Renders the lists. Rarely needs editing |
| `bulletins/` | Bulletin PDFs, named `YYYY-MM-DD.pdf` (the Sunday date) |

The header and footer are copied into all four HTML pages. A change to the nav,
address, or service times must be made in **every** page (and the hero/visit text
where times appear). Grep for the old text to find every copy.

## Common tasks

**Add this week's bulletin:** save the PDF as `bulletins/YYYY-MM-DD.pdf` (Sunday's
date), then add `{"date": "YYYY-MM-DD", "file": "bulletins/YYYY-MM-DD.pdf"}` at the
TOP of `data/bulletins.json`. The list must stay newest-first — the home page
shows the first entry as "this week's".

**Add a sermon:** add an entry at the TOP of `data/sermons.json` with `date`,
`title`, `speaker`, `type` ("Sunday Message"), `passage` (may be ""), `length`
("00:36:23" style, may be ""), and `audio` (a direct URL to the MP3). Keep
newest-first. Use speaker names exactly as they already appear so the filter
groups them (it's "Chris Geiser", not "Cris").

**Change service times / address:** update all four HTML pages (hero, footer,
visit cards, map links). Times appear as "9:30 AM" and "10:30 AM".

## Rules

- Never commit audio files. Sermon MP3s are ~25 MB each; audio lives on the
  podcast host (or, until that's set up, the old WordPress site) and is linked
  by URL.
- Keep it dependency-free: no frameworks, no npm, no build step.
- Preview locally before committing: `python3 -m http.server 8000` in this folder,
  then open http://localhost:8000 (the lists use fetch, so opening the HTML file
  directly won't load them).
- Text marked `<!-- TODO -->` is placeholder copy written before the church
  supplied its own. Replace it with the church's words, don't embellish it.

## Migration status (from the old WordPress site, Oct 2026)

- 251 sermons imported into `data/sermons.json`. `audio` URLs still point at
  `mtzionhouseofprayer.org/wp-content/uploads/sermons/...` — they must be moved to
  the podcast host and the URLs rewritten BEFORE the old WordPress hosting is shut off.
- 166 bulletins imported as PDFs (Nov 2019 – Oct 2026). Gaps (late 2021 – late
  2024, Jul–Sep 2026) are gaps on the old site too.
- Old site's About/Watch pages were template filler; no real content to carry over.
