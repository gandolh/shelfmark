---
summary: Locked engineering calls for Shelfmark made since 2026-11-23, each with date, rejected alternatives and reason (the earlier ones, Base UI, only lightweight tests, the house style and the server's feature folders, stay on decisions.md). Similar books from all-MiniLM-L6-v2 on the server, in a child process, on a glibc runtime image.
updated: 2026-11-23
---

# Engineering decisions

The product's decisions, and the engineering calls made before 2026-11-23,
are on [decisions.md](decisions.md); the same rules hold here: a decision is
hard to reverse, surprising without context, and a real trade-off, with its
date, what was rejected and why.

## Similar books from a model on the server, on a glibc image
_2026-11-23_, the owner's ask ("try all-MiniLM-L6-v2 with transformers", brief 16). Recommendations have a second source, Similar books: all-MiniLM-L6-v2 through transformers.js 4.3.2 ranks Open Library's books against the library, on the server, in a child process forked for each refresh and ended with its answer ([recommendations.md](recommendations.md)). onnxruntime-node, which transformers.js loads in Node, ships Linux binaries for glibc only, so the runtime image (`proddeps` and `prod`) moved from `node:24-alpine` to `node:24-trixie-slim`: the image is 488 MB, up from 278 MB (the base and poppler about 85 MB, `node_modules` 98 to about 225 MB after pruning the foreign platforms and onnxruntime-web's WebAssembly and maps). onnxruntime-node's postinstall, which would fetch the CUDA and TensorRT providers (260 MB), is denied in `package.json`'s `allowScripts`. On glibc the API's own memory grew from 60 to about 190 MB over a refresh's Open Library searches (native buffers, not the heap); `MALLOC_ARENA_MAX=2` bounds the arenas (46 MB of growth for 13 searches with the default, 31 MB with 2). The model's peak, about 230 MB, lasts the few seconds of a refresh and goes back when its process ends. Rejected: Alpine with `gcompat` (onnxruntime's glibc binaries are not reliable on it); onnxruntime-web's WebAssembly in Node (transformers.js 4 offers no WASM path in Node, and aliasing the package would hide the swap from every later reader); running the model in the browser (a 45 MB download on the phone, the service worker and the work split between two places; kept as the fallback if the box can't spare the memory); onnxruntime-node directly without transformers.js (the owner asked for transformers.js); a sidecar container for the model (a second image and a socket for one button). The tabs that offer it are a design call, in [design.md](design.md).
