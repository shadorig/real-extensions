"use strict";

(function() {
  // Constants

  var DOMAIN = "https://elftoon.net";
  var AI_API_BASE = DOMAIN + "/api/ai";
  var BROWSE_API = DOMAIN + "/api/series";
  var FACETS_API = DOMAIN + "/api/series/facets";
  var SEARCH_API = DOMAIN + "/api/search";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var HOME_PAGE_SIZE = 20;
  var SEARCH_PAGE_SIZE = 20;
  var BROWSE_PAGE_CACHE_MS = 15 * 1000;
  var BROWSE_PAGE_CACHE_LIMIT = 32;
  var TAXONOMY_CACHE_MS = 30 * 60 * 1000;
  var SERIES_DETAILS_CACHE_MS = 60 * 1000;
  var SERIES_DETAILS_CACHE_LIMIT = 16;
  var READER_CHAPTER_MAP_CACHE_MS = 12 * 60 * 60 * 1000;
  var READER_CHAPTER_MAP_CACHE_LIMIT = 32;
  var SERIES_INTERNAL_ID_CACHE_LIMIT = 128;
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_updates";
  var SECTION_ID_NEWEST = "latest_releases";
  var SECTION_ID_TOP_RATED = "most_popular";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_TAG = "tag:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_ORIGIN = "origin:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var SEARCH_FIELD_MAX_CHAPTERS = "max_chapters";
  var SERIES_ID_SEPARATOR = "::";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_ID_PREFIX = "locked::";
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
  var TYPE_OPTIONS = [
    { id: "MANGA", label: "Manga", apiValue: "Manga" },
    { id: "MANHWA", label: "Manhwa", apiValue: "Manhwa" },
    { id: "MANHUA", label: "Manhua", apiValue: "Manhua" },
    { id: "WEBTOON", label: "Webtoon", apiValue: "Webtoon" }
  ];
  var ORIGIN_OPTIONS = [
    { id: "KOREAN", label: "Korean", apiValue: "KOREAN" },
    { id: "JAPANESE", label: "Japanese", apiValue: "JAPANESE" },
    { id: "CHINESE", label: "Chinese", apiValue: "CHINESE" },
    { id: "OTHER", label: "Other", apiValue: "OTHER" }
  ];
  var GENRE_LABEL_OVERRIDES = {};

  // Source Info

  var ElfToonInfo = {
    version: "1.1.0",
    name: "ElfToon",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function ElfToon() {
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
    this.cachedBrowsePages = {};
    this.cachedBrowsePageOrder = [];
    this.cachedBrowsePagePromises = {};
    this.cachedSeriesDetails = {};
    this.cachedSeriesDetailsOrder = [];
    this.cachedSeriesDetailsPromises = {};
    this.cachedReaderChapterMaps = {};
    this.cachedReaderChapterMapOrder = [];
    this.cachedSeriesInternalIds = {};
    this.cachedSeriesInternalIdOrder = [];
  }

  // Paperback Interface Methods

  ElfToon.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  ElfToon.prototype.getTags = async function() {
    return this.getSearchTags();
  };

  ElfToon.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/comic/" + encodePathSegment(getSeriesWebSlug(seriesId));
  };

  ElfToon.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    var chapterNumber = getChapterNumberFromId(seriesId, chapterId);
    var chapterPath = isFinite(chapterNumber) ? formatChapterNumber(chapterNumber) : cleanText(chapterId);
    return this.getMangaShareUrl(seriesId) + "/chapter/" + encodePathSegment(chapterPath);
  };

  ElfToon.prototype.getHomePageSections = async function(sectionCallback) {
    var source = this;
    var tasks = [
      { id: SECTION_ID_POPULAR, title: "Popular Today", type: "singleRowLarge", sort: "views" },
      { id: SECTION_ID_LATEST, title: "Latest Updates", type: "singleRowNormal", sort: "updated" },
      { id: SECTION_ID_NEWEST, title: "Newly Added", type: "singleRowNormal", sort: "newest" },
      { id: SECTION_ID_TOP_RATED, title: "Top Rated", type: "singleRowNormal", sort: "rating" }
    ];

    var sections = await Promise.all(tasks.map(async function(task) {
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
          return section;
        }
      } catch (error) {
        // One failed live feed should not suppress the remaining homepage sections.
      }
      return null;
    }));

    sections.forEach(function(section) {
      if (section) {
        sectionCallback(section);
      }
    });
  };

  ElfToon.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var sortBySection = {};
    sortBySection[SECTION_ID_POPULAR] = "views";
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

  ElfToon.prototype.getSourceMenu = async function() {
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

  ElfToon.prototype.supportsTagExclusion = async function() {
    // Paperback exposes exclusion source-wide. ElfToon maps genre/tag
    // exclusions directly and type/status/origin exclusions to allowed complements.
    // Sort is ordering rather than a result category, so it is not excludable.
    return true;
  };

  ElfToon.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchTaxonomy());
  };

  ElfToon.prototype.getSearchFields = async function() {
    return [
      createChapterCountSearchField(SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters", "e.g. 10"),
      createChapterCountSearchField(SEARCH_FIELD_MAX_CHAPTERS, "Maximum Chapters", "e.g. 100")
    ];
  };

  ElfToon.prototype.getMangaDetails = async function(seriesId) {
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
        rating: normalizeRating(series.rating),
        tags: buildDetailTagSections(series),
        hentai: false
      })
    });
  };

  ElfToon.prototype.getChapters = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = normalizeChapterEntries(series.chapters).slice().sort(compareChaptersDesc);
    var visible = chapters.filter(function(chapter) {
      return showLockedChapters === true || chapter.is_premium !== true;
    }).map(function(chapter) {
      var chapterNumber = toChapterNumber(chapter.number, 0);
      var chapterId = buildLegacyChapterId(seriesId, chapterNumber);
      if (chapter.is_premium === true) {
        chapterId = LOCKED_CHAPTER_ID_PREFIX + chapterId;
      }
      return App.createChapter({
        id: chapterId,
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

  ElfToon.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var chapterNumber = getChapterNumberFromId(seriesId, chapterId);
    if (!isFinite(chapterNumber)) {
      throw new Error("ElfToon returned an invalid chapter number for " + chapterId + ".");
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

    var internalSeriesId = this.getCachedSeriesInternalId(seriesId);
    if (internalSeriesId.length === 0) {
      try {
        internalSeriesId = await this.resolveSeriesInternalIdFromCachedDetails(seriesId);
      } catch (error) {
        internalSeriesId = "";
      }
    }

    if (internalSeriesId.length > 0) {
      try {
        var directChapter = await this.fetchReaderChapterBySeriesInternalId(seriesId, internalSeriesId, chapterNumber);
        if (directChapter) {
          var directChapterId = cleanText(directChapter.id);
          if (directChapterId.length > 0) {
            var directMap = {};
            directMap[String(chapterNumber)] = directChapterId;
            this.cacheReaderChapterMap(seriesId, directMap);
          }
          if (directChapter.hasAccess === false || hasRedactedReaderPages(directChapter.pages)) {
            throw createLockedChapterError();
          }
          var directPages = await this.resolveReaderPages(directChapter);
          if (directPages.length > 0) {
            return App.createChapterDetails({
              id: String(chapterId),
              mangaId: seriesId,
              pages: directPages
            });
          }
        }
      } catch (error) {
        if (isLockedChapterError(error)) {
          throw error;
        }
        // Fall back to the server-rendered reader payload if the direct API moves.
      }
    }

    var html = await this.fetchText(buildChapterUrl(seriesId, chapterNumber));
    if (isChapterNotFoundPage(html)) {
      throw new Error("ElfToon no longer exposes chapter " + chapterId + " for " + seriesId + ".");
    }
    var readerPayload = extractReaderPayload(html, chapterNumber);
    var readerChapter = readerPayload.chapter;
    this.cacheReaderChapterMap(seriesId, readerPayload.chapterIds);
    if (isReaderChapterRedacted(readerChapter)) {
      throw createLockedChapterError();
    }
    var pages = await this.resolveReaderPages(readerChapter);

    if (pages.length === 0) {
      throw new Error("ElfToon did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: String(chapterId),
      mangaId: seriesId,
      pages: pages
    });
  };

  ElfToon.prototype.getSearchResults = async function(query, metadata) {
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
      types: filters.types,
      origins: filters.origins,
      sort: filters.sortBy || "updated",
      minChapters: filters.minChapters,
      maxChapters: filters.maxChapters
    });

    if (pageNumber === 1 && title.length >= 2 && !hasActiveSearchFilters(filters) && page.items.length === 0) {
      var keywordItems = await this.fetchKeywordSearch(title);
      if (keywordItems.length > 0) {
        return App.createPagedResults({
          results: mapSeriesItems(keywordItems)
        });
      }
    }

    return App.createPagedResults({
      results: mapSeriesItems(page.items),
      metadata: page.hasMore ? { page: pageNumber + 1 } : void 0
    });
  };

  ElfToon.prototype.fetchKeywordSearch = async function(query) {
    var payload = await this.fetchJson(buildUrl(SEARCH_API, {
      q: cleanText(query),
      contentMode: "comics"
    }));
    var items = normalizeSeriesPayloads(payload && payload.series);
    this.cacheBrowseSeriesData(items);
    return items;
  };

  // Source-Specific Fetch Helpers

  ElfToon.prototype.fetchBrowsePage = async function(page, limit, options) {
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
    addListParam(params, "type", options && options.types);
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

    var url = buildUrl(BROWSE_API, params);
    var cached = this.cachedBrowsePages[url];
    if (cached && Date.now() < cached.expiresAt) {
      touchCacheKey(this.cachedBrowsePageOrder, url);
      this.cacheBrowseSeriesData(cached.value.items);
      return cached.value;
    }
    if (this.cachedBrowsePagePromises[url]) {
      return this.cachedBrowsePagePromises[url];
    }

    this.cachedBrowsePagePromises[url] = (async function() {
      var payload = await this.fetchJson(url);
      var items = normalizeSeriesPayloads(payload && payload.data);
      var meta = isObject(payload && payload.meta) ? payload.meta : {};
      var result = {
        items: items,
        hasMore: getBrowseHasMore(meta, items.length, resolvedPage, resolvedLimit)
      };
      this.cacheBrowseSeriesData(items);
      storeBoundedCacheEntry(
        this.cachedBrowsePages,
        this.cachedBrowsePageOrder,
        url,
        { value: result, expiresAt: Date.now() + BROWSE_PAGE_CACHE_MS },
        BROWSE_PAGE_CACHE_LIMIT
      );
      return result;
    }.bind(this))();

    var request = this.cachedBrowsePagePromises[url];
    try {
      return await request;
    } finally {
      if (this.cachedBrowsePagePromises[url] === request) {
        delete this.cachedBrowsePagePromises[url];
      }
    }
  };

  ElfToon.prototype.fetchTaxonomy = async function() {
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
        types: TYPE_OPTIONS.slice(),
        origins: ORIGIN_OPTIONS.slice(),
        sorts: SORT_OPTIONS.slice()
      };
      this.cachedTaxonomy = taxonomy;
      this.cachedTaxonomyExpiresAt = Date.now() + TAXONOMY_CACHE_MS;
      return taxonomy;
    }.bind(this))();

    try {
      return await this.cachedTaxonomyPromise;
    } catch (error) {
      if (this.cachedTaxonomy) {
        return this.cachedTaxonomy;
      }
      throw error;
    } finally {
      this.cachedTaxonomyPromise = null;
    }
  };

  ElfToon.prototype.fetchSeriesDetails = async function(seriesId) {
    var key = cleanText(seriesId).toLowerCase();
    if (key.length === 0) {
      throw new Error("ElfToon requires a series id.");
    }

    var cached = this.cachedSeriesDetails[key];
    if (cached && Date.now() < cached.expiresAt) {
      touchCacheKey(this.cachedSeriesDetailsOrder, key);
      return cached.value;
    }

    if (!this.cachedSeriesDetailsPromises[key]) {
      this.cachedSeriesDetailsPromises[key] = (async function() {
        var payload = null;
        var apiError = null;
        try {
          payload = await this.fetchJson(buildUrl(AI_API_BASE + "/series/" + encodePathSegment(getSeriesApiSlug(seriesId))));
        } catch (error) {
          apiError = error;
        }

        var normalized = normalizeSeriesDetailsPayload(payload);
        if (!normalized) {
          try {
            normalized = extractSeriesDetailsFromPage(
              await this.fetchText(this.getMangaShareUrl(seriesId)),
              getSeriesWebSlug(seriesId)
            );
          } catch (fallbackError) {
            if (apiError) {
              throw apiError;
            }
            throw fallbackError;
          }
        }

        if (!normalized || !isSeriesPayload(normalized)) {
          throw new Error("Unable to decode the ElfToon series payload for " + seriesId + ".");
        }
        this.cacheBrowseSeriesData([normalized]);
        storeBoundedCacheEntry(
          this.cachedSeriesDetails,
          this.cachedSeriesDetailsOrder,
          key,
          { value: normalized, expiresAt: Date.now() + SERIES_DETAILS_CACHE_MS },
          SERIES_DETAILS_CACHE_LIMIT
        );
        return normalized;
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

  ElfToon.prototype.fetchReaderPagesByInternalId = async function(internalChapterId) {
    var payload = await this.fetchJson(DOMAIN + "/api/chapters/page-urls?chapterId=" + encodeURIComponent(internalChapterId));
    if (hasRedactedReaderPages(payload && payload.pages)) {
      throw createLockedChapterError();
    }
    if (hasMissingReadablePageUrls(payload && payload.pages)) {
      throw new Error("ElfToon returned incomplete page URLs for chapter " + internalChapterId + ".");
    }
    return normalizeReaderPages(payload && payload.pages);
  };

  ElfToon.prototype.resolveReaderPages = async function(chapter) {
    if (!isObject(chapter)) {
      return [];
    }
    if (isReaderChapterRedacted(chapter)) {
      throw createLockedChapterError();
    }

    var rawPages = Array.isArray(chapter.pages) ? chapter.pages : [];
    if (hasMissingReadablePageUrls(rawPages)) {
      var internalChapterId = cleanText(chapter.id);
      if (internalChapterId.length > 0) {
        return this.fetchReaderPagesByInternalId(internalChapterId);
      }
      return [];
    }
    return normalizeReaderPages(rawPages);
  };

  ElfToon.prototype.fetchReaderChapterBySeriesInternalId = async function(seriesId, internalSeriesId, chapterNumber) {
    var params = {
      seriesId: internalSeriesId,
      limit: 1
    };
    var boundary = this.getCachedChapterLookupBoundary(seriesId, chapterNumber);
    if (boundary) {
      params[boundary.key] = boundary.value;
    } else {
      params.beforeNumber = chapterNumber + 0.000001;
    }

    var payload = await this.fetchJson(buildUrl(DOMAIN + "/api/chapters/next", params));
    var chapters = Array.isArray(payload && payload.chapters) ? payload.chapters : [];
    if (chapters.length === 0) {
      return null;
    }

    var chapter = chapters[0];
    if (!isObject(chapter) || Math.abs(toChapterNumber(chapter.number, NaN) - chapterNumber) > 0.0000001) {
      return null;
    }
    return chapter;
  };

  ElfToon.prototype.getCachedChapterLookupBoundary = function(seriesId, chapterNumber) {
    var key = cleanText(seriesId).toLowerCase();
    var cachedDetails = this.cachedSeriesDetails[key];
    if (!cachedDetails || !isObject(cachedDetails.value)) {
      return null;
    }

    var chapters = normalizeChapterEntries(cachedDetails.value.chapters).slice().sort(function(left, right) {
      return toChapterNumber(left && left.number, 0) - toChapterNumber(right && right.number, 0);
    });
    for (var index = 0; index < chapters.length; index += 1) {
      var currentNumber = toChapterNumber(chapters[index] && chapters[index].number, NaN);
      if (currentNumber !== chapterNumber) {
        continue;
      }
      if (index > 0) {
        return {
          key: "afterNumber",
          value: toChapterNumber(chapters[index - 1] && chapters[index - 1].number, chapterNumber - 1)
        };
      }
      if (index + 1 < chapters.length) {
        return {
          key: "beforeNumber",
          value: toChapterNumber(chapters[index + 1] && chapters[index + 1].number, chapterNumber + 1)
        };
      }
      return null;
    }
    return null;
  };

  ElfToon.prototype.getCachedReaderChapterId = function(seriesId, chapterNumber) {
    var key = cleanText(seriesId).toLowerCase();
    var cached = this.cachedReaderChapterMaps[key];
    if (!cached || Date.now() >= cached.expiresAt) {
      return "";
    }
    cached.expiresAt = Date.now() + READER_CHAPTER_MAP_CACHE_MS;
    touchCacheKey(this.cachedReaderChapterMapOrder, key);
    return cleanText(cached.value[String(chapterNumber)]);
  };

  ElfToon.prototype.cacheBrowseSeriesData = function(seriesList) {
    var source = this;
    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      source.cacheSeriesInternalId(buildSeriesId(series), series && series.id);
      source.cacheBrowseChapterIds(series);
    });
  };

  ElfToon.prototype.cacheBrowseChapterIds = function(series) {
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

  ElfToon.prototype.cacheSeriesInternalId = function(seriesId, internalSeriesId) {
    var key = cleanText(seriesId).toLowerCase();
    var value = cleanText(internalSeriesId);
    if (key.length === 0 || value.length === 0) {
      return;
    }
    this.cachedSeriesInternalIds[key] = value;
    touchCacheKey(this.cachedSeriesInternalIdOrder, key);
    while (this.cachedSeriesInternalIdOrder.length > SERIES_INTERNAL_ID_CACHE_LIMIT) {
      var oldest = this.cachedSeriesInternalIdOrder.shift();
      if (oldest !== void 0 && oldest !== key) {
        delete this.cachedSeriesInternalIds[oldest];
      }
    }
  };

  ElfToon.prototype.getCachedSeriesInternalId = function(seriesId) {
    var key = cleanText(seriesId).toLowerCase();
    var value = cleanText(this.cachedSeriesInternalIds[key]);
    if (value.length > 0) {
      touchCacheKey(this.cachedSeriesInternalIdOrder, key);
    }
    return value;
  };

  ElfToon.prototype.resolveSeriesInternalIdFromCachedDetails = async function(seriesId) {
    var cachedId = this.getCachedSeriesInternalId(seriesId);
    if (cachedId.length > 0) {
      return cachedId;
    }

    var key = cleanText(seriesId).toLowerCase();
    var cachedDetails = this.cachedSeriesDetails[key];
    if (!cachedDetails) {
      return "";
    }

    var title = cleanText(cachedDetails.value && cachedDetails.value.title);
    if (title.length < 2) {
      return "";
    }

    var page = await this.fetchBrowsePage(1, 10, { query: title });
    var targetApiSlug = getSeriesApiSlug(seriesId);
    for (var index = 0; index < page.items.length; index += 1) {
      var item = page.items[index];
      if (getSeriesApiSlug(buildSeriesId(item)) === targetApiSlug) {
        return this.getCachedSeriesInternalId(seriesId);
      }
    }
    return "";
  };

  ElfToon.prototype.cacheReaderChapterMap = function(seriesId, chapterMap) {
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

  ElfToon.prototype.evictCachedReaderChapterId = function(seriesId, chapterNumber) {
    var key = cleanText(seriesId).toLowerCase();
    var cached = this.cachedReaderChapterMaps[key];
    if (cached && isObject(cached.value)) {
      delete cached.value[String(chapterNumber)];
    }
  };

  ElfToon.prototype.fetchJson = async function(url) {
    var attempts = 0;
    while (attempts < 2) {
      attempts += 1;
      try {
        var response = await this.requestManager.schedule(App.createRequest({
          url: url,
          method: "GET",
          headers: {
            accept: "application/json"
          }
        }), 1);
        return parseJsonResponse(response, url);
      } catch (error) {
        if (attempts >= 2 || !isRetryableRequestError(error)) {
          throw error;
        }
        await delay(300);
      }
    }
    throw new Error("ElfToon failed to complete the request for " + formatRequestLabel(url) + ".");
  };

  ElfToon.prototype.fetchText = async function(url) {
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
      throw new Error("ElfToon returned unreadable JSON from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureSuccessfulResponse(response, raw, url);
    return raw;
  }

  function ensureSuccessfulResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("ElfToon returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (isChallengePage(body)) {
      var challengeError = new Error("ElfToon blocked the request with an anti-bot challenge.");
      challengeError.elfToonHttpStatus = response.status;
      challengeError.elfToonChallenge = true;
      throw challengeError;
    }
    if (response.status === 404) {
      var notFoundError = new Error("The requested ElfToon page was not found.");
      notFoundError.elfToonHttpStatus = response.status;
      throw notFoundError;
    }
    if (response.status >= 400) {
      var httpError = new Error("ElfToon returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
      httpError.elfToonHttpStatus = response.status;
      throw httpError;
    }
  }

  function isRetryableRequestError(error) {
    if (error && error.elfToonChallenge === true) {
      return false;
    }
    var status = toNumber(error && error.elfToonHttpStatus, 0);
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
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

  function normalizeSeriesDetailsPayload(series) {
    if (!isSeriesPayload(series)) {
      return null;
    }

    return Object.assign({}, series, {
      id: cleanText(series.id),
      slug: cleanText(series.slug),
      urlSlug: cleanText(series.urlSlug) || cleanText(series.slug),
      title: cleanText(series.title),
      original_title: cleanText(series.original_title || series.originalTitle || series.altTitle),
      alternative_titles: normalizeAlternativeTitles(series),
      cover_image: normalizeUrl(series.cover_image || series.coverImage),
      banner_image: normalizeUrl(series.banner_image || series.bannerImage),
      description: cleanText(series.description),
      author: normalizeContributor(series.author),
      artist: normalizeContributor(series.artist),
      origin: cleanText(series.origin),
      status: cleanText(series.status),
      type: cleanText(series.type),
      rating: toNumber(series.rating, 0),
      genres: normalizeDetailNames(series.genres),
      tags: normalizeDetailNames(series.tags),
      chapters: normalizeDetailChapters(series.chapters)
    });
  }

  function normalizeAlternativeTitles(series) {
    var titles = [];
    var values = [];
    values = values.concat(Array.isArray(series && series.alternative_titles) ? series.alternative_titles : []);
    values = values.concat(Array.isArray(series && series.aliases) ? series.aliases : []);
    values.push(series && series.altTitle);
    values.forEach(function(value) {
      var title = cleanText(value);
      if (title.length > 0 && titles.indexOf(title) === -1) {
        titles.push(title);
      }
    });
    return titles;
  }

  function normalizeContributor(value) {
    if (isObject(value)) {
      return cleanText(value.name || value.displayName || value.username);
    }
    return cleanText(value);
  }

  function normalizeDetailNames(values) {
    var names = [];
    (Array.isArray(values) ? values : []).forEach(function(entry) {
      var name = "";
      if (typeof entry === "string") {
        name = cleanText(entry);
      } else if (isObject(entry)) {
        name = cleanText(
          entry.name ||
          entry.label ||
          entry.slug ||
          entry.genre && (entry.genre.name || entry.genre.slug) ||
          entry.tag && (entry.tag.name || entry.tag.slug)
        );
      }
      if (name.length > 0 && names.indexOf(name) === -1) {
        names.push(name);
      }
    });
    return names;
  }

  function normalizeDetailChapters(chapters) {
    return (Array.isArray(chapters) ? chapters : []).map(function(chapter) {
      if (!isObject(chapter)) {
        return null;
      }
      var hasAccess = chapter.hasAccess;
      return Object.assign({}, chapter, {
        id: cleanText(chapter.id),
        number: toChapterNumber(chapter.number, NaN),
        title: emptyToUndefined(chapter.title),
        is_premium: chapter.is_premium === true || (chapter.isLocked === true && hasAccess !== true),
        published_at: cleanText(chapter.published_at || chapter.publishedAt || chapter.createdAt)
      });
    }).filter(function(chapter) {
      return chapter && isFinite(chapter.number);
    });
  }

  function extractSeriesDetailsFromPage(html, expectedSlug) {
    var chunks = decodeNextFlightChunks(html);
    var expected = cleanText(expectedSlug);
    var series = null;
    var matchedChunk = "";

    for (var chunkIndex = 0; chunkIndex < chunks.length && !series; chunkIndex += 1) {
      var candidates = extractJsonObjectValues(chunks[chunkIndex], "series");
      for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        var candidate = candidates[candidateIndex];
        if (isSeriesPayload(candidate) && cleanText(candidate.slug) === expected) {
          series = candidate;
          matchedChunk = chunks[chunkIndex];
          break;
        }
      }
    }
    if (!series) {
      return null;
    }

    var chapterLists = extractJsonArrayValues(matchedChunk, "chapters");
    if (chapterLists.length === 0) {
      for (var index = 0; index < chunks.length; index += 1) {
        chapterLists = chapterLists.concat(extractJsonArrayValues(chunks[index], "chapters"));
      }
    }

    var bestChapters = [];
    chapterLists.forEach(function(chapters) {
      if (Array.isArray(chapters) && chapters.length > bestChapters.length && chapters.every(function(chapter) {
        return isObject(chapter) && isFinite(toChapterNumber(chapter.number, NaN));
      })) {
        bestChapters = chapters;
      }
    });

    if (bestChapters.length === 0 && matchedChunk.length > 0) {
      for (var fallbackIndex = 0; fallbackIndex < chunks.length; fallbackIndex += 1) {
        var fallbackLists = extractJsonArrayValues(chunks[fallbackIndex], "chapters");
        fallbackLists.forEach(function(chapters) {
          if (Array.isArray(chapters) && chapters.length > bestChapters.length && chapters.every(function(chapter) {
            return isObject(chapter) && isFinite(toChapterNumber(chapter.number, NaN));
          })) {
            bestChapters = chapters;
          }
        });
        if (bestChapters.length > 0) {
          break;
        }
      }
    }

    return normalizeSeriesDetailsPayload(Object.assign({}, series, {
      chapters: bestChapters
    }));
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
    var chapterCount = toPositiveInteger(series && (series.chapter_count || series.chapterCount), 0);
    if (chapterCount > 0) {
      return chapterCount + (chapterCount === 1 ? " chapter" : " chapters");
    }

    var latestChapter = findLatestPreviewChapter(series && series.chapters);
    if (latestChapter) {
      var chapterNumber = toChapterNumber(latestChapter.number, 0);
      var label = "Chapter " + chapterNumber;
      var publishedDate = formatPublishedDate(latestChapter.publishedAt || latestChapter.createdAt);
      if (publishedDate.length > 0) {
        label += " • " + publishedDate;
      }
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
    sections.push(createOptionTagSection("type", "Type", SEARCH_TAG_PREFIX_TYPE, TYPE_OPTIONS));
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
      types: [],
      typesEx: [],
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
      } else if (id.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0) {
        value = getOptionApiValue(TYPE_OPTIONS, id.slice(SEARCH_TAG_PREFIX_TYPE.length));
        if (value) pushUnique(filters.types, value);
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
      } else if (id.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0) {
        value = getOptionApiValue(TYPE_OPTIONS, id.slice(SEARCH_TAG_PREFIX_TYPE.length));
        if (value) pushUnique(filters.typesEx, value);
      } else if (id.indexOf(SEARCH_TAG_PREFIX_ORIGIN) === 0) {
        value = getOptionApiValue(ORIGIN_OPTIONS, id.slice(SEARCH_TAG_PREFIX_ORIGIN.length));
        if (value) pushUnique(filters.originsEx, value);
      }
    });

    var hadIncludedStatuses = filters.statuses.length > 0;
    var hadIncludedTypes = filters.types.length > 0;
    var hadIncludedOrigins = filters.origins.length > 0;
    filters.statuses = resolveIncludedOptions(filters.statuses, filters.statusesEx, STATUS_OPTIONS);
    filters.types = resolveIncludedOptions(filters.types, filters.typesEx, TYPE_OPTIONS);
    filters.origins = resolveIncludedOptions(filters.origins, filters.originsEx, ORIGIN_OPTIONS);
    if (filters.statusesEx.length >= STATUS_OPTIONS.length ||
        filters.typesEx.length >= TYPE_OPTIONS.length ||
        filters.originsEx.length >= ORIGIN_OPTIONS.length ||
        (hadIncludedStatuses && filters.statuses.length === 0) ||
        (hadIncludedTypes && filters.types.length === 0) ||
        (hadIncludedOrigins && filters.origins.length === 0)) {
      filters.impossible = true;
    }

    return filters;
  }

  function hasActiveSearchFilters(filters) {
    return filters.genresIn.length > 0 ||
      filters.genresEx.length > 0 ||
      filters.tagsIn.length > 0 ||
      filters.tagsEx.length > 0 ||
      filters.statuses.length > 0 ||
      filters.statusesEx.length > 0 ||
      filters.types.length > 0 ||
      filters.typesEx.length > 0 ||
      filters.origins.length > 0 ||
      filters.originsEx.length > 0 ||
      cleanText(filters.sortBy).length > 0 ||
      filters.minChapters > 0 ||
      filters.maxChapters > 0;
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
    var metadataTags = [];
    addOptionDetailTag(metadataTags, series && series.status, STATUS_OPTIONS, SEARCH_TAG_PREFIX_STATUS);
    addOptionDetailTag(metadataTags, series && series.type, TYPE_OPTIONS, SEARCH_TAG_PREFIX_TYPE);
    addOptionDetailTag(metadataTags, series && series.origin, ORIGIN_OPTIONS, SEARCH_TAG_PREFIX_ORIGIN);

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
    if (metadataTags.length > 0) {
      sections.push(App.createTagSection({
        id: "metadata",
        label: "Metadata",
        tags: metadataTags
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

  function addOptionDetailTag(tags, rawValue, options, prefix) {
    var value = cleanText(rawValue).toUpperCase();
    if (value.length === 0) {
      return;
    }
    for (var index = 0; index < options.length; index += 1) {
      var option = options[index];
      if (value === cleanText(option.id).toUpperCase() || value === cleanText(option.apiValue).toUpperCase()) {
        tags.push(App.createTag({
          id: prefix + option.id,
          label: option.label
        }));
        return;
      }
    }
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

  function normalizeRating(value) {
    var rating = toNumber(value, 0);
    if (rating <= 0) {
      return 0;
    }
    return Math.min(5, rating / 2);
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

  function buildLegacyChapterId(seriesId, chapterNumber) {
    return getSeriesWebSlug(seriesId) + "-chapter-" + formatChapterNumberForSlug(chapterNumber);
  }

  function getChapterNumberFromId(seriesId, chapterId) {
    var value = cleanText(chapterId);
    if (isLockedChapterId(value)) {
      value = value.slice(LOCKED_CHAPTER_ID_PREFIX.length).split("::")[0];
    }

    var direct = toChapterNumber(value, NaN);
    if (isFinite(direct)) {
      return direct;
    }

    var prefix = getSeriesWebSlug(seriesId) + "-chapter-";
    if (value.indexOf(prefix) !== 0) {
      return NaN;
    }

    var suffix = value.slice(prefix.length);
    if (!/^\d+(?:-\d+)*$/.test(suffix)) {
      return NaN;
    }
    return toChapterNumber(suffix.replace(/-/g, "."), NaN);
  }

  function formatChapterNumberForSlug(value) {
    return formatChapterNumber(value).replace(/\./g, "-");
  }

  function formatChapterNumber(value) {
    var number = toChapterNumber(value, NaN);
    if (!isFinite(number)) {
      return "";
    }
    return String(number).replace(/\.0+$/, "");
  }

  function isLockedChapterId(chapterId) {
    return cleanText(chapterId).indexOf(LOCKED_CHAPTER_ID_PREFIX) === 0;
  }

  function buildChapterListName(chapter, fallbackNumber) {
    var name = buildReadableChapterLabel(chapter, fallbackNumber);
    return chapter && chapter.is_premium === true ? LOCKED_CHAPTER_LABEL_PREFIX + name : name;
  }

  function buildReadableChapterLabel(chapter, fallbackNumber) {
    var number = toChapterNumber(chapter && chapter.number, fallbackNumber);
    var title = cleanText(chapter && chapter.title);
    var defaultTitle = "chapter " + String(number).toLowerCase();
    if (title.length > 0 && title !== String(number) && title.toLowerCase() !== defaultTitle) {
      return "Chapter " + number + ": " + title;
    }
    return "Chapter " + number;
  }

  function extractReaderPayload(html, chapterNumber) {
    var chunks = decodeNextFlightChunks(html);
    var chapter = extractReaderChapterFromChunks(chunks, chapterNumber);
    return {
      chapter: chapter,
      chapterIds: extractReaderChapterIdsFromChunks(chunks, chapter)
    };
  }

  function extractReaderChapterFromChunks(chunks, chapterNumber) {
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

  function extractReaderChapterIdsFromChunks(chunks, currentChapter) {
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

  function hasMissingReadablePageUrls(pages) {
    var list = Array.isArray(pages) ? pages : [];
    return list.some(function(page) {
      return isObject(page) &&
        page.isRedacted !== true &&
        cleanText(page.imageUrl).length === 0;
    });
  }

  function isReaderChapterRedacted(chapter) {
    return isObject(chapter) && hasRedactedReaderPages(chapter.pages);
  }

  function isChapterNotFoundPage(html) {
    return /<title[^>]*>\s*chapter\s+not\s+found\b/i.test(String(html || ""));
  }

  function createLockedChapterError() {
    var error = new Error("This chapter is locked on ElfToon and cannot be loaded in Paperback.");
    error.elfToonLockedChapter = true;
    return error;
  }

  function isLockedChapterError(error) {
    return isObject(error) && error.elfToonLockedChapter === true;
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

  function delay(milliseconds) {
    return new Promise(function(resolve) {
      setTimeout(resolve, Math.max(0, toNumber(milliseconds, 0)));
    });
  }

  function parseDate(value) {
    var parsed = new Date(String(value || ""));
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function formatPublishedDate(value) {
    var parsed = parseDate(value);
    if (parsed.getTime() === 0) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
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
    ElfToonInfo: ElfToonInfo,
    ElfToon: ElfToon
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
