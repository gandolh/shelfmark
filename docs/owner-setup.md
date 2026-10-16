# Owner setup

Everything you do by hand to put Shelfmark on the VPS, and the checks that wait
on a phone or a spreadsheet program. Nothing in the repo deploys or writes a
secret for you. Commands run on your machine unless a step says otherwise. The
deploy builds the API image on the VPS. Local development is in
[getting-started.md](getting-started.md).

`<production origin>` below means `https://` plus your site's host, with no path.

## 1. Get a Google Books API key

Optional. Without it, book lookups skip Google Books and use the other sources.

1. In the Google Cloud console, create a project (or pick one).
2. Enable the "Books API" for it (APIs & Services, Library).
3. Create an API key (APIs & Services, Credentials). Under "API restrictions",
   restrict it to the Books API.
4. Keep the key for step 3 and the local `.env`.

For local development, put it in `.env` in the repo root (git-ignored):

```
GOOGLE_BOOKS_API_KEY=<the key>
```

## 2. Register Shelfmark in production Ward

The adoption guide is `../wzd_auth/shared-library/README.md`. Satchel was
registered the same way.

1. Open `/ward/console` on the production site and sign in as the break-glass
   superuser.
2. Create an app with slug `shelfmark` and name `Shelfmark`, with public
   registration closed.
3. Make the client's key pair, from Ward's repo root:

   ```
   cd ~/projects/wzd_auth && npm run oidc-client-key --workspace=api -- shelfmark
   ```

   It prints a private `WARD_OIDC_CLIENT_KEY=...` line and a public JWK. Keep
   the private line for step 3. Never paste it into Ward.
4. On the app's page, under "Sign in with Ward", register a client with the
   public JWK and these addresses:
   - redirect URI: `<production origin>/shelfmark-api/auth/ward/callback`
   - sign-out return URI: `<production origin>/shelfmark/`
5. Redeploy Ward's UI, so its login allowlist knows `/shelfmark/`:

   ```
   cd ~/projects/vps-deploy && node cli.ts ward deploy
   ```

## 3. Write the deploy secrets

Create `~/projects/vps-deploy/secrets/shelfmark.env` with two lines, then
`chmod 600` it:

```
WARD_OIDC_CLIENT_KEY=<the private key from step 2>
GOOGLE_BOOKS_API_KEY=<the key from step 1>
```

The deploy adds everything else (the origin, the other Ward settings, the
trusted proxy range). Leave `GOOGLE_BOOKS_API_KEY` out to run without Google.

## 4. Check the container locally

Docker Desktop's WSL integration must be on. From the repo root:

```
touch infrastructure/.env
docker compose -f infrastructure/docker-compose.yml up --build -d
curl -s http://127.0.0.1:8796/api/health
```

Expect `{"ok":true}`. The database appears as `data/shelfmark.db` in the repo
(git-ignored). Stop it with:

```
docker compose -f infrastructure/docker-compose.yml down
```

## 5. Deploy

Dry run first. It prints every action and runs none:

```
cd ~/projects/vps-deploy
node cli.ts shelfmark all --dry-run
```

Then the real one. It asks for the server sudo password once, builds the web
app, ships it, and builds and starts the API container:

```
node cli.ts shelfmark all
```

Later updates:

```
node cli.ts shelfmark deploy   # the web app
node cli.ts shelfmark server   # the API container
```

Check the container is healthy and the PWA files are served right:

```
curl -s <production origin>/shelfmark-api/api/health
curl -sI <production origin>/shelfmark/sw.js
curl -sI <production origin>/shelfmark/manifest.webmanifest
```

The first prints `{"ok":true}`; the others return `200`. To check the scanner's
`.wasm` file, find its name on the box and ask for it:

```
ssh hetzner-svc ls /var/www/shelfmark/current/assets | grep wasm
curl -sI <production origin>/shelfmark/assets/<that file name> | grep -i content-type
```

Expect `content-type: application/wasm`.

Caching: vps-deploy's web-service pattern cannot set `Cache-Control`, so
`sw.js`, `manifest.webmanifest` and `index.html` are not marked `no-cache`, and
`assets/` is not marked `immutable`. Caddy sends `ETag` and `Last-Modified`, so
browsers revalidate and a new deploy reaches the phone, possibly after a reload
or a day. If an update seems stuck, close and reopen the app. Adding the headers
means a change to vps-deploy's Caddy constructs, which this setup does not make.

## 6. Create your account

There is no register page. Run the seed inside the container on the VPS. It
asks for the username and password and shows neither on screen, so nothing is
stored or lands in shell history:

```
ssh hetzner-svc
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
cd /srv/shelfmark-api
docker compose -f infrastructure/docker-compose.yml exec -it shelfmark-api node server/dist/seed.js
```

If you would rather pass them, add `-e SEED_USERNAME=<name> -e SEED_PASSWORD=<password>`
after `exec`, and keep the command out of any file. An existing user is left as it is.

After your first sign-in, check that the login lockout sees each visitor's own
address. Under rootless Docker, Caddy may reach the container from an address
outside `172.16.0.0/12`, the range vps-deploy trusts:

```
docker compose -f infrastructure/docker-compose.yml logs shelfmark-api | grep -i "X-Forwarded-For ignored"
```

No output is right. If the line shows up, every visitor shares one lockout
counter, so five wrong passwords from anyone lock everyone out for a while.
The line names the address Caddy came from; trust that range in vps-deploy's
`AUTH_TRUSTED_PROXIES` for this stack and deploy again.

## 7. Let your Ward account in

In Ward's console, open the `shelfmark` app and grant your own Ward account a
role on it. Without a grant Ward refuses the sign-in. After the first "Sign in
with Ward", Shelfmark makes a local user linked to that account. To link it to
the local account you made in step 6 instead, sign in locally and use "Sign in
with Ward" in the account menu.

## 8. Open it and install it on the phone

Open `<production origin>/shelfmark/`, sign in, then install it: on Android
Chrome use Install app; on iPhone Safari use Share, then Add to Home Screen. The
install checks are in [12-pwa.md](../corpus/briefs/done/12-pwa.md).

## Backups

Download one: account menu, Download a backup. It is the whole database file,
covers included. It also holds the password hash and sessions, so keep it
private.

Restore one, on the VPS (same `ssh` and `DOCKER_HOST` lines as step 6):

```
cd /srv/shelfmark-api
docker compose -f infrastructure/docker-compose.yml stop shelfmark-api
rm -f data/shelfmark.db-wal data/shelfmark.db-shm
cp <the backup file> data/shelfmark.db
docker compose -f infrastructure/docker-compose.yml start shelfmark-api
```

Remove the `-wal` and `-shm` files before the copy: a stale one would be
replayed onto the restored database. Copy the file onto the VPS first, for
example with `scp`.

## Owner checks waiting from earlier briefs

- **Scanner on Android and iPhone**: the steps are in the outcomes of
  [07-camera-scanner.md](../corpus/briefs/done/07-camera-scanner.md) and
  [09-add-a-book-page.md](../corpus/briefs/done/09-add-a-book-page.md). Once the
  app is live, try them on the production site (HTTPS is already there).
- **Ward round trip, locally**: needs Docker Desktop's WSL integration. See
  [06-accounts-and-sign-in.md](../corpus/briefs/done/06-accounts-and-sign-in.md).
- **PWA install**: step 8, details in
  [12-pwa.md](../corpus/briefs/done/12-pwa.md).
- **CSV and XLSX exports in Excel**: open both files; see
  [11-export-and-backup.md](../corpus/briefs/done/11-export-and-backup.md).
- **Google measurement**: once the key exists, run `server/scripts/measure-lookup.ts`
  on the Romanian samples as described in
  [05-lookup-and-covers.md](../corpus/briefs/done/05-lookup-and-covers.md), and
  record the numbers in `corpus/wiki/metadata-lookup.md`.
