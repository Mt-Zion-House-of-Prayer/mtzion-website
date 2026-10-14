# Mt Zion House of Prayer website — instructions for Claude

Static site for Mt Zion House of Prayer, a Mennonite church at 20875 Clutter Rd,
Utica, OH 43080. Plain HTML/CSS/JS, no build step, hosted on Netlify from GitHub.
The people updating it are NOT coders. Explain changes in plain words, keep edits
small, and always show the result in the preview before committing.

## Hosting

- Code: https://github.com/Mt-Zion-House-of-Prayer/mtzion-website (public — Netlify's
  free plan can't deploy private org repos). Anything committed here is public.
- Live: https://mtzionhouseofprayer.netlify.app (Netlify project `mtzionhouseofprayer`,
  in Austin's personal Netlify team). Every push to `main` deploys automatically in
  about a minute — so preview locally first; there is no staging step.
- The real domain `mtzionhouseofprayer.org` still points at the old WordPress site.
  Don't move it until sermon audio is off WordPress (see Migration status).

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
| `bulletins/` | Bulletin PDFs, named `YYYY-MM-DD.pdf` (the Sunday date). Last 3 months only |
| `scripts/prune_bulletins.py` | Weekly cleanup of bulletins older than 3 months |

The header and footer are copied into all four HTML pages. A change to the nav,
address, or service times must be made in **every** page (and the hero/visit text
where times appear). Grep for the old text to find every copy.

## Admin page (sermon + bulletin uploads)

`/admin/` (linked as "Admin" in the footer) lets volunteers post without Claude:
one shared password (kept in the church's 1Password vault) plus their name, which
is recorded in each commit message.

- `admin/index.html` — the page. Sermon flow: `admin-upload-url` returns a presigned
  link → the browser PUTs the MP3 straight to Cloudflare R2 → `admin-add-sermon`
  adds the entry to `data/sermons.json`. Bulletins go through `admin-add-bulletin`
  (PDF ≤ 4 MB, committed into `bulletins/`). `admin-remove` takes either back off.
- `netlify/functions/*.mjs` + `netlify/lib/shared.mjs` — no npm dependencies.
  Each function commits to GitHub through the API, which triggers a redeploy.
- Settings live in Netlify environment variables (listed at the top of
  `netlify/lib/shared.mjs`), never in the repo. `GITHUB_BRANCH` can point the
  functions at a test branch.
- Test locally: `ADMIN_PASSWORD=x GITHUB_BRANCH=<test-branch> GITHUB_TOKEN=... netlify dev --offline`
  — never test against `main`, every commit there goes live.

## Podcast

`scripts/build_feed.py` runs on every Netlify deploy and writes `podcast.xml` from
`data/sermons.json` + `data/podcast.json` (show title, owner email, cover art).
Apple Podcasts / Spotify poll that feed. Each sermon's `guid` is its permanent
episode ID — never change or reuse one, or apps re-download/duplicate episodes.
`size` (bytes) and `length` should be set for every entry. Cover art:
`images/podcast-cover.jpg` (3000×3000).

## Common tasks

**Add this week's bulletin:** save the PDF as `bulletins/YYYY-MM-DD.pdf` (Sunday's
date), then add `{"date": "YYYY-MM-DD", "file": "bulletins/YYYY-MM-DD.pdf"}` at the
TOP of `data/bulletins.json`. The list must stay newest-first — the home page
shows the first entry as "this week's".

**Bulletins only stay up for 3 months** (church decision, Oct 2026 — they contain
birthdays, phone numbers, attendance and offering totals). The bulletins page hides
anything older, and `.github/workflows/prune-bulletins.yml` runs
`scripts/prune_bulletins.py` every Monday to delete older PDFs and their JSON
entries, then commits — which redeploys the site. Don't re-add old bulletins.

**Add a sermon:** normally done on the Admin page. By hand: add an entry to
`data/sermons.json` (newest-first) with `date`, `title`, `speaker`, `type`
("Sunday Message"), `passage` (may be ""), `length` ("00:36:23"), `audio` (direct
MP3 URL), `size` (bytes), and a new unique `guid`. Use speaker names exactly as they already appear so the filter
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
- 166 bulletins were imported, then pruned to the last 3 months (see above). The
  full archive still exists on the old WordPress site until it is shut down.
- Old site's About/Watch pages were template filler; no real content to carry over.
