# Baseline Example Reference

This folder is a versioned development reference, not a production source and not a shared runtime base.

It answers a narrower question: if you were starting a new high-quality normal source today, using the current active production sources in `sources/` as the relevant references, what should the generalized file shape look like?

The leaf folder is intentionally named `baseline-example`: simple enough to reuse, while the README and source comments keep the provenance clear.

## Files

- `source.js`: reference-only baseline source skeleton with the recommended section order and helper grouping
- `README.md`: this explanation

## Why it lives here

The home for this artifact is top-level `reference/` in the same repository as the public sources.

- `debug/examples/` is already an explicit gitignored study area for copied external collections.
- `sources/` is for production extensions.
- `reference/baseline-example/README.md` and `source.js` are tracked so every checkout has the source conventions and versioning policy. Other reference material stays ignored.

## Why this shape

The current normal sources differ heavily in implementation style:

- ComicLand is API-first, but its homepage and search flows still need multiple section-specific fetch paths and taxonomy-style browse helpers.
- ErisScans is HTML-first. Its core work is homepage section extraction, series index parsing, detail/chapter scraping, and local filter normalization over scraped series data.
- QiScans is API-first. Its core work is JSON fetching, payload validation, pagination, and payload-to-Paperback mapping.
- ElfToon is HTML-first. Its core work is page fetching, block extraction, regex parsing, archive/search URL building, and chapter lock detection from HTML.
- HiveToon is hybrid. It uses API endpoints for browse/chapter data, but also needs site-specific page-payload extraction for canonical series data.
- GenzToon is HTML-first. Its core work is homepage block extraction, shared series-index parsing, source-local genre normalization, and detail/chapter scraping with locked-chapter handling.
- DivaScans is API-first for details, archive/search, and chapter data, but also reads server-rendered homepage payloads for multiple rows and needs source-specific genre normalization.
- MadaraScans is HTML-first with WordPress AJAX pagination. Its core work is page fetching, browse URL building, AJAX row loading, card/detail parsing, and locked chapter/page detection from HTML.
- VortexScans is hybrid. It uses API endpoints for archive/detail/chapter data, but also decodes serialized Astro homepage props and keeps archive sort/order/filter mapping aligned with the live frontend.
- ComixTo is API-first with signed chapter endpoints, rich browse/home filters, server-rendered browse option fallback, and source settings for content, homepage, and chapter-group handling.

Even with those differences, the current live sources still imply the same generalized structural baseline:

1. constants
2. source info
3. constructor
4. Paperback interface methods
5. source-specific fetch helpers
6. site parsing helpers, if the source has cross-cutting parser logic
7. response/request helpers
8. series/card helpers
9. homepage helpers
10. search/filter helpers
11. detail helpers
12. chapter helpers
13. optional cross-domain source setting helpers, only when settings span unrelated behavior
14. generic utilities
15. optional large low-level source-specific appendices, only when isolating them keeps the normal flow readable
16. exports

That is what `source.js` standardizes.

## What came from the current shared normal-source baseline

- Public Paperback methods are grouped near the top in a stable order.
- Optional interface methods stay in that same block, but only when the corresponding intent or setting is real.
- Homepage orchestration stays in the interface block, while the fetch block can either normalize one shared homepage payload plus a paged section helper or group multiple section-specific loaders when the site really pages several rows independently.
- Private persisted-setting helpers stay with the domain block they actually drive, such as homepage-view state in homepage helpers or locked-chapter state in chapter helpers. A compact source-settings helper block is acceptable only when settings genuinely span unrelated behavior and keeping shared DUI/state normalization together is clearer than scattering it.
- Request orchestration is kept separate from response validation and request-label formatting.
- Partial-series/card mapping lives in its own block because homepage and search/browse flows both depend on it.
- Search-tag construction lives next to search-filter extraction and now centers on normalized filter data rather than a genre-only cache.
- Detail tag helpers live near detail parsing helpers.
- Detail genre tags are expected to use the same searchable ids as the search-tag block. If detail payload genres are not canonical, resolve them through the normalized filter data instead of trusting them directly.
- Chapter naming, lock handling, and access-state logic form a dedicated chapter block.
- Generic text/number/url helpers stay near the bottom, away from source-specific logic. Very large low-level site-specific ports, such as request signing or decoding algorithms, may remain as a named appendix after generic utilities when that keeps the normal source flow readable.
- Cross-cutting parser utilities get their own block only when a site genuinely needs one. Otherwise the parsing stays next to the homepage/search/detail/chapter helper it serves.

## Why the remaining constructor fields stay

The constructor is intentionally small:

- `requestManager` stays because every current production source is request-manager-driven.
- `stateManager` stays as the concrete example because multiple live sources now use persisted source settings, including locked-chapter visibility, ComicLand's card-subtitle mode toggle, and ComixTo's content/home/chapter-group controls. It should still be deleted when the source does not need persisted settings.
- `cachedFilterData` stays because small normalized caches for filters, browse data, or decoded payloads are now part of the shared normal-source toolbox.

Anything beyond that was trimmed as baseline noise. The baseline keeps one minimal example cache to show placement, not every cache a live source might need.

## Filter and sort standards

Search filters should be honest to the target site, not canonicalized for false repo-wide symmetry.

- Preserve clean live genre labels. Normalize only clear defects such as casing/spacing noise, broken labels, typo variants, or duplicate labels for the same concept.
- Prefer a hybrid genre strategy when normalization is actually needed: use simple mechanical cleanup for obvious casing/spacing defects, and add a small explicit override table for verified bad labels or ugly compound phrases when the formatter alone produces poor output.
- Keep the automatic path mechanical. Whitespace cleanup, underscore cleanup, camelCase splitting, and plain title-casing are enough. Do not add repo-wide minor-word casing rules by default.
- Lowercase minor words such as `and`, `of`, or `the` only when a specific verified label looks worse without it. Handle that through a targeted override, not a blanket formatter.
- Keep manual overrides tight. Do not keep exhaustive no-op entries when the automatic formatter already produces the same label.
- If both search tags and detail tags expose genres, run both through the same local normalization helper so the user sees one label shape instead of mismatched search/detail wording.
- The reference `source.js` now shows one lean optional pattern for this: `normalizeGenreLabel()` plus small `normalizeGenreOptions()` / `normalizeGenreEntries()` helpers. Keep the override table empty unless the source proves it needs one.
- Keep searchable genre ids stable. Prefer live ids when they are stable; use source-local ids only when the live ids are unstable, duplicated, or label-derived.
- Expose status and type options from the live fixed catalog when one exists. If the source derives options from live corpus data, expose only values that are actually present, and remove values outside the source scope such as novels in non-novel sources.
- Expose extra `getSearchFields()` inputs such as numeric or date fields only when the live site or backend already honors them directly, or when the source can map them onto a stable first-party query path without scraping hacks. Do not invent pseudo-filters the site cannot actually execute.
- Expose sort/order only when the live site has a real sort control or shipped client/API behavior that materially changes result order. Do not turn homepage rows, special feeds, cosmetic controls, or ignored params into sort tags.
- Use `sort` for a sort key and `order` for a direction or site-labeled order mode when the live controls expose those concepts separately. Do not rename live order modes just to force symmetry with another source.
- Match live multi-select semantics. If the live site treats selected genres as OR, the source should do the same; if it treats them as AND, keep AND. When behavior is unclear, prefer the safer narrow behavior until it is verified.

## Source metadata wording

- Keep user-facing source descriptions in `SourceInfo.description` and `sources/versioning.json` aligned.
- Prefer `Extension that pulls series from <domain>` as the default description wording unless the live product surface genuinely exposes a different noun which would be misleading to flatten.

## Source versioning policy

Production sources in this repo must keep two version locations in sync:

- `SourceInfo.version` inside `sources/<SourceId>/source.js` is the canonical version to edit.
- `sources/versioning.json` is the published Paperback repository manifest and must mirror the canonical source version for each source.

This repo needs both locations. Paperback's 0.8 type definitions make `SourceInfo.version` required and describe it as the value the app uses to determine whether the local source should update. Paperback repositories are added through a base URL that hosts `versioning.json`, and the 0.8.7 toolchain generates that manifest by requiring each built `source.js` and copying `${SourceId}Info.version` into the matching manifest entry. This repo stores deployable `source.js` files directly and has no local `package.json`, CI, or `paperback bundle` command, so `versioning.json` is tracked and synchronized manually.

Use SemVer terms for source changes:

- PATCH: backward-compatible fixes or maintenance that should ship to installed users, including parser or selector hardening, chapter/page extraction fixes, metadata corrections, filter/value fixes that restore intended behavior, diagnostic/error handling improvements, and internal refactors with no new source capability.
- MINOR: backward-compatible new user-facing source capability, including new homepage sections, new supported filters or search behavior, new meaningful settings, or support for new site structures/endpoints while preserving existing IDs and behavior.
- MAJOR: breaking source identity or mapping changes, including source folder/export ID changes, series ID or chapter ID strategy changes that can break installed libraries/history, URL identity strategy changes, or intentional behavior changes requiring users to treat the source as materially changed.

Do not bump a source for docs-only changes, comments-only changes, ignored reference/debug material, or `versioning.json` `buildTime` churn by itself.

Dirty working tree versioning:

1. Treat the current working tree for each changed source as one unreleased candidate release, including staged and unstaged edits.
2. Use `origin/main` as the release baseline unless another published baseline is explicitly justified and verified.
3. Read the baseline version from `origin/main:sources/versioning.json`, and verify that the baseline `sources/<SourceId>/source.js` `SourceInfo.version` matches it.
4. Compare the full cumulative source delta from `origin/main` to the current working tree. Ignore only version-field edits and manifest timestamp churn when classifying behavior.
5. Choose exactly one bump level for that cumulative delta: major, minor, patch, or no bump.
6. Compute the target version from the baseline version, not from the current local version.
7. Set both `SourceInfo.version` and the matching `sources/versioning.json` entry to that computed target. If the local version is already correct, keep it; if it is too low or too high, correct it.
8. Do not stack additional bumps for more local edits before release. Reclassify the cumulative delta and recompute from the same baseline.

Update `versioning.json.buildTime` only when editing the manifest for source synchronization. Do not use `buildTime` as a release baseline or bump signal.

Run `node scripts/check-version-sync.cjs` before finishing source work. The check requires every `sources/versioning.json` version to match the exported `${SourceId}Info.version` in that source's `source.js`.

If this repo later adopts the standard `src/` plus `paperback bundle` workflow, revise this policy so `versioning.json` is treated as generated output and `SourceInfo.version` remains the only manually edited source version.

## What is intentionally still site-specific

The baseline does not flatten real source differences. These parts should be customized per site:

- API vs HTML vs hybrid fetching/parsing
- homepage composition
- search endpoint vs archive/browse flow
- exact search filter inventory
- detail metadata and tag composition
- chapter lock detection and locked chapter IDs
- pagination truth
- share URL formats
- request headers/interceptors beyond the obvious basics
- framework-specific payload decoding

The reference keeps explicit placeholder methods for those areas so the variation stays visible.

## How to keep future normal sources structurally comparable

- Keep the same high-level block order even when some blocks end up empty or are deleted as unnecessary.
- Let the public Paperback methods read as orchestration methods. Push network details, normalization, and parser-heavy work into the helper blocks.
- Normalize site output at helper boundaries so homepage/search/detail/chapter mapping stays easy to compare across sources.
- Add a dedicated site parsing block only when the parser logic is cross-cutting. Do not force one if the parser only belongs to a single domain block.
- Do not force false symmetry. If the site does not really have a featured section, a browse mode, a sort catalog, Cloudflare bypass, or locked-chapter IDs, do not invent them just to match another source.

## How to use it

1. Copy `source.js` into the new source folder you are building.
2. Rename the source class and `SourceInfo`.
3. Set only the constants, intents, section ids, and option lists the source actually needs.
4. Decide early whether the source is API-first, HTML-first, or hybrid.
5. Delete the unused fetch/parsing path early instead of carrying all possible variants.
6. Implement the homepage helpers first, either by keeping `fetchHomepageData()` plus `getLatestSectionItems()` or by replacing them with small section-specific loaders when the site pages multiple homepage rows.
7. Fill in homepage, search, detail, and chapter helpers in that order.
8. Trim optional settings UI, Cloudflare bypass handling, and optional parsing/filter blocks if the source has no real use for them.

## Customize first

When adapting this baseline, the first things to change should be:

- `getMangaShareUrl()` and `getChapterShareUrl()`
- homepage helpers such as `fetchHomepageData()` and `getLatestSectionItems()` or the section-specific replacements the site really needs
- `fetchSeriesDetails()`
- `fetchChapterEntries()`
- `fetchChapterPages()`
- `searchByTitle()`
- `browseSeries()`
- `fetchFilterData()`

Those methods are where the real source-specific behavior belongs.

## What this reference is not

- not a new runtime framework
- not a shared base class
- not a promise that all sites work the same way
- not a substitute for reading the target website carefully

The intended value is structural clarity: it gives a serious starting outline based on what the current live sources actually have in common, while leaving the real site work in the places where it belongs.
