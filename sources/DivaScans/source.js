"use strict";

(function() {
  // Constants

  var DOMAIN = "https://divascans.org";
  var AI_API_BASE = DOMAIN + "/api/ai";
  var BROWSE_API = DOMAIN + "/api/series";
  var FACETS_API = DOMAIN + "/api/series/facets";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var BADGE_COLOR_WARNING = "warning";
  var CONTENT_RATING_MATURE = "MATURE";
  var HOME_PAGE_SIZE = 20;
  var SEARCH_PAGE_SIZE = 20;
  var TAXONOMY_CACHE_MS = 30 * 60 * 1000;
  var SERIES_DETAILS_CACHE_MS = 15 * 1000;
  var SERIES_DETAILS_CACHE_LIMIT = 16;
  var READER_CHAPTER_MAP_CACHE_MS = 10 * 60 * 1000;
  var READER_CHAPTER_MAP_CACHE_LIMIT = 32;
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_updates";
  var SECTION_ID_NEWEST = "latest_releases";
  var SECTION_ID_TOP_RATED = "most_popular";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_TAG = "tag:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_ORIGIN = "origin:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var SEARCH_FIELD_MAX_CHAPTERS = "max_chapters";
  var SERIES_ID_SEPARATOR = "::";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var SORT_OPTIONS = [
    { id: "updated", label: "Recently Updated", apiValue: "updated" },
    { id: "popular", label: "Most Bookmarked", apiValue: "popular" },
    { id: "views", label: "Most Viewed", apiValue: "views" },
    { id: "longest", label: "Longest", apiValue: "longest" },
    { id: "trending", label: "Trending", apiValue: "trending" },
    { id: "rating", label: "Top Rated", apiValue: "rating" },
    { id: "newest", label: "Newest", apiValue: "newest" }
  ];
  var STATUS_OPTIONS = [
    { id: "ONGOING", label: "Ongoing", apiValue: "Ongoing" },
    { id: "COMPLETED", label: "Completed", apiValue: "Completed" },
    { id: "HIATUS", label: "Hiatus", apiValue: "Hiatus" },
    { id: "DROPPED", label: "Dropped", apiValue: "Dropped" },
    { id: "DISCONTINUED", label: "Discontinued", apiValue: "Discontinued" },
    { id: "UPCOMING", label: "Upcoming", apiValue: "Upcoming" }
  ];
  var ORIGIN_OPTIONS = [
    { id: "KOREAN", label: "Korean", apiValue: "KOREAN" },
    { id: "JAPANESE", label: "Japanese", apiValue: "JAPANESE" },
    { id: "CHINESE", label: "Chinese", apiValue: "CHINESE" },
    { id: "OTHER", label: "Other", apiValue: "OTHER" }
  ];
  var GENRE_LABEL_OVERRIDES = {
    "adult1": "Adult",
    "bdsm": "BDSM",
    "bl": "BL",
    "boys love bl": "Boys Love (BL)",
    "coming of age": "Coming of Age",
    "josei": "Josei",
    "joesi": "Josei",
    "ntr": "NTR",
    "one shot": "One Shot",
    "romace": "Romance",
    "sci fi": "Sci-Fi",
    "slice of life": "Slice of Life"
  };

  // Source Info

  var DivaScansInfo = {
    version: "2.0.0",
    name: "DivaScans",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
      {
        text: "18+",
        type: BADGE_COLOR_WARNING
      }
    ],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function DivaScans() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
      requestTimeout: 20000,
      interceptor: {
        interceptRequest: async function(request) {
          request.headers = Object.assign({}, request.headers || {}, {
            referer: DOMAIN + "/",
            origin: DOMAIN,
            accept: request.headers && request.headers.accept || "application/json, text/plain, */*",
            "user-agent": await this.requestManager.getDefaultUserAgent()
          });
          return request;
        }.bind(this),
        interceptResponse: async function(response) {
          return response;
        }
      }
    });

    this.stateManager = App.createSourceStateManager();
    this.cachedTaxonomy = null;
    this.cachedTaxonomyExpiresAt = 0;
    this.cachedTaxonomyPromise = null;
    this.cachedSeriesDetails = {};
    this.cachedSeriesDetailsOrder = [];
    this.cachedSeriesDetailsPromises = {};
    this.cachedReaderChapterMaps = {};
    this.cachedReaderChapterMapOrder = [];
  }

  // Paperback Interface Methods

  DivaScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  DivaScans.prototype.getTags = async function() {
    return this.getSearchTags();
  };

  DivaScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/comic/" + encodePathSegment(getSeriesWebSlug(seriesId));
  };

  DivaScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/chapter/" + encodePathSegment(chapterId);
  };

  DivaScans.prototype.getHomePageSections = async function(sectionCallback) {
    var source = this;
    var tasks = [
      { id: SECTION_ID_POPULAR, title: "Popular", type: "singleRowLarge", sort: "popular" },
      { id: SECTION_ID_LATEST, title: "Latest Updates", type: "singleRowNormal", sort: "updated" },
      { id: SECTION_ID_NEWEST, title: "Newly Added", type: "singleRowNormal", sort: "newest" },
      { id: SECTION_ID_TOP_RATED, title: "Top Rated", type: "singleRowNormal", sort: "rating" }
    ];

    await Promise.all(tasks.map(async function(task) {
      try {
        var page = await source.fetchBrowsePage(1, HOME_PAGE_SIZE, { sort: task.sort });
        var section = createHomeSection(
          task.id,
          task.title,
          task.type,
          mapSeriesItems(page.items),
          page.hasMore
        );
        if (section.items.length > 0) {
          sectionCallback(section);
        }
      } catch (error) {
        // One failed live feed should not suppress the remaining homepage sections.
      }
    }));
  };

  DivaScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var sortBySection = {};
    sortBySection[SECTION_ID_POPULAR] = "popular";
    sortBySection[SECTION_ID_LATEST] = "updated";
    sortBySection[SECTION_ID_NEWEST] = "newest";
    sortBySection[SECTION_ID_TOP_RATED] = "rating";

    var sort = sortBySection[homepageSectionId];
    if (!sort) {
      return App.createPagedResults({ results: [] });
    }

    var pageNumber = toPositiveInteger(metadata && metadata.page, 1);
    var page = await this.fetchBrowsePage(pageNumber, HOME_PAGE_SIZE, { sort: sort });
    return App.createPagedResults({
      results: mapSeriesItems(page.items),
      metadata: page.hasMore ? { page: pageNumber + 1 } : void 0
    });
  };

  DivaScans.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  DivaScans.prototype.getSourceMenu = async function() {
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

  DivaScans.prototype.supportsTagExclusion = async function() {
    // Paperback exposes exclusion source-wide. DivaScans maps genre/tag
    // exclusions directly and status/origin exclusions to allowed complements.
    // Sort is ordering rather than a result category, so it is not excludable.
    return true;
  };

  DivaScans.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchTaxonomy());
  };

  DivaScans.prototype.getSearchFields = async function() {
    return [
      createChapterCountSearchField(SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters", "e.g. 10"),
      createChapterCountSearchField(SEARCH_FIELD_MAX_CHAPTERS, "Maximum Chapters", "e.g. 100")
    ];
  };

  DivaScans.prototype.getMangaDetails = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);

    return App.createSourceManga({
      id: cleanText(seriesId),
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(series),
        image: normalizeUrl(series.cover_image),
        desc: cleanText(series.description || ""),
        author: emptyToUndefined(series.author),
        artist: emptyToUndefined(series.artist),
        status: mapStatus(series.status),
        rating: toNumber(series.rating, 0),
        tags: buildDetailTagSections(series),
        hentai: false
      })
    });
  };

  DivaScans.prototype.getChapters = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = normalizeChapterEntries(series.chapters).slice().sort(compareChaptersDesc);
    var visible = chapters.filter(function(chapter) {
      return showLockedChapters === true || chapter.is_premium !== true;
    }).map(function(chapter) {
      var chapterNumber = toChapterNumber(chapter.number, 0);
      return App.createChapter({
        id: String(chapterNumber),
        name: buildChapterListName(chapter, chapterNumber),
        chapNum: chapterNumber,
        time: parseDate(chapter.published_at),
        langCode: "en"
      });
    });

    if (visible.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return visible;
  };

  DivaScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var chapterNumber = toChapterNumber(chapterId, NaN);
    if (!isFinite(chapterNumber)) {
      throw new Error("DivaScans returned an invalid chapter number for " + chapterId + ".");
    }

    var cachedInternalId = this.getCachedReaderChapterId(seriesId, chapterNumber);
    if (cachedInternalId) {
      try {
        var cachedPages = await this.fetchReaderPagesByInternalId(cachedInternalId);
        if (cachedPages.length > 0) {
          return App.createChapterDetails({
            id: String(chapterId),
            mangaId: seriesId,
            pages: cachedPages
          });
        }
        this.evictCachedReaderChapterId(seriesId, chapterNumber);
      } catch (error) {
        if (isLockedChapterError(error)) {
          throw error;
        }
        this.evictCachedReaderChapterId(seriesId, chapterNumber);
        // Fall back to the live chapter page when a cached internal id goes stale.
      }
    }

    var html = await this.fetchText(buildChapterUrl(seriesId, chapterNumber));
    if (isChapterNotFoundPage(html)) {
      throw new Error("DivaScans no longer exposes chapter " + chapterId + " for " + seriesId + ".");
    }
    var readerChapter = extractReaderChapter(html, chapterNumber);
    this.cacheReaderChapterMap(seriesId, extractReaderChapterIds(html, readerChapter));
    if (isReaderChapterRedacted(readerChapter)) {
      throw createLockedChapterError();
    }
    var pages = normalizeReaderPages(readerChapter && readerChapter.pages);

    if (pages.length === 0) {
      throw new Error("DivaScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: String(chapterId),
      mangaId: seriesId,
      pages: pages
    });
  };

  DivaScans.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var filters = extractSearchFilters(query);
    var pageNumber = toPositiveInteger(metadata && metadata.page, 1);

    if (title.length > 0 && title.length < 2) {
      // The live browse backend treats one-character q values as an empty query.
      return App.createPagedResults({ results: [] });
    }
    if (filters.impossible || (filters.minChapters > 0 && filters.maxChapters > 0 && filters.minChapters > filters.maxChapters)) {
      return App.createPagedResults({ results: [] });
    }

    var page = await this.fetchBrowsePage(pageNumber, SEARCH_PAGE_SIZE, {
      query: title,
      genres: filters.genresIn,
      excludedGenres: filters.genresEx,
      tags: filters.tagsIn,
      excludedTags: filters.tagsEx,
      statuses: filters.statuses,
      origins: filters.origins,
      sort: filters.sortBy || "updated",
      minChapters: filters.minChapters,
      maxChapters: filters.maxChapters
    });

    var source = this;
    page.items.forEach(function(series) {
      source.cacheBrowseChapterIds(series);
    });

    return App.createPagedResults({
      results: mapSeriesItems(page.items),
      metadata: page.hasMore ? { page: pageNumber + 1 } : void 0
    });
  };

  // Source-Specific Fetch Helpers

  DivaScans.prototype.fetchBrowsePage = async function(page, limit, options) {
    var resolvedPage = toPositiveInteger(page, 1);
    var resolvedLimit = toPositiveInteger(limit, SEARCH_PAGE_SIZE);
    var params = {
      page: resolvedPage,
      limit: resolvedLimit,
      contentMode: "comics"
    };

    addParamIfPresent(params, "q", options && options.query);
    addListParam(params, "genre", options && options.genres);
    addListParam(params, "exgenre", options && options.excludedGenres);
    addListParam(params, "tag", options && options.tags);
    addListParam(params, "extag", options && options.excludedTags);
    addListParam(params, "status", options && options.statuses);
    addListParam(params, "origin", options && options.origins);
    addParamIfPresent(params, "sort", options && options.sort);

    var minChapters = toPositiveInteger(options && options.minChapters, 0);
    var maxChapters = toPositiveInteger(options && options.maxChapters, 0);
    if (minChapters > 0) {
      params.ch_min = minChapters;
    }
    if (maxChapters > 0) {
      params.ch_max = maxChapters;
    }

    var payload = await this.fetchJson(buildUrl(BROWSE_API, params));
    var items = normalizeSeriesPayloads(payload && payload.data);
    var meta = isObject(payload && payload.meta) ? payload.meta : {};

    return {
      items: items,
      hasMore: getBrowseHasMore(meta, items.length, resolvedPage, resolvedLimit)
    };
  };

  DivaScans.prototype.fetchTaxonomy = async function() {
    var now = Date.now();
    if (this.cachedTaxonomy && now < this.cachedTaxonomyExpiresAt) {
      return this.cachedTaxonomy;
    }
    if (this.cachedTaxonomyPromise) {
      return this.cachedTaxonomyPromise;
    }

    this.cachedTaxonomyPromise = (async function() {
      var payload = await this.fetchJson(FACETS_API);
      var taxonomy = {
        genres: normalizeFacetOptions(payload && payload.genres),
        tags: normalizeFacetOptions(payload && payload.tags),
        statuses: STATUS_OPTIONS.slice(),
        origins: ORIGIN_OPTIONS.slice(),
        sorts: SORT_OPTIONS.slice()
      };
      this.cachedTaxonomy = taxonomy;
      this.cachedTaxonomyExpiresAt = Date.now() + TAXONOMY_CACHE_MS;
      return taxonomy;
    }.bind(this))();

    try {
      return await this.cachedTaxonomyPromise;
    } finally {
      this.cachedTaxonomyPromise = null;
    }
  };

  DivaScans.prototype.fetchSeriesDetails = async function(seriesId) {
    var key = cleanText(seriesId).toLowerCase();
    if (key.length === 0) {
      throw new Error("DivaScans requires a series id.");
    }

    var cached = this.cachedSeriesDetails[key];
    if (cached && Date.now() < cached.expiresAt) {
      touchCacheKey(this.cachedSeriesDetailsOrder, key);
      return cached.value;
    }

    if (!this.cachedSeriesDetailsPromises[key]) {
      this.cachedSeriesDetailsPromises[key] = (async function() {
        var payload = await this.fetchJson(buildUrl(AI_API_BASE + "/series/" + encodePathSegment(getSeriesApiSlug(seriesId))));
        if (!isSeriesPayload(payload)) {
          throw new Error("Unable to decode the DivaScans series payload for " + seriesId + ".");
        }
        storeBoundedCacheEntry(
          this.cachedSeriesDetails,
          this.cachedSeriesDetailsOrder,
          key,
          { value: payload, expiresAt: Date.now() + SERIES_DETAILS_CACHE_MS },
          SERIES_DETAILS_CACHE_LIMIT
        );
        return payload;
      }.bind(this))();
    }

    var request = this.cachedSeriesDetailsPromises[key];
    try {
      return await request;
    } finally {
      if (this.cachedSeriesDetailsPromises[key] === request) {
        delete this.cachedSeriesDetailsPromises[key];
      }
    }
  };

  DivaScans.prototype.fetchReaderPagesByInternalId = async function(internalChapterId) {
    var payload = await this.fetchJson(DOMAIN + "/api/chapters/page-urls?chapterId=" + encodeURIComponent(internalChapterId));
    if (hasRedactedReaderPages(payload && payload.pages)) {
      throw createLockedChapterError();
    }
    return normalizeReaderPages(payload && payload.pages);
  };

  DivaScans.prototype.getCachedReaderChapterId = function(seriesId, chapterNumber) {
    var key = cleanText(seriesId).toLowerCase();
    var cached = this.cachedReaderChapterMaps[key];
    if (!cached || Date.now() >= cached.expiresAt) {
      return "";
    }
    touchCacheKey(this.cachedReaderChapterMapOrder, key);
    return cleanText(cached.value[String(chapterNumber)]);
  };

  DivaScans.prototype.cacheBrowseChapterIds = function(series) {
    var chapterMap = {};
    (Array.isArray(series && series.chapters) ? series.chapters : []).forEach(function(chapter) {
      var number = toChapterNumber(chapter && chapter.number, NaN);
      var id = cleanText(chapter && chapter.id);
      if (isFinite(number) && id.length > 0) {
        chapterMap[String(number)] = id;
      }
    });
    this.cacheReaderChapterMap(buildSeriesId(series), chapterMap);
  };

  DivaScans.prototype.cacheReaderChapterMap = function(seriesId, chapterMap) {
    var key = cleanText(seriesId).toLowerCase();
    if (key.length === 0 || !isObject(chapterMap) || Object.keys(chapterMap).length === 0) {
      return;
    }

    var current = this.cachedReaderChapterMaps[key];
    var merged = current && Date.now() < current.expiresAt && isObject(current.value) ?
      Object.assign({}, current.value, chapterMap) : Object.assign({}, chapterMap);

    storeBoundedCacheEntry(
      this.cachedReaderChapterMaps,
      this.cachedReaderChapterMapOrder,
      key,
      { value: merged, expiresAt: Date.now() + READER_CHAPTER_MAP_CACHE_MS },
      READER_CHAPTER_MAP_CACHE_LIMIT
    );
  };

  DivaScans.prototype.evictCachedReaderChapterId = function(seriesId, chapterNumber) {
    var key = cleanText(seriesId).toLowerCase();
    var cached = this.cachedReaderChapterMaps[key];
    if (cached && isObject(cached.value)) {
      delete cached.value[String(chapterNumber)];
    }
  };

  DivaScans.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET",
      headers: {
        accept: "application/json"
      }
    }), 1);
    return parseJsonResponse(response, url);
  };

  DivaScans.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml"
      }
    }), 1);
    return parseTextResponse(response, url);
  };

  // Response Helpers

  function parseJsonResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : JSON.stringify(response && response.data || "");
    ensureSuccessfulResponse(response, raw, url);

    if (isObject(response.data)) {
      return response.data;
    }

    try {
      return JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("DivaScans returned unreadable JSON from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureSuccessfulResponse(response, raw, url);
    return raw;
  }

  function ensureSuccessfulResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("DivaScans returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }
    if (response.status === 404) {
      throw new Error("The requested DivaScans page was not found.");
    }
    if (response.status >= 400) {
      throw new Error("DivaScans returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
    return (lower.indexOf("just a moment") !== -1 && lower.indexOf("cloudflare") !== -1) ||
      (lower.indexOf("be right back") !== -1 && lower.indexOf("maintenance") !== -1);
  }

  function buildUrl(base, params) {
    var entries = [];
    Object.keys(params || {}).forEach(function(key) {
      var value = params[key];
      if (value === void 0 || value === null || value === "") {
        return;
      }
      entries.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });
    return base + (entries.length > 0 ? "?" + entries.join("&") : "");
  }

  function buildChapterUrl(seriesId, chapterNumber) {
    return DOMAIN + "/series/comic/" + encodePathSegment(getSeriesWebSlug(seriesId)) + "/chapter/" + encodePathSegment(chapterNumber);
  }

  function buildSeriesId(series) {
    var apiSlug = cleanText(series && series.slug);
    var webSlug = cleanText(series && series.urlSlug);
    if (apiSlug.length === 0) {
      return "";
    }
    if (webSlug.length > 0 && webSlug !== apiSlug) {
      return apiSlug + SERIES_ID_SEPARATOR + webSlug;
    }
    return apiSlug;
  }

  function getSeriesApiSlug(seriesId) {
    return splitSeriesId(seriesId).apiSlug;
  }

  function getSeriesWebSlug(seriesId) {
    return splitSeriesId(seriesId).webSlug;
  }

  function splitSeriesId(seriesId) {
    var value = cleanText(seriesId);
    var separatorIndex = value.indexOf(SERIES_ID_SEPARATOR);
    if (separatorIndex === -1) {
      return { apiSlug: value, webSlug: value };
    }

    var apiSlug = cleanText(value.slice(0, separatorIndex));
    var webSlug = cleanText(value.slice(separatorIndex + SERIES_ID_SEPARATOR.length));
    return {
      apiSlug: apiSlug,
      webSlug: webSlug.length > 0 ? webSlug : apiSlug
    };
  }

  function formatRequestLabel(url) {
    var value = String(url || "");
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

  // Series / Card Helpers

  function normalizeSeriesPayloads(seriesList) {
    var seen = {};
    var items = [];
    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      if (!isSeriesPayload(series) || !isComicType(series.type)) {
        return;
      }
      var slug = cleanText(series.slug);
      if (slug.length === 0 || seen[slug]) {
        return;
      }
      seen[slug] = true;
      items.push(series);
    });
    return items;
  }

  function isSeriesPayload(series) {
    return isObject(series) && typeof series.slug === "string" && typeof series.title === "string";
  }

  function isComicType(type) {
    var value = cleanText(type).toUpperCase();
    return value === "MANGA" || value === "MANHWA" || value === "MANHUA" || value === "WEBTOON" || value === "COMIC";
  }

  function createPartialSeries(series) {
    return App.createPartialSourceManga({
      mangaId: buildSeriesId(series),
      title: cleanText(series.title),
      image: normalizeUrl(series.cover_image || series.coverImage),
      subtitle: buildSeriesSubtitle(series)
    });
  }

  function mapSeriesItems(items) {
    return normalizeSeriesPayloads(items).map(createPartialSeries);
  }

  function buildSeriesSubtitle(series) {
    var chapterCount = toPositiveInteger(series && series.chapter_count, 0);
    if (chapterCount > 0) {
      return chapterCount + (chapterCount === 1 ? " chapter" : " chapters");
    }

    var latestChapter = findLatestPreviewChapter(series && series.chapters);
    if (latestChapter) {
      var chapterNumber = toChapterNumber(latestChapter.number, 0);
      var label = "Chapter " + chapterNumber;
      return latestChapter.isLocked === true ? LOCKED_CHAPTER_LABEL_PREFIX + label : label;
    }

    var status = formatOptionLabel(series && series.status);
    return status.length > 0 ? status : void 0;
  }

  function findLatestPreviewChapter(chapters) {
    var latest = null;
    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      if (!latest || toChapterNumber(chapter && chapter.number, 0) > toChapterNumber(latest.number, 0)) {
        latest = chapter;
      }
    });
    return latest;
  }

  // Homepage Helpers

  function createHomeSection(id, title, type, items, containsMoreItems) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: type,
      items: Array.isArray(items) ? items : [],
      containsMoreItems: containsMoreItems === true
    });
  }

  // Search / Filter Helpers

  function buildSearchTagSections(taxonomy) {
    var sections = [];
    var genres = Array.isArray(taxonomy && taxonomy.genres) ? taxonomy.genres : [];
    var tags = Array.isArray(taxonomy && taxonomy.tags) ? taxonomy.tags : [];

    if (genres.length > 0) {
      sections.push(createOptionTagSection("genres", "Genres", SEARCH_TAG_PREFIX_GENRE, genres));
    }
    if (tags.length > 0) {
      sections.push(createOptionTagSection("tags", "Tags", SEARCH_TAG_PREFIX_TAG, tags));
    }

    sections.push(createOptionTagSection("status", "Status", SEARCH_TAG_PREFIX_STATUS, STATUS_OPTIONS));
    sections.push(createOptionTagSection("origin", "Origin", SEARCH_TAG_PREFIX_ORIGIN, ORIGIN_OPTIONS));
    sections.push(createOptionTagSection("sort", "Sort", SEARCH_TAG_PREFIX_SORT, SORT_OPTIONS));
    return sections;
  }

  function createOptionTagSection(id, label, prefix, options) {
    return App.createTagSection({
      id: id,
      label: label,
      tags: options.map(function(option) {
        return App.createTag({
          id: prefix + option.id,
          label: option.label
        });
      })
    });
  }

  function extractSearchFilters(query) {
    var filters = {
      genresIn: [],
      genresEx: [],
      tagsIn: [],
      tagsEx: [],
      statuses: [],
      statusesEx: [],
      origins: [],
      originsEx: [],
      sortBy: void 0,
      minChapters: extractChapterCountField(query, SEARCH_FIELD_MIN_CHAPTERS),
      maxChapters: extractChapterCountField(query, SEARCH_FIELD_MAX_CHAPTERS),
      impossible: false
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];
    var excludedTags = Array.isArray(query && query.excludedTags) ? query.excludedTags : [];

    includedTags.forEach(function(tag) {
      var id = String(tag && tag.id || "");
      var value;

      if (id.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0) {
        pushUnique(filters.genresIn, id.slice(SEARCH_TAG_PREFIX_GENRE.length));
      } else if (id.indexOf(SEARCH_TAG_PREFIX_TAG) === 0) {
        pushUnique(filters.tagsIn, id.slice(SEARCH_TAG_PREFIX_TAG.length));
      } else if (id.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0) {
        value = getOptionApiValue(STATUS_OPTIONS, id.slice(SEARCH_TAG_PREFIX_STATUS.length));
        if (value) pushUnique(filters.statuses, value);
      } else if (id.indexOf(SEARCH_TAG_PREFIX_ORIGIN) === 0) {
        value = getOptionApiValue(ORIGIN_OPTIONS, id.slice(SEARCH_TAG_PREFIX_ORIGIN.length));
        if (value) pushUnique(filters.origins, value);
      } else if (id.indexOf(SEARCH_TAG_PREFIX_SORT) === 0 && filters.sortBy === void 0) {
        value = getOptionApiValue(SORT_OPTIONS, id.slice(SEARCH_TAG_PREFIX_SORT.length));
        if (value) filters.sortBy = value;
      }
    });

    excludedTags.forEach(function(tag) {
      var id = String(tag && tag.id || "");
      var value;
      if (id.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0) {
        pushUnique(filters.genresEx, id.slice(SEARCH_TAG_PREFIX_GENRE.length));
      } else if (id.indexOf(SEARCH_TAG_PREFIX_TAG) === 0) {
        pushUnique(filters.tagsEx, id.slice(SEARCH_TAG_PREFIX_TAG.length));
      } else if (id.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0) {
        value = getOptionApiValue(STATUS_OPTIONS, id.slice(SEARCH_TAG_PREFIX_STATUS.length));
        if (value) pushUnique(filters.statusesEx, value);
      } else if (id.indexOf(SEARCH_TAG_PREFIX_ORIGIN) === 0) {
        value = getOptionApiValue(ORIGIN_OPTIONS, id.slice(SEARCH_TAG_PREFIX_ORIGIN.length));
        if (value) pushUnique(filters.originsEx, value);
      }
    });

    var hadIncludedStatuses = filters.statuses.length > 0;
    var hadIncludedOrigins = filters.origins.length > 0;
    filters.statuses = resolveIncludedOptions(filters.statuses, filters.statusesEx, STATUS_OPTIONS);
    filters.origins = resolveIncludedOptions(filters.origins, filters.originsEx, ORIGIN_OPTIONS);
    if (filters.statusesEx.length >= STATUS_OPTIONS.length ||
        filters.originsEx.length >= ORIGIN_OPTIONS.length ||
        (hadIncludedStatuses && filters.statuses.length === 0) ||
        (hadIncludedOrigins && filters.origins.length === 0)) {
      filters.impossible = true;
    }

    return filters;
  }

  function resolveIncludedOptions(included, excluded, options) {
    var values = Array.isArray(included) ? included.slice() : [];
    var excludedValues = Array.isArray(excluded) ? excluded : [];

    if (values.length === 0 && excludedValues.length > 0) {
      values = options.map(function(option) {
        return option.apiValue;
      });
    }

    return values.filter(function(value) {
      return excludedValues.indexOf(value) === -1;
    });
  }

  function createChapterCountSearchField(id, name, placeholder) {
    var field = {
      id: id,
      name: name,
      placeholder: placeholder
    };
    return typeof App !== "undefined" && App && typeof App.createSearchField === "function" ? App.createSearchField(field) : field;
  }

  function extractChapterCountField(query, fieldId) {
    var parameters = isObject(query && query.parameters) ? query.parameters : {};
    var values = Array.isArray(parameters[fieldId]) ? parameters[fieldId] : [];
    for (var index = 0; index < values.length; index += 1) {
      var value = toPositiveInteger(cleanText(values[index]), 0);
      if (value > 0) {
        return value;
      }
    }
    return 0;
  }

  function getOptionApiValue(options, id) {
    var value = cleanText(id);
    for (var index = 0; index < options.length; index += 1) {
      if (options[index].id === value) {
        return options[index].apiValue;
      }
    }
    return "";
  }

  function normalizeFacetOptions(values) {
    var deduped = {};
    (Array.isArray(values) ? values : []).forEach(function(entry) {
      var rawName = cleanText(entry && entry.name);
      var label = normalizeGenreLabel(rawName);
      var id = cleanText(entry && entry.slug) || toSiteSlug(rawName);
      var count = toNumber(entry && entry.count, 0);
      if (rawName.length === 0 || label.length === 0 || id.length === 0 || count <= 0) {
        return;
      }
      if (!deduped[id] || count > deduped[id].count) {
        deduped[id] = {
          id: id,
          label: label,
          apiValue: id,
          count: count
        };
      }
    });
    return Object.keys(deduped).map(function(id) {
      return deduped[id];
    }).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  function getBrowseHasMore(meta, itemCount, currentPage, pageSize) {
    if (meta && typeof meta.hasMore === "boolean") {
      return meta.hasMore;
    }
    var totalPages = toPositiveInteger(meta && meta.totalPages, 0);
    if (totalPages > 0) {
      return totalPages > currentPage;
    }
    var total = toPositiveInteger(meta && meta.total, 0);
    if (total > 0) {
      return total > currentPage * pageSize;
    }
    return toPositiveInteger(itemCount, 0) >= pageSize;
  }

  function addParamIfPresent(params, key, value) {
    var cleaned = cleanText(value);
    if (cleaned.length > 0) {
      params[key] = cleaned;
    }
  }

  function addListParam(params, key, values) {
    var cleaned = [];
    (Array.isArray(values) ? values : []).forEach(function(value) {
      var item = cleanText(value);
      if (item.length > 0 && cleaned.indexOf(item) === -1) {
        cleaned.push(item);
      }
    });
    if (cleaned.length > 0) {
      params[key] = cleaned.join(",");
    }
  }

  function pushUnique(values, value) {
    var cleaned = cleanText(value);
    if (cleaned.length > 0 && values.indexOf(cleaned) === -1) {
      values.push(cleaned);
    }
  }

  // Detail Helpers

  function buildTitles(series) {
    var titles = [];
    addUniqueTitle(titles, series && series.title);
    addUniqueTitle(titles, series && series.original_title);
    (Array.isArray(series && series.alternative_titles) ? series.alternative_titles : []).forEach(function(title) {
      addUniqueTitle(titles, title);
    });
    return titles.length > 0 ? titles : ["Untitled"];
  }

  function addUniqueTitle(titles, value) {
    var title = cleanText(value);
    if (title.length > 0 && titles.indexOf(title) === -1) {
      titles.push(title);
    }
  }

  function buildDetailTagSections(series) {
    var sections = [];
    var genreTags = buildDetailTags(series && series.genres, SEARCH_TAG_PREFIX_GENRE);
    var seriesTags = buildDetailTags(series && series.tags, SEARCH_TAG_PREFIX_TAG);

    if (genreTags.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags
      }));
    }
    if (seriesTags.length > 0) {
      sections.push(App.createTagSection({
        id: "tags",
        label: "Tags",
        tags: seriesTags
      }));
    }
    return sections;
  }

  function buildDetailTags(values, prefix) {
    var tags = [];
    var seen = {};
    (Array.isArray(values) ? values : []).forEach(function(name) {
      var label = normalizeGenreLabel(name);
      var id = toSiteSlug(name);
      if (id.length === 0 || seen[id]) {
        return;
      }
      seen[id] = true;
      tags.push(App.createTag({
        id: prefix + id,
        label: label
      }));
    });
    return tags;
  }

  function normalizeGenreLabel(value) {
    var raw = cleanText(value);
    var key = toGenreNormalizationKey(raw);
    if (key.length === 0) {
      return "";
    }
    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }
    return formatOptionLabel(raw);
  }

  function toGenreNormalizationKey(value) {
    return cleanText(String(value || "").replace(/[_-]+/g, " "))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function toSiteSlug(value) {
    return cleanText(value).toLowerCase()
      .replace(/[()]/g, "")
      .replace(/\//g, "")
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function mapStatus(status) {
    var value = cleanText(status).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function normalizeChapterEntries(chapters) {
    var seen = {};
    var normalized = [];
    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      var number = toChapterNumber(chapter && chapter.number, NaN);
      if (!isObject(chapter) || !isFinite(number)) {
        return;
      }
      var key = String(number);
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      normalized.push(chapter);
    });
    return normalized;
  }

  function compareChaptersDesc(left, right) {
    return toChapterNumber(right && right.number, 0) - toChapterNumber(left && left.number, 0);
  }

  function buildChapterListName(chapter, fallbackNumber) {
    var name = buildReadableChapterLabel(chapter, fallbackNumber);
    return chapter && chapter.is_premium === true ? LOCKED_CHAPTER_LABEL_PREFIX + name : name;
  }

  function buildReadableChapterLabel(chapter, fallbackNumber) {
    var number = toChapterNumber(chapter && chapter.number, fallbackNumber);
    var title = cleanText(chapter && chapter.title);
    var defaultTitle = "chapter " + String(number).toLowerCase();
    if (title.length > 0 && title.toLowerCase() !== defaultTitle) {
      return "Chapter " + number + ": " + title;
    }
    return "Chapter " + number;
  }

  function extractReaderChapter(html, chapterNumber) {
    var chunks = decodeNextFlightChunks(html);
    var candidates = [];
    for (var index = 0; index < chunks.length; index += 1) {
      candidates = candidates.concat(extractJsonObjectValues(chunks[index], "chapter"));
    }

    for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      var candidate = candidates[candidateIndex];
      if (isObject(candidate) && Array.isArray(candidate.pages) && toChapterNumber(candidate.number, NaN) === chapterNumber) {
        return candidate;
      }
    }
    return null;
  }

  function extractReaderChapterIds(html, currentChapter) {
    var chunks = decodeNextFlightChunks(html);
    var chapterIds = {};

    for (var index = 0; index < chunks.length; index += 1) {
      var arrays = extractJsonArrayValues(chunks[index], "allChapters");
      arrays.forEach(function(chapters) {
        chapters.forEach(function(chapter) {
          var number = toChapterNumber(chapter && chapter.number, NaN);
          var id = cleanText(chapter && chapter.id);
          if (isFinite(number) && id.length > 0) {
            chapterIds[String(number)] = id;
          }
        });
      });
    }

    var currentNumber = toChapterNumber(currentChapter && currentChapter.number, NaN);
    var currentId = cleanText(currentChapter && currentChapter.id);
    if (isFinite(currentNumber) && currentId.length > 0) {
      chapterIds[String(currentNumber)] = currentId;
    }
    return chapterIds;
  }

  function normalizeReaderPages(pages) {
    return (Array.isArray(pages) ? pages : []).filter(function(page) {
      return isObject(page) && page.isRedacted !== true && cleanText(page.imageUrl).length > 0;
    }).slice().sort(function(left, right) {
      return toNumber(left.pageNumber, 0) - toNumber(right.pageNumber, 0);
    }).map(function(page) {
      return normalizeUrl(page.imageUrl);
    }).filter(function(url) {
      return url.length > 0;
    });
  }

  function hasRedactedReaderPages(pages) {
    var list = Array.isArray(pages) ? pages : [];
    return list.some(function(page) {
      return isObject(page) && page.isRedacted === true;
    });
  }

  function isReaderChapterRedacted(chapter) {
    return isObject(chapter) && hasRedactedReaderPages(chapter.pages);
  }

  function isChapterNotFoundPage(html) {
    return /<title[^>]*>\s*chapter\s+not\s+found\b/i.test(String(html || ""));
  }

  function createLockedChapterError() {
    var error = new Error("This chapter is locked on DivaScans and cannot be loaded in Paperback.");
    error.divaScansLockedChapter = true;
    return error;
  }

  function isLockedChapterError(error) {
    return isObject(error) && error.divaScansLockedChapter === true;
  }

  function decodeNextFlightChunks(html) {
    var chunks = [];
    var source = String(html || "");
    var marker = "self.__next_f.push(";
    var start = 0;

    while (start < source.length) {
      var markerIndex = source.indexOf(marker, start);
      if (markerIndex === -1) {
        break;
      }
      var payload = extractJsonValueAtIndex(source, markerIndex + marker.length);
      if (Array.isArray(payload) && payload[0] === 1 && typeof payload[1] === "string") {
        chunks.push(payload[1]);
      }
      start = markerIndex + marker.length;
    }
    return chunks;
  }

  function extractJsonObjectValues(source, key) {
    return extractJsonValues(source, key, false);
  }

  function extractJsonArrayValues(source, key) {
    return extractJsonValues(source, key, true);
  }

  function extractJsonValues(source, key, arraysOnly) {
    var results = [];
    var marker = '"' + String(key || "") + '":';
    var start = 0;
    while (start < source.length) {
      var markerIndex = source.indexOf(marker, start);
      if (markerIndex === -1) {
        break;
      }
      var value = extractJsonValueAtIndex(source, markerIndex + marker.length);
      if ((arraysOnly && Array.isArray(value)) || (!arraysOnly && isObject(value) && !Array.isArray(value))) {
        results.push(value);
      }
      start = markerIndex + marker.length;
    }
    return results;
  }

  function extractJsonValueAtIndex(source, valueIndex) {
    var index = valueIndex;
    while (index < source.length && /\s/.test(source.charAt(index))) {
      index += 1;
    }
    var open = source.charAt(index);
    var close = open === "{" ? "}" : open === "[" ? "]" : "";
    if (close.length === 0) {
      return null;
    }

    var depth = 0;
    var inString = false;
    var escaped = false;
    for (var charIndex = index; charIndex < source.length; charIndex += 1) {
      var character = source.charAt(charIndex);
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === open) {
        depth += 1;
      } else if (character === close) {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(index, charIndex + 1));
          } catch (error) {
            return null;
          }
        }
      }
    }
    return null;
  }

  async function getShowLockedChapters(stateManager) {
    return await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS) === true;
  }

  // Generic Utilities

  function parseDate(value) {
    var parsed = new Date(String(value || ""));
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function cleanText(value) {
    return decodeEntities(String(value || "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&#x([0-9a-f]+);/gi, function(match, code) {
        return safeCodePoint(parseInt(code, 16));
      })
      .replace(/&#([0-9]+);/g, function(match, code) {
        return safeCodePoint(parseInt(code, 10));
      })
      .replace(/&quot;/gi, "\"")
      .replace(/&apos;|&#39;|&#x27;/gi, "'")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ");
  }

  function safeCodePoint(code) {
    if (!isFinite(code) || code <= 0) {
      return "";
    }
    try {
      return typeof String.fromCodePoint === "function" ? String.fromCodePoint(code) : String.fromCharCode(code);
    } catch (error) {
      return "";
    }
  }

  function normalizeUrl(value) {
    var url = cleanText(value);
    if (url.length === 0) {
      return "";
    }
    if (url.indexOf("//") === 0) {
      return "https:" + url;
    }
    if (url.charAt(0) === "/") {
      return DOMAIN + url;
    }
    return url;
  }

  function formatOptionLabel(value) {
    var clean = cleanText(String(value || "").replace(/_/g, " "));
    if (clean.length === 0) {
      return "";
    }
    if (clean === clean.toUpperCase() || clean === clean.toLowerCase()) {
      return toTitleCase(clean);
    }
    return clean;
  }

  function toTitleCase(value) {
    return String(value || "").split(/\s+/).map(function(word) {
      return word.split("-").map(function(part) {
        return part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part;
      }).join("-");
    }).join(" ").trim();
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : fallback;
  }

  function toPositiveInteger(value, fallback) {
    var parsed = Math.floor(toNumber(value, fallback));
    return parsed > 0 ? parsed : fallback;
  }

  function toChapterNumber(value, fallback) {
    if (value === null || value === void 0 || value === "") {
      return fallback;
    }
    return toNumber(value, fallback);
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value);
    return clean.length > 0 ? clean : void 0;
  }

  function touchCacheKey(order, key) {
    var index = order.indexOf(key);
    if (index !== -1) {
      order.splice(index, 1);
    }
    order.push(key);
  }

  function storeBoundedCacheEntry(cache, order, key, entry, limit) {
    cache[key] = entry;
    touchCacheKey(order, key);
    while (order.length > limit) {
      var oldest = order.shift();
      if (oldest !== void 0 && oldest !== key) {
        delete cache[oldest];
      }
    }
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  // Exports

  var exportedSources = {
    DivaScansInfo: DivaScansInfo,
    DivaScans: DivaScans
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
