# Repository Guidance

## Single Repository

- Develop, validate, commit, and push directly in this repository, `shadorig/real-extensions`.
- The same checkout is the development workspace and the public Paperback feed. No separate dev repository or promotion step is required.
- Keep published repository links pointed at `https://shadorig.github.io/real-extensions/sources`.
- Keep local debug captures, copied study sources, archives, and temporary tooling ignored.
- Use the repository-local SHADORIG author identity and GitHub credential helper. Do not replace them with the global account settings.

## Paperback Source Versioning

Before changing any production source under `sources/<SourceId>/`, read the source versioning policy in `reference/baseline-example/README.md`.

- Treat `SourceInfo.version` in `sources/<SourceId>/source.js` as the canonical editable source version.
- Keep the matching `sources/versioning.json` entry synchronized with `SourceInfo.version`.
- Classify the full cumulative delta from `origin/main` to the current working tree as one unreleased candidate release.
- Compute the next version from the `origin/main` baseline version. Do not stack repeated local bumps for additional edits before release.
- Use SemVer bump terms: major, minor, and patch.
- Run `node scripts/check-version-sync.cjs` before finishing source work.

## Baseline Consistency

- Before meaningful production-source changes, re-read `reference/baseline-example/README.md` and compare the target source against `reference/baseline-example/source.js` plus the current live sources for durable conventions versus site-specific exceptions.
- After meaningful production-source changes, decide whether the change should also update the baseline reference or this guidance, and make that update in the same pass when warranted.

## Comment and Formatting Hygiene

- Keep useful section and navigation comments, such as `// Paperback Interface Methods`.
- Avoid semicolons and em dashes in comments. Do not remove semicolons from executable JavaScript.
- Use LF line endings for text files unless a specific file needs something else.
