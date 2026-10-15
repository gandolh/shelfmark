# Shelfmark

A catalog of the physical books the owner has at home. Scan a book's barcode with
the phone, and it lands in a table you can sort, filter and export to CSV or
Excel. A React PWA on a Fastify + SQLite API.

It is being built brief by brief. The plan, the research and the work queue
live in [corpus/](corpus/index.md).

## Run it locally

```sh
npm install
npm run dev
```

Open `http://localhost:5176/shelfmark/`. To try the scanner on a phone, run
`npm run dev:https` and open the same path on the computer's LAN address over
HTTPS (the camera needs a secure origin).

## Owner setup

The first deploy, the Ward registration, creating your account, backups and the
checks that wait on a phone: [docs/owner-setup.md](docs/owner-setup.md).
