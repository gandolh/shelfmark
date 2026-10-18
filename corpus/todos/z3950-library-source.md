---
title: Look up Romanian books in library catalogs over Z39.50
created: 2026-10-17
status: promoted
tags: [v1.x, server]
---

# Look up Romanian books in library catalogs over Z39.50

Add a lookup source that asks BCU Cluj, BCU Timișoara and the Romanian
Academy Library by ISBN over Z39.50 and reads the UNIMARC record they return
(title, authors, publisher, year, pages, language, subjects). Ask it after
Open Library and before Google Books.

## Context

Measured on 2026-10-17, these three catalogs found 33 of 40 trade books from
2012-2015, where Open Library found 2. They found few books from the last
year, which is what the [CIP index](cip-bibliography-index.md) is for.
Records have no cover. Ask with the ISBN-10 too for 978 ISBNs, because books
from before 2007 are catalogued under it. Targets, numbers and caveats are in
[metadata-lookup.md](../wiki/metadata-lookup.md).

Open questions: a Z39.50 client for Node (a small BER client over a TCP
socket, or yaz in the Docker image); whether to ask all three libraries or
stop at the first hit; and whether to email the libraries first, since none
of them publishes terms of use.

Promoted to [15-library-catalogs](../briefs/done/15-library-catalogs.md) on 2026-10-17.
