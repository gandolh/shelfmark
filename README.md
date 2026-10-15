# Shelfmark

A catalog of the physical books the owner has at home. Scan a book's barcode with
the phone, and it lands in a table you can sort, filter and export to CSV or
Excel. A React PWA on a Fastify + SQLite API.

Version 1 is built and not yet deployed. The plan, the research, the
decisions and the work queue live in [corpus/](corpus/index.md); the design
system as built is in [DESIGN.md](DESIGN.md).

## Run it locally

```sh
npm install
cp .env.example .env   # optional, the defaults work
npm run seed -w @shelfmark/server
npm run dev
```

The seed step creates the account you sign in with: it asks for a username and
password on the terminal, or reads `SEED_USERNAME` and `SEED_PASSWORD` from the
environment. They are stored nowhere but the database.

Open `http://localhost:5176/shelfmark/`. To try the scanner on a phone, run
`npm run dev:https` and open the same path on the computer's LAN address over
HTTPS (the camera needs a secure origin).

## Owner setup

The first deploy, the Ward registration, creating your account, backups and the
checks that wait on a phone: [docs/owner-setup.md](docs/owner-setup.md).
