// Demo data for the README images. Run it against a SCRATCH database only,
// never against data/ in a checkout you use:
//
//   SHELFMARK_USER=demo SHELFMARK_PASSWORD=... node docs/images/demo-seed.mjs [api]
//
// Start the server with DATA_DIR pointing at a scratch folder, create the user
// there first (`npm run seed -w @shelfmark/server`), then run this. [api] is
// the API without the browser prefix, http://127.0.0.1:8808 by default. Every
// book goes in through POST /api/books, the route the app's own forms use.
//
// The books are classics. The Romanian ones are entered by hand with no ISBN,
// the way most Romanian books land in Shelfmark; the English ones carry the
// ISBN of a Penguin Classics edition. None has a cover file, so the app draws
// its own typographic covers and no publisher's artwork appears in the images.
// Shelves, prices, dates and notes are made up. To start over, stop the server
// and delete the scratch folder.
/* global process, console, fetch */

const api = process.argv[2] ?? "http://127.0.0.1:8808";
const { SHELFMARK_USER: username, SHELFMARK_PASSWORD: password } = process.env;
if (!username || !password) {
  console.error("Set SHELFMARK_USER and SHELFMARK_PASSWORD to the scratch user's sign-in.");
  process.exit(1);
}

const login = await fetch(`${api}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
if (!login.ok) throw new Error(`Sign-in failed: ${login.status}`);
const cookie = login.headers.get("set-cookie").split(";")[0];

const ro = { language: "ro", currency: "RON", metadataSource: "manual" };
const en = { language: "en", currency: "RON", metadataSource: "manual", publisher: "Penguin Classics" };

// Oldest first: the Library lists the newest first, so the last book here
// opens the Covers view.
const books = [
  { ...ro, title: "Hanu-Ancuței", authors: ["Mihail Sadoveanu"], publisher: "Minerva", publishedYear: 1985, pages: 212, shelf: "Study · B2", status: "read", rating: 4, format: "paperback", condition: "worn", acquiredFrom: "Second-hand market", priceMinor: 800, tags: ["classic", "short stories"] },
  { ...en, title: "The Odyssey", authors: ["Homer"], isbn13: "9780140268867", publishedYear: 1997, pages: 541, shelf: "Study · B1", status: "reading", format: "paperback", condition: "good", acquiredFrom: "Bookshop", acquiredOn: "2024-03-02", priceMinor: 6500, tags: ["classic", "poetry"] },
  { ...ro, title: "Concert din muzică de Bach", authors: ["Hortensia Papadat-Bengescu"], publisher: "Minerva", publishedYear: 1987, pages: 304, shelf: "Study · B2", status: "unread", format: "paperback", condition: "worn", acquiredFrom: "Library sale", priceMinor: 500, tags: ["classic"] },
  { ...en, title: "Middlemarch", authors: ["George Eliot"], isbn13: "9780141439549", publishedYear: 2003, pages: 880, shelf: "Living room · A1", status: "abandoned", format: "paperback", condition: "good", notes: "Stopped at book four. Try again in winter.", tags: ["classic"] },
  { ...ro, title: "Fram, ursul polar", authors: ["Cezar Petrescu"], publisher: "Ion Creangă", publishedYear: 1979, pages: 160, shelf: "Bedroom", status: "read", rating: 5, format: "hardcover", condition: "worn", acquiredFrom: "Gift", tags: ["childhood"] },
  { ...en, title: "Moby-Dick", subtitle: "or, The Whale", authors: ["Herman Melville"], isbn13: "9780142437247", publishedYear: 2003, pages: 720, shelf: "Living room · A1", status: "unread", format: "paperback", condition: "new", acquiredFrom: "Bookshop", acquiredOn: "2025-11-20", priceMinor: 5900, tags: ["classic", "sea"] },
  { ...ro, title: "Craii de Curtea-Veche", authors: ["Mateiu I. Caragiale"], publisher: "Polirom", publishedYear: 2014, pages: 176, shelf: "Living room · A2", status: "read", rating: 5, format: "paperback", condition: "good", acquiredFrom: "Bookshop", priceMinor: 2400, tags: ["classic"] },
  { ...en, title: "Anna Karenina", authors: ["Leo Tolstoy"], isbn13: "9780143035008", publishedYear: 2004, pages: 838, shelf: "Living room · A1", status: "read", rating: 5, format: "paperback", condition: "good", acquiredFrom: "Bookshop", priceMinor: 6900, tags: ["classic", "russian"] },
  { ...ro, title: "Patul lui Procust", authors: ["Camil Petrescu"], publisher: "Litera", publishedYear: 2011, pages: 320, shelf: "Living room · A2", status: "unread", format: "paperback", condition: "good", acquiredFrom: "Bookshop", priceMinor: 2900, tags: ["classic"] },
  { ...en, title: "Dracula", authors: ["Bram Stoker"], isbn13: "9780141439846", publishedYear: 2003, pages: 488, shelf: "Bedroom", status: "read", rating: 4, format: "paperback", condition: "worn", acquiredFrom: "Second-hand market", priceMinor: 1500, tags: ["classic", "gothic"] },
  { ...ro, title: "Moara cu noroc", authors: ["Ioan Slavici"], publisher: "Litera", publishedYear: 2018, pages: 128, shelf: "Living room · A2", status: "read", rating: 4, format: "paperback", condition: "good", tags: ["classic", "school"] },
  { ...en, title: "Crime and Punishment", authors: ["Fyodor Dostoevsky"], isbn13: "9780140449136", publishedYear: 2003, pages: 656, shelf: "Living room · A1", status: "read", rating: 5, format: "paperback", condition: "good", acquiredFrom: "Bookshop", priceMinor: 5500, tags: ["classic", "russian"] },
  { ...ro, title: "Momente și schițe", authors: ["I. L. Caragiale"], publisher: "Humanitas", publishedYear: 2012, pages: 368, shelf: "Living room · A2", status: "reading", format: "hardcover", condition: "good", acquiredFrom: "Gift", tags: ["classic", "humour"] },
  { ...en, title: "Wuthering Heights", authors: ["Emily Brontë"], isbn13: "9780141439556", publishedYear: 2003, pages: 416, shelf: "Bedroom", status: "unread", format: "paperback", condition: "new", acquiredFrom: "Bookshop", acquiredOn: "2026-02-14", priceMinor: 4500, tags: ["classic", "gothic"] },
  { ...ro, title: "Ultima noapte de dragoste, întâia noapte de război", authors: ["Camil Petrescu"], publisher: "Litera", publishedYear: 2020, pages: 288, shelf: "Living room · A2", status: "read", rating: 4, format: "paperback", condition: "good", tags: ["classic", "school"] },
  { ...en, title: "Great Expectations", authors: ["Charles Dickens"], isbn13: "9780141439563", publishedYear: 2003, pages: 544, shelf: "Living room · A1", status: "read", rating: 4, format: "paperback", condition: "good", acquiredFrom: "Library sale", priceMinor: 1000, tags: ["classic"] },
  { ...ro, title: "Baltagul", authors: ["Mihail Sadoveanu"], publisher: "Cartea Românească", publishedYear: 2015, pages: 192, shelf: "Living room · A2", status: "read", rating: 5, format: "paperback", condition: "good", tags: ["classic", "school"] },
  { ...en, title: "The Picture of Dorian Gray", authors: ["Oscar Wilde"], isbn13: "9780141439570", publishedYear: 2003, pages: 304, shelf: "Bedroom", status: "reading", format: "paperback", condition: "good", acquiredFrom: "Bookshop", priceMinor: 3900, tags: ["classic"] },
  { ...ro, title: "Maitreyi", authors: ["Mircea Eliade"], publisher: "Humanitas", publishedYear: 2019, pages: 232, shelf: "Study · B1", status: "unread", format: "paperback", condition: "new", acquiredFrom: "Bookshop", acquiredOn: "2026-09-12", priceMinor: 3500, tags: ["novel"] },
  { ...en, title: "Jane Eyre", authors: ["Charlotte Brontë"], isbn13: "9780141441146", publishedYear: 2006, pages: 624, shelf: "Bedroom", status: "read", rating: 5, format: "paperback", condition: "good", acquiredFrom: "Gift", tags: ["classic"] },
  { ...ro, title: "Enigma Otiliei", authors: ["George Călinescu"], publisher: "Litera", publishedYear: 2016, pages: 512, shelf: "Study · B1", status: "reading", format: "paperback", condition: "good", notes: "Lent to a neighbour once; came back with a coffee ring on page 80.", tags: ["classic"] },
  { ...en, title: "Frankenstein", subtitle: "or, The Modern Prometheus", authors: ["Mary Shelley"], isbn13: "9780141439471", publishedYear: 2003, pages: 352, shelf: "Bedroom", status: "read", rating: 4, format: "paperback", condition: "good", acquiredFrom: "Second-hand market", priceMinor: 1200, tags: ["classic", "gothic"] },
  { ...ro, title: "Ion", authors: ["Liviu Rebreanu"], publisher: "Litera", publishedYear: 2017, pages: 480, shelf: "Living room · A2", status: "read", rating: 4, format: "paperback", condition: "good", tags: ["classic", "school"] },
  { ...ro, title: "Poezii", authors: ["Mihai Eminescu"], publisher: "Humanitas", publishedYear: 2020, pages: 400, shelf: "Living room · A2", status: "read", rating: 5, format: "hardcover", condition: "new", acquiredFrom: "Gift", tags: ["classic", "poetry"] },
  { ...en, title: "Pride and Prejudice", authors: ["Jane Austen"], isbn13: "9780141439518", publishedYear: 2003, pages: 480, shelf: "Bedroom", status: "unread", format: "paperback", condition: "new", acquiredFrom: "Bookshop", acquiredOn: "2026-10-01", priceMinor: 4200, tags: ["classic"] },
  { ...ro, title: "Pădurea spânzuraților", authors: ["Liviu Rebreanu"], publisher: "Humanitas", publishedYear: 2019, pages: 336, shelf: "Living room · A2", status: "reading", format: "paperback", condition: "good", acquiredFrom: "Bookshop", acquiredOn: "2026-08-30", priceMinor: 3900, tags: ["classic", "war"] },
  { ...ro, title: "Amintiri din copilărie", authors: ["Ion Creangă"], publisher: "Humanitas", publishedYear: 2021, pages: 192, shelf: "Living room · A1", status: "read", rating: 5, format: "hardcover", condition: "new", acquiredFrom: "Gift", notes: "The illustrated edition.", tags: ["classic", "childhood"] },
];

for (const book of books) {
  const response = await fetch(`${api}/api/books`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(book),
  });
  if (!response.ok) throw new Error(`${book.title}: ${response.status} ${await response.text()}`);
}

console.log(`Seeded ${books.length} books.`);
