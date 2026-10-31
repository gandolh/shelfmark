# README images

How each image was made, so the next refresh is a re-run. Re-take an image
when the screen it shows changes.

All of them come from a throwaway clone of the repo running `npm run dev`
against a scratch `DATA_DIR`, signed in as a made-up `demo` account and filled
by [demo-seed.mjs](demo-seed.mjs). The books are classics; the shelves,
prices, dates and notes are invented. No book has a cover file, so every cover
in the images is the one the app draws from the title and author, and no
publisher's artwork appears.

| File | Shows | How to reach that state | Viewport | Taken |
|---|---|---|---|---|
| hero.webp | Library, Covers view, 27 books | Fresh seed, sign in, press Covers | 1440×900 @2x, scaled to 1600 px wide | 2026-10-31 |
| library-table.webp | Table sorted by year, three rows ticked for a bulk edit | Press Table, click the Year header, tick the first three rows; the bulk-edit bar replaces the toolbar | 1440×900 @2x, scaled to 1600 px | 2026-10-31 |
| book-page.webp | The book page for Enigma Otiliei | Click Enigma Otiliei in the table | 1440×900 @2x, scaled to 1600 px | 2026-10-31 |
| phone-search.webp | Search for `padurea` finding Pădurea spânzuraților | `set device "iPhone 14"`, open `/shelfmark/`, type `padurea` in the search box; cropped to the top 1300 px | iPhone 14, 390×844 @3x, crop scaled to 780 px | 2026-10-31 |
| phone-add.webp | Add a book after a lookup that found nothing | Add a book, Type ISBN, `9789730000009` (a made-up ISBN with a valid check digit), Look up. On 2026-10-31 the workspace could reach none of the catalogs, so the note says they didn't answer, and the screen shows the offer to read the CIP block | iPhone 14, scaled to 780 px | 2026-10-31 |

## Not taken

- **The camera scanner.** The headless browser has no camera, so Scan only
  says "No camera found". Try it on a phone with `npm run dev:https`.
- **The "Already in your library" card.** Typing a seeded ISBN shows it, but
  the lookup behind it also fetches that edition's real cover from Open
  Library, which is the publisher's artwork. Leave it out.

## Demo data

1. Clone the repo somewhere outside your working copy and run `npm ci` there.
   Leave out `.env`, or copy `.env.example`, so no Ward values or Google key
   are read.
2. Create the account with the password only in the environment, then start
   the app on a scratch data folder:

   ```bash
   export DATA_DIR=/tmp/shelfmark-demo
   read -rs -p 'Demo password: ' SHELFMARK_PASSWORD && export SHELFMARK_PASSWORD
   SEED_USERNAME=demo SEED_PASSWORD="$SHELFMARK_PASSWORD" npm run seed -w @shelfmark/server
   npm run dev
   ```

3. From another terminal, with the same `SHELFMARK_PASSWORD`:

   ```bash
   SHELFMARK_USER=demo node docs/images/demo-seed.mjs
   ```

   It adds 27 books through `POST /api/books`: fifteen Romanian ones entered
   by hand with no ISBN, and twelve English ones with the ISBN of a Penguin
   Classics edition. It touches no external service.

## Capture method

- Browser: on 2026-10-31, Playwright with Chrome, a 1440×900 @2x context for
  desktop and the `iPhone 14` device for the phone; earlier,
  `agent-browser --session shelfmark-readme` with the same sizes. Sign in through the login page once; the session cookie
  carries over, and so does the column layout, which the app remembers.
- Stills: PNG to WebP with
  `ffmpeg -i in.png -vf scale=1600:-1:flags=lanczos -c:v libwebp -quality 82 out.webp`
  (780 for the phone). The search crop was
  `-vf "crop=1170:1300:0:0,scale=780:-1:flags=lanczos"` on the 1170×2532
  capture.
