# Real Extensions

Paperback 0.8 source repository for the Real collection.

- Base URL: `https://shadorig.github.io/real-extensions/sources`
- Catalog page: [https://shadorig.github.io/real-extensions/sources/](https://shadorig.github.io/real-extensions/sources/)
- Add to Paperback URI: `paperback://addRepo?displayName=Real%20Extensions%20%280.8%29&url=https%3A%2F%2Fshadorig.github.io%2Freal-extensions%2Fsources`

Published source files live under `sources/`. Any 18+ sources are marked on the catalog page.

Development happens directly in this repository. Read [AGENTS.md](AGENTS.md) and the [baseline reference](reference/baseline-example/README.md) before changing sources, then run `node scripts/check-version-sync.cjs` before committing and pushing to `main`. GitHub Pages publishes the feed from `main`.

The baseline reference and version check are tracked alongside the extensions. Debug captures, copied study sources, archives, and temporary tooling stay local and ignored.
