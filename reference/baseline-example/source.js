"use strict";

/*
Reference only.
Not wired into production.

This file is a concrete baseline derived from the current live production
sources in this repo. It is intentionally shaped like a real Paperback source
file, but it is not a fake universal runtime layer.

Use it as a starting point for a new source, then delete the unused variation
paths early. API-first, HTML-first, and hybrid sites should not keep multiple
dead fetch/parser paths once the target site is understood.
*/

(function() {
  // ---------------------------------------------------------------------------
  // Constants
  // Keep source-wide identifiers, endpoint roots, intent flags, section ids,
  // search tag prefixes, and chapter access labels together at the top. Delete
  // constants the real source does not need instead of preserving fake symmetry.
  // ---------------------------------------------------------------------------

  var DOMAIN = "https://example-source.tld";
  var API_BASE = "https://api.example-source.tld";

  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;

  var CONTENT_RATING_MATURE = "MATURE";

  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular";
  var SECTION_ID_LATEST = "latest";

  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";

  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_ID_PREFIX = "locked::";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var CHAPTER_ACCESS_READABLE = "readable";
  var CHAPTER_ACCESS_LOCKED = "locked";
  var CHAPTER_ACCESS_UNKNOWN = "unknown";

  var SEARCH_STATUS_OPTIONS = [
    { id: "ONGOING", label: "Ongoing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "HIATUS", label: "Hiatus" }
  ];

  var SEARCH_TYPE_OPTIONS = [
    { id: "MANGA", label: "Manga" },
    { id: "MANHWA", label: "Manhwa" },
    { id: "MANHUA", label: "Manhua" }
  ];

  var SEARCH_SORT_OPTIONS = [
    { id: "latest", label: "Latest Updated" },
    { id: "newest", label: "Newest" },
    { id: "popular", label: "Popular" }
  ];

  // Keep empty unless the live source proves it needs explicit genre fixes.
  // Prefer a few verified overrides over a broad "smart" formatter.
  var GENRE_LABEL_OVERRIDES = {};

  // ---------------------------------------------------------------------------
  // Source Info
  // Keep SourceInfo close to the constants it uses.
  // ---------------------------------------------------------------------------

  var BaselineExampleInfo = {
    version: "0.0.1",
    name: "BaselineExample",
    description: "Reference-only baseline derived from the current live sources in this repo.",
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // ---------------------------------------------------------------------------
  // Constructor
  // Initialize request manager, optional settings state, and small caches here.
  // ---------------------------------------------------------------------------

  function BaselineExample() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
      requestTimeout: 20000,
      interceptor: {
        interceptRequest: async function(request) {
          request.headers = Object.assign({}, request.headers || {}, {
            referer: DOMAIN + "/",
            origin: DOMAIN,
            "user-agent": await this.requestManager.getDefaultUserAgent()
          });
          return request;
        }.bind(this),
        interceptResponse: async function(response) {
          return response;
        }
      }
    });

    // Keep stateManager only if the source has real persisted settings such as
    // locked chapter visibility or request mode toggles.
    this.stateManager = App.createSourceStateManager();

    // Keep only caches which materially support filters, browse data, or other
    // normalized payloads reused across multiple interface methods.
    this.cachedFilterData = null;
  }

  // ---------------------------------------------------------------------------
  // Paperback Interface Methods
  // Keep the public Paperback surface in one coherent block near the top.
  // ---------------------------------------------------------------------------

  BaselineExample.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  BaselineExample.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  BaselineExample.prototype.getMangaShareUrl = function(seriesId) {
    // Customize to the live site URL shape. Real sources vary here.
    return DOMAIN + "/series/" + encodePathSegment(seriesId);
  };

  BaselineExample.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    // Some sites nest chapters below series, others expose chapter slugs directly.
    return this.getMangaShareUrl(seriesId) + "/" + encodePathSegment(chapterId);
  };

  BaselineExample.prototype.getHomePageSections = async function(sectionCallback) {
    // Keep homepage orchestration here. This concrete baseline shows one common
    // pattern: normalize shared homepage data once, then pair it with one
    // dedicated paged section helper. If the real site pages multiple homepage
    // rows independently, replace this with small per-section loaders instead.
    var homeResults = await Promise.all([
      this.fetchHomepageData(),
      this.getLatestSectionItems(1)
    ]);
    var homepageData = homeResults[0] || {};
    var latestResults = homeResults[1];
    var latestItems = Array.isArray(latestResults && latestResults.results) ? latestResults.results : [];
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        mapHomeItems(homepageData.featured),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Popular",
        "singleRowLarge",
        mapHomeItems(homepageData.popular),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest",
        "singleRowNormal",
        latestItems,
        latestResults && latestResults.metadata !== void 0
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  BaselineExample.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    var page = Math.max(1, toNumber(metadata && metadata.page, 1));
    return this.getLatestSectionItems(page);
  };

  BaselineExample.prototype.getCloudflareBypassRequestAsync = async function() {
    // Keep this method and the corresponding intent only if the live source
    // really needs Paperback's Cloudflare bypass flow.
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  BaselineExample.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;

    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      rows: async function() {
        return [
          App.createDUISwitch({
            id: STATE_SHOW_LOCKED_CHAPTERS,
            label: "Show Locked Chapters",
            value: App.createDUIBinding({
              get: async function() {
                return getShowLockedChapters(stateManager);
              },
              set: async function(newValue) {
                await stateManager.store(STATE_SHOW_LOCKED_CHAPTERS, newValue === true);
              }
            })
          })
        ];
      }
    });
  };

  BaselineExample.prototype.supportsTagExclusion = async function() {
    return false;
  };

  BaselineExample.prototype.getSearchTags = async function() {
    // Keep search-tag loading and search-filter extraction close together.
    // Normalize whatever the site exposes into one filter-data object, then
    // build tag sections from that normalized shape.
    if (!this.cachedFilterData) {
      this.cachedFilterData = await this.fetchFilterData();
    }

    return buildSearchTagSections(this.cachedFilterData);
  };

  BaselineExample.prototype.getSearchFields = async function() {
    // Keep this optional method only when the live site/backend honors extra
    // input fields directly or maps them onto stable first-party query params.
    return [];
  };

  BaselineExample.prototype.getMangaDetails = async function(seriesId) {
    // Pick one path and remove the unused one early.
    // API path: fetch JSON and map payload fields directly.
    // HTML path: fetch page HTML and parse title/image/description/metadata.
    // If detail genres do not already expose canonical search ids, resolve them
    // through the same normalized filter data used by getSearchTags().
    var details = await this.fetchSeriesDetails(seriesId);

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title, details.alternativeTitles),
        image: emptyToUndefined(details.image) || "",
        desc: cleanText(details.description || ""),
        author: emptyToUndefined(details.author),
        artist: emptyToUndefined(details.artist),
        status: mapStatus(details.status),
        rating: toNumber(details.rating, 0),
        tags: buildDetailTagSections(details),
        hentai: false
      })
    });
  };

  BaselineExample.prototype.getChapters = async function(seriesId) {
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapterEntries = await this.fetchChapterEntries(seriesId);
    var chapters = [];

    chapterEntries.forEach(function(entry, index) {
      if (!shouldIncludeChapterForList(entry, showLockedChapters)) {
        return;
      }

      var chapterId = getChapterId(entry);
      if (chapterId.length === 0) {
        return;
      }

      var chapterNumber = toChapterNumber(entry.number, chapterEntries.length - index);

      chapters.push(App.createChapter({
        id: chapterId,
        name: buildChapterListName(entry, chapterNumber),
        chapNum: chapterNumber,
        time: entry.date || new Date(),
        langCode: "en"
      }));
    });

    if (chapters.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return chapters;
  };

  BaselineExample.prototype.getChapterDetails = async function(seriesId, chapterId) {
    if (isLockedChapterId(chapterId)) {
      throw new Error("This chapter is locked on the source and cannot be loaded in Paperback.");
    }

    var pages = await this.fetchChapterPages(seriesId, chapterId);
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("The source did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  BaselineExample.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = Math.max(1, toNumber(metadata && metadata.page, 1));
    var filters = extractSearchFilters(query);

    if (title.length > 0) {
      // Keyword search often differs from browse/archive filtering.
      return this.searchByTitle(title, page, filters);
    }

    return this.browseSeries(filters, page);
  };

  // ---------------------------------------------------------------------------
  // Source-Specific Fetch Helpers
  // Keep network orchestration and source-specific data loading here. Keep
  // response/request validation below, and use a dedicated site-parsing block
  // only when parser logic is cross-cutting instead of domain-local.
  // ---------------------------------------------------------------------------

  BaselineExample.prototype.fetchHomepageData = async function() {
    // One common pattern is to normalize the site's shared or non-paged
    // homepage sections into:
    // {
    //   featured: [{ id or slug, title, image, subtitle? }],
    //   popular: [{ id or slug, title, image, subtitle? }]
    // }
    //
    // API-first sources often map response sections directly.
    // HTML-first sources usually parse the landing page once and split blocks.
    // If the site instead has multiple independently paged homepage rows,
    // replace this helper with small section-specific loaders at the top of
    // this block rather than forcing everything through one shared payload.
    throw new Error("Customize fetchHomepageData() for this source.");
  };

  BaselineExample.prototype.getLatestSectionItems = async function(page) {
    // Return App.createPagedResults({ results, metadata }) for one paged
    // homepage section. If the real site exposes multiple independently paged
    // rows, mirror that honestly with separate section-item helpers instead.
    throw new Error("Customize getLatestSectionItems(page) for this source.");
  };

  BaselineExample.prototype.fetchSeriesDetails = async function(seriesId) {
    // API example: map the JSON payload returned by the series endpoint.
    //
    // HTML example: parse the detail page returned by getMangaShareUrl().
    throw new Error("Customize fetchSeriesDetails(seriesId) for this source.");
  };

  BaselineExample.prototype.fetchChapterEntries = async function(seriesId) {
    // API example:
    // fetch paged chapter payloads, flatten, dedupe, then map to normalized entries.
    //
    // HTML example:
    // fetch the series page once, isolate the chapter list block, then parse entries.
    throw new Error("Customize fetchChapterEntries(seriesId) for this source.");
  };

  BaselineExample.prototype.fetchChapterPages = async function(seriesId, chapterId) {
    // API example:
    // map sorted image payloads to page URLs.
    //
    // HTML example:
    // parse the reader payload or image list from the chapter page.
    throw new Error("Customize fetchChapterPages(seriesId, chapterId) for this source.");
  };

  BaselineExample.prototype.searchByTitle = async function(title, page, filters) {
    // Some sites use a dedicated search endpoint.
    // Others require the same archive/browse flow with a keyword param.
    throw new Error("Customize searchByTitle(title, page, filters) for this source.");
  };

  BaselineExample.prototype.browseSeries = async function(filters, page) {
    // Keep non-title browsing separate from keyword search.
    // This is where archive routes, API browse endpoints, or alphabetical modes live.
    throw new Error("Customize browseSeries(filters, page) for this source.");
  };

  BaselineExample.prototype.fetchFilterData = async function() {
    // Normalize whatever the site actually exposes into:
    // {
    //   genres: [{ id, label }],
    //   statuses: [{ id, label }],
    //   types: [{ id, label }],
    //   sorts: [{ id, label }],
    //   orders: [{ id, label }]
    // }
    //
    // If the site only exposes some categories, return only those. Static
    // fallback options can still live in this file when the source has a real
    // fixed filter catalog but no live filter endpoint.
    //
    // Keep labels close to the live site unless there is a clear defect to fix.
    // Expose sort/order only after proving the live site or API honors it, and
    // make multi-select filters follow the live AND/OR behavior exactly.
    return {
      genres: []
    };
  };

  BaselineExample.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  };

  BaselineExample.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  // ---------------------------------------------------------------------------
  // Site Parsing Helpers
  // Use this optional block only for cross-cutting parser utilities such as
  // embedded-state decoding or framework payload extraction. If a parser only
  // serves one domain block, keep it with that domain instead.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Response / Request Helpers
  // Keep response validation, request labeling, and shared response decoding
  // separate from the source-specific fetch orchestration above.
  // ---------------------------------------------------------------------------

  function parseJsonResponse(response, url) {
    var raw = typeof response.data === "string" ? response.data : "";
    ensureReadableResponse(response, raw, url);

    if (isObject(response.data)) {
      return response.data;
    }

    try {
      return JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("The source returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("The source returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("The source returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
    return lower.includes("cloudflare") && lower.includes("just a moment");
  }

  function formatRequestLabel(url) {
    var value = String(url || "");
    if (value.indexOf(API_BASE) === 0) {
      return value.slice(API_BASE.length) || "/";
    }
    if (value.indexOf(DOMAIN) === 0) {
      return value.slice(DOMAIN.length) || "/";
    }
    return value.length > 0 ? value : "unknown endpoint";
  }

  function buildDiagnosticPreview(body) {
    var preview = String(body || "").replace(/\s+/g, " ").trim();
    if (preview.length === 0) {
      return "";
    }

    if (preview.length > 120) {
      preview = preview.slice(0, 120) + "...";
    }

    return ' Preview: "' + preview.replace(/"/g, "'") + '"';
  }

  // ---------------------------------------------------------------------------
  // Series / Card Helpers
  // Keep shared partial-series mapping here so homepage and search/browse flows
  // do not need to duplicate card-shaping logic.
  // ---------------------------------------------------------------------------

  function getSeriesId(item) {
    return cleanText(item && (item.id || item.slug));
  }

  function createPartialSeries(item, subtitle) {
    return App.createPartialSourceManga({
      mangaId: getSeriesId(item),
      title: cleanText(item && item.title || ""),
      image: String(item && item.image || ""),
      subtitle: emptyToUndefined(subtitle)
    });
  }

  // ---------------------------------------------------------------------------
  // Homepage Helpers
  // Keep homepage section helpers, homepage-specific item mapping, and
  // homepage-only setting helpers together.
  // ---------------------------------------------------------------------------

  function createHomeSection(id, title, type, items, containsMoreItems) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: type,
      items: items,
      containsMoreItems: containsMoreItems
    });
  }

  function mapHomeItems(items) {
    return (Array.isArray(items) ? items : []).filter(function(item) {
      return getSeriesId(item).length > 0 &&
        cleanText(item && item.title || "").length > 0;
    }).map(function(item) {
      return createPartialSeries(item, item.subtitle);
    });
  }

  // ---------------------------------------------------------------------------
  // Search / Filter Helpers
  // Keep tag-section construction next to the code which decodes included tags.
  // The production normal sources keep this as a coherent block.
  // ---------------------------------------------------------------------------

  function buildSearchTagSections(filterData) {
    var sections = [];
    var normalizedFilterData = isObject(filterData) ? filterData : {};
    var normalizedGenres = normalizeGenreOptions(normalizedFilterData.genres);
    var normalizedStatuses = pickFilterOptions(normalizedFilterData.statuses, SEARCH_STATUS_OPTIONS);
    var normalizedTypes = pickFilterOptions(normalizedFilterData.types, SEARCH_TYPE_OPTIONS);
    var normalizedSorts = normalizeFilterOptions(normalizedFilterData.sorts);
    var normalizedOrders = normalizeFilterOptions(normalizedFilterData.orders);

    if (normalizedGenres.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: normalizedGenres.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_GENRE + option.id,
            label: option.label
          });
        })
      }));
    }

    if (normalizedStatuses.length > 0) {
      sections.push(App.createTagSection({
        id: "status",
        label: "Status",
        tags: normalizedStatuses.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_STATUS + option.id,
            label: option.label
          });
        })
      }));
    }

    if (normalizedTypes.length > 0) {
      sections.push(App.createTagSection({
        id: "type",
        label: "Type",
        tags: normalizedTypes.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_TYPE + option.id,
            label: option.label
          });
        })
      }));
    }

    if (normalizedSorts.length > 0) {
      sections.push(App.createTagSection({
        id: "sort",
        label: "Sort",
        tags: normalizedSorts.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_SORT + option.id,
            label: option.label
          });
        })
      }));
    }

    if (normalizedOrders.length > 0) {
      sections.push(App.createTagSection({
        id: "order",
        label: "Order",
        tags: normalizedOrders.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_ORDER + option.id,
            label: option.label
          });
        })
      }));
    }

    return sections;
  }

  function pickFilterOptions(options, fallbackOptions) {
    var normalizedOptions = normalizeFilterOptions(options);
    if (normalizedOptions.length > 0) {
      return normalizedOptions;
    }
    return normalizeFilterOptions(fallbackOptions);
  }

  function normalizeGenreOptions(options) {
    return normalizeFilterOptions((Array.isArray(options) ? options : []).map(function(option) {
      return normalizeGenreOption(option);
    }).filter(Boolean));
  }

  function normalizeGenreOption(option) {
    var id = cleanText(option && option.id);
    var label = normalizeGenreLabel(option && (option.label || option.name || ""));

    if (id.length === 0 || label.length === 0) {
      return null;
    }

    return {
      id: id,
      label: label
    };
  }

  function extractSearchFilters(query) {
    var filters = {
      genres: [],
      status: void 0,
      type: void 0,
      sort: void 0,
      order: void 0
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];
    var seenGenres = {};

    includedTags.forEach(function(tag) {
      var tagId = String(tag && tag.id || "");

      if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0) {
        var genreId = tagId.slice(SEARCH_TAG_PREFIX_GENRE.length);
        if (genreId.length > 0 && !seenGenres[genreId]) {
          seenGenres[genreId] = true;
          filters.genres.push(genreId);
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0 && filters.status === void 0) {
        filters.status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0 && filters.type === void 0) {
        filters.type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_SORT) === 0 && filters.sort === void 0) {
        filters.sort = tagId.slice(SEARCH_TAG_PREFIX_SORT.length);
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_ORDER) === 0 && filters.order === void 0) {
        filters.order = tagId.slice(SEARCH_TAG_PREFIX_ORDER.length);
      }
    });

    return filters;
  }

  function normalizeFilterOptions(options) {
    var deduped = {};

    (Array.isArray(options) ? options : []).forEach(function(option) {
      var id = cleanText(option && option.id);
      var label = cleanText(option && option.label);
      if (id.length === 0 || label.length === 0) {
        return;
      }

      deduped[label.toLowerCase()] = {
        id: id,
        label: label
      };
    });

    return Object.keys(deduped).map(function(key) {
      return deduped[key];
    }).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  // ---------------------------------------------------------------------------
  // Detail Helpers
  // Keep detail-tag construction and metadata-specific helpers near details.
  // ---------------------------------------------------------------------------

  function buildDetailTagSections(details) {
    var sections = [];
    var genreTags = buildGenreTags(details && details.genres);
    var metadataTags = buildMetadataTags(details);

    if (genreTags.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags
      }));
    }

    if (metadataTags.length > 0) {
      sections.push(App.createTagSection({
        id: "metadata",
        label: "Metadata",
        tags: metadataTags
      }));
    }

    return sections;
  }

  function buildGenreTags(genres) {
    return normalizeGenreEntries(genres).map(function(genre) {
      var id = cleanText(genre && genre.id);
      var label = cleanText(genre && genre.label);

      if (id.length === 0 || label.length === 0) {
        return null;
      }

      return App.createTag({
        id: SEARCH_TAG_PREFIX_GENRE + id,
        label: label
      });
    }).filter(Boolean);
  }

  function normalizeGenreEntries(genres) {
    var seen = {};

    return (Array.isArray(genres) ? genres : []).map(function(genre) {
      var id = cleanText(genre && (genre.id || genre.slug || genre.name));
      var label = normalizeGenreLabel(genre && (genre.label || genre.name || genre.id || genre.slug || ""));
      var key = id.toLowerCase();

      if (id.length === 0 || label.length === 0 || seen[key]) {
        return null;
      }

      seen[key] = true;
      return {
        id: id,
        label: label
      };
    }).filter(Boolean);
  }

  function buildMetadataTags(details) {
    var entries = [
      { id: "type", label: "Type", value: details && details.type },
      { id: "released", label: "Released", value: details && details.released },
      { id: "serialization", label: "Serialization", value: details && details.serialization }
    ];

    return entries.map(function(entry) {
      var value = cleanText(entry.value);
      if (value.length === 0) {
        return null;
      }

      return App.createTag({
        id: entry.id + ":" + slugify(value),
        label: entry.label + ": " + value
      });
    }).filter(Boolean);
  }

  function buildTitles(primaryTitle, alternativeTitles) {
    var titles = [];

    addUniqueTitle(titles, primaryTitle);
    splitAlternativeTitles(alternativeTitles).forEach(function(title) {
      addUniqueTitle(titles, title);
    });

    return titles.length > 0 ? titles : ["Untitled"];
  }

  function addUniqueTitle(titles, value) {
    var clean = cleanText(value);
    if (clean.length > 0 && titles.indexOf(clean) === -1) {
      titles.push(clean);
    }
  }

  function splitAlternativeTitles(value) {
    return String(value || "").split(/\s*[•;\n\r]+\s*/).map(function(title) {
      return cleanText(title);
    }).filter(function(title) {
      return title.length > 0;
    });
  }

  function mapStatus(status) {
    var value = cleanText(status).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // ---------------------------------------------------------------------------
  // Chapter Helpers
  // Keep chapter naming, lock detection, and access-state helpers together.
  // This is one of the clearest shared patterns across the normal sources.
  // ---------------------------------------------------------------------------

  function getChapterId(entry) {
    if (!isObject(entry)) {
      return "";
    }

    if (entry.locked === true) {
      return buildLockedChapterId(entry);
    }

    return cleanText(entry.id || entry.slug);
  }

  function buildChapterName(number, title) {
    var cleanTitle = cleanText(title || "");
    if (cleanTitle.length > 0) {
      return "Chapter " + number + ": " + cleanTitle;
    }
    return number > 0 ? "Chapter " + number : "Chapter";
  }

  function buildReadableChapterLabel(entry, fallbackNumber) {
    var chapterNumber = toChapterNumber(entry && entry.number, fallbackNumber);
    return buildChapterName(chapterNumber, entry && entry.title);
  }

  function buildLockedChapterLabel(entry, fallbackNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(entry, fallbackNumber);
  }

  function buildChapterListName(entry, fallbackNumber) {
    return getChapterAccessState(entry) === CHAPTER_ACCESS_LOCKED ?
      buildLockedChapterLabel(entry, fallbackNumber) :
      buildReadableChapterLabel(entry, fallbackNumber);
  }

  function buildLockedChapterId(entry) {
    var slug = cleanText(entry && (entry.lockedSlug || entry.slug));
    if (slug.length === 0) {
      slug = slugify((entry && entry.seriesId || "series") + "-" + (entry && entry.number || "chapter"));
    }
    return LOCKED_CHAPTER_ID_PREFIX + slug;
  }

  function isLockedChapterId(chapterId) {
    return String(chapterId || "").indexOf(LOCKED_CHAPTER_ID_PREFIX) === 0;
  }

  async function getShowLockedChapters(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS)) === true;
  }

  function getChapterAccessState(entry) {
    if (!isObject(entry)) {
      return CHAPTER_ACCESS_UNKNOWN;
    }

    if (entry.locked === true || entry.requiresPurchase === true || entry.isFree === false) {
      return CHAPTER_ACCESS_LOCKED;
    }

    var price = toNumber(entry.price, NaN);
    if (isFinite(price)) {
      if (price > 0) {
        return CHAPTER_ACCESS_LOCKED;
      }
      if (price === 0) {
        return CHAPTER_ACCESS_READABLE;
      }
    }

    if (entry.locked === false || entry.requiresPurchase === false || entry.isFree === true) {
      return CHAPTER_ACCESS_READABLE;
    }

    return CHAPTER_ACCESS_UNKNOWN;
  }

  function shouldIncludeChapterForList(entry, showLockedChapters) {
    var accessState = getChapterAccessState(entry);

    if (accessState === CHAPTER_ACCESS_READABLE) {
      return true;
    }

    return showLockedChapters && accessState === CHAPTER_ACCESS_LOCKED;
  }

  // ---------------------------------------------------------------------------
  // Generic Utilities
  // Keep text/number/url helpers separate from source-specific logic.
  // ---------------------------------------------------------------------------

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function normalizeGenreLabel(value) {
    var rawLabel = cleanText(value || "");
    var key = toGenreNormalizationKey(rawLabel);

    if (key.length === 0) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    // Keep the automatic path mechanical. If a compound label only looks right
    // with a lowercased minor word, add a small explicit override instead of
    // introducing a broad repo-wide title-casing policy.
    return formatOptionLabel(rawLabel);
  }

  function toGenreNormalizationKey(value) {
    return cleanText(String(value || "").replace(/[_-]+/g, " "))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function formatOptionLabel(value) {
    var clean = cleanText(String(value || "")
      .replace(/_/g, " ")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
    if (clean.length === 0) {
      return "";
    }

    if (clean === clean.toUpperCase() || clean === clean.toLowerCase()) {
      return toTitleCase(clean);
    }

    return clean;
  }

  function cleanText(value) {
    var decoded = decodeEntities(String(value || ""));
    return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, function(_, code) {
        return safeCodePoint(code, 10);
      })
      .replace(/&#x([0-9a-f]+);/gi, function(_, code) {
        return safeCodePoint(code, 16);
      })
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function safeCodePoint(value, radix) {
    var numeric = parseInt(value, radix);
    if (!isFinite(numeric)) {
      return "";
    }

    try {
      return String.fromCodePoint(numeric);
    } catch (_) {
      return "";
    }
  }

  function slugify(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function toTitleCase(value) {
    return String(value || "").split(/\s+/).map(function(word) {
      return word.split("-").map(function(part) {
        if (part.length === 0) {
          return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join("-");
    }).join(" ").trim();
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return isFinite(numeric) ? numeric : fallback;
  }

  function toChapterNumber(value, fallback) {
    if (value === null || value === void 0 || value === "") {
      return fallback;
    }

    return toNumber(value, fallback);
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value || "");
    return clean.length > 0 ? clean : void 0;
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  // ---------------------------------------------------------------------------
  // Exports
  // Mirror the production source export shape at the bottom.
  // ---------------------------------------------------------------------------

  var exportedSources = {
    BaselineExampleInfo: BaselineExampleInfo,
    BaselineExample: BaselineExample
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
