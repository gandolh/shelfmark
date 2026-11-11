---
title: The recommendations spike on the owner's library
created: 2026-11-11
status: open
tags: [later]
---

Step 1 of brief 04, not run: with a copy of the owner's database (the backup download), a throwaway `server/scripts/spike-recommendations.ts` tries (a) TasteDive (a free key in `.env`, 300 requests an hour, seeds are the top authors and best-rated titles) and (b) an embedding ranker (all-MiniLM-L6-v2 through transformers.js over at most 25 cached Open Library requests). Record per source: 10 real examples, the owner's count of useful picks out of 10, the model's size on disk, first-load and refresh times, memory. Then decide: neither useful, the Claude import stays alone; one useful, it joins the page with a Refresh button, the profile (brief 04 step 3) and a "From Claude" label with a hide setting. See [recommendations.md](../wiki/recommendations.md).
