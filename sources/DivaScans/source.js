"use strict";

(function() {
  // Constants

  var DOMAIN = "https://divatoon.com";
  var API_BASE = "https://api.divatoon.com/api";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var BADGE_COLOR_WARNING = "warning";
  var CONTENT_RATING_MATURE = "MATURE";
  var BROWSE_PER_PAGE = 300;
  var SEARCH_PER_PAGE = 24;
  var HOME_FEATURED_PER_PAGE = 12;
  var HOME_POPULAR_PER_PAGE = 12;
  var HOME_MOST_POPULAR_PER_PAGE = 12;
  var HOME_LATEST_PER_PAGE = 24;
  var HOME_LATEST_UPDATES_PER_PAGE = 24;
  var CHAPTERS_PER_REQUEST = 500;
  var ARCHIVE_DEFAULT_SERIES_TYPES = "MANGA,MANHWA,MANHUA";
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_releases";
  var SECTION_ID_MOST_POPULAR = "most_popular";
  var SECTION_ID_LATEST_UPDATES = "latest_updates";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";
  var ARCHIVE_SORT_OPTIONS = [
    { id: "latest_chapters", label: "Latest Chapters", orderBy: "lastChapterAddedAt", defaultDirection: "desc" },
    { id: "popular", label: "Most Popular", orderBy: "totalViews", defaultDirection: "desc" },
    { id: "newest", label: "Newest Added", orderBy: "createdAt", defaultDirection: "desc" },
    { id: "oldest", label: "Oldest First", orderBy: "createdAt", defaultDirection: "asc" },
    { id: "most_chapters", label: "Most Chapters", orderBy: "chaptersCount", defaultDirection: "desc" },
    { id: "alphabetical", label: "A-Z", orderBy: "postTitle", defaultDirection: "asc" }
  ];
  var ARCHIVE_ORDER_OPTIONS = [
    { id: "desc", label: "Descending" },
    { id: "asc", label: "Ascending" }
  ];
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var CHAPTER_ACCESS_READABLE = "readable";
  var CHAPTER_ACCESS_LOCKED = "locked";
  var CHAPTER_ACCESS_UNKNOWN = "unknown";
  var GENRE_LABEL_OVERRIDES = {
    "adult1": "Adult",
    "bagelboy": "Bagel Boy",
    "bdsm": "BDSM",
    "bdsm sub dom": "BDSM / Sub-Dom",
    "bl": "BL",
    "sm bdsm sub dom": "BDSM / Sub-Dom",
    "cheating infidelity": "Cheating / Infidelity",
    "coming of age": "Coming of Age",
    "devotedman": "Devoted Man",
    "dirtytalk": "Dirty Talk",
    "firstlove": "First Love",
    "highintensity": "High Intensity",
    "innocentfemalelead": "Innocent Female Lead",
    "joesi": "Josei",
    "ntr": "NTR",
    "oneshot": "One Shot",
    "purelove": "Pure Love",
    "romace": "Romance",
    "romcom": "Rom-Com",
    "schemingmalelead": "Scheming Male Lead",
    "seinen m": "Seinen (M)",
    "slice of life": "Slice of Life",
    "s m": "S&M",
    "sm": "SM",
    "wolfs": "Wolves"
  };

  // Source Info

  var DivaScansInfo = {
    version: "1.0.0",
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
            accept: "application/json, text/plain, */*",
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
    this.cachedBrowseSeries = null;
    this.cachedFilterData = null;
    this.cachedSeriesDetails = {};
    this.cachedSeriesChapters = {};
  }

  // Paperback Interface Methods

  DivaScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  DivaScans.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  DivaScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodePathSegment(seriesId);
  };

  DivaScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/" + encodePathSegment(chapterId);
  };

  DivaScans.prototype.getHomePageSections = async function(sectionCallback) {
    var results = await Promise.all([
      this.fetchText(DOMAIN),
      this.getLatestSectionItems(1)
    ]);
    var homeHtml = results[0];
    var latestResults = results[1];
    var homeData = extractHomePageData(homeHtml);
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        homeData.featured.slice(0, HOME_FEATURED_PER_PAGE),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Popular Today",
        "singleRowLarge",
        homeData.popularToday.slice(0, HOME_POPULAR_PER_PAGE),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest Releases",
        "singleRowNormal",
        latestResults.results,
        latestResults.metadata !== void 0
      ),
      createHomeSection(
        SECTION_ID_MOST_POPULAR,
        "Most Popular",
        "singleRowNormal",
        homeData.mostPopular.slice(0, HOME_MOST_POPULAR_PER_PAGE),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST_UPDATES,
        "Latest Updates",
        "singleRowNormal",
        homeData.latestUpdates.slice(0, HOME_LATEST_UPDATES_PER_PAGE),
        false
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  DivaScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(toPositiveInteger(metadata && metadata.page, 1));
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
    return false;
  };

  DivaScans.prototype.getSearchTags = async function() {
    if (!this.cachedFilterData) {
      this.cachedFilterData = await this.fetchFilterData();
    }

    return buildSearchTagSections(this.cachedFilterData);
  };

  DivaScans.prototype.getSearchFields = async function() {
    return [createMinimumChaptersSearchField()];
  };

  DivaScans.prototype.getMangaDetails = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(series.postTitle, series.alternativeTitles),
        image: resolveSeriesImage(series),
        desc: cleanText(series.postContent || ""),
        author: emptyToUndefined(series.author),
        artist: emptyToUndefined(series.artist),
        status: mapStatus(series.seriesStatus),
        rating: toNumber(series.averageRating, 0),
        tags: buildDetailTagSections(series),
        hentai: false
      })
    });
  };

  DivaScans.prototype.getChapters = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = await this.fetchSeriesChapters(series);

    chapters = chapters.filter(isDisplayChapter).sort(compareChapterEntriesDesc);

    var visibleChapters = chapters.filter(function(chapter) {
      return shouldIncludeChapterForList(chapter, showLockedChapters);
    }).map(function(chapter, index) {
      var chapterNumber = toChapterNumber(chapter.number, chapters.length - index);
      return App.createChapter({
        id: String(chapter.slug || ""),
        name: buildChapterListName(chapter, chapterNumber),
        chapNum: chapterNumber,
        time: parseDate(chapter.updatedAt || chapter.createdAt),
        langCode: "en"
      });
    });

    if (visibleChapters.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return visibleChapters;
  };

  DivaScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var payload = await this.fetchJson(buildApiUrl("/chapter/content", {
      mangaslug: seriesId,
      chapterslug: chapterId
    }));

    if (!isObject(payload) || payload.isAccessible !== true) {
      throw new Error("This chapter is locked on DivaScans and cannot be loaded in Paperback.");
    }

    var images = Array.isArray(payload.images) ? payload.images.slice() : [];
    images.sort(function(left, right) {
      return toNumber(left && left.order, 0) - toNumber(right && right.order, 0);
    });

    var pages = images.map(function(image) {
      return normalizeUrl(image && image.url || "");
    }).filter(function(url) {
      return url.length > 0;
    });

    if (pages.length === 0) {
      throw new Error("DivaScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  DivaScans.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var filters = extractSearchFilters(query);

    if (hasActiveSearchFilters(filters)) {
      return this.getArchiveSearchResults(title, filters, page);
    }

    if (title.length > 0) {
      return this.getTitleSearchResults(title, page);
    }

    return createPagedSeriesResults(await this.fetchAllBrowseSeries(), page, SEARCH_PER_PAGE);
  };

  // Source-Specific Fetch Helpers

  DivaScans.prototype.getLatestSectionItems = async function(page) {
    var latestPage = await this.fetchPostsPage(page, HOME_LATEST_PER_PAGE, {
      tag: ""
    });

    return App.createPagedResults({
      results: mapHomeItems(latestPage.series),
      metadata: getNextPageMetadataFromCount(latestPage.totalCount, latestPage.page, latestPage.perPage, latestPage.pageCount)
    });
  };

  DivaScans.prototype.fetchFilterData = async function() {
    var allSeries = await this.fetchAllBrowseSeries();
    return {
      genres: extractGenreOptions(allSeries),
      statuses: extractNamedFilterOptions(allSeries, "seriesStatus")
    };
  };

  DivaScans.prototype.fetchAllBrowseSeries = async function() {
    if (Array.isArray(this.cachedBrowseSeries)) {
      return this.cachedBrowseSeries;
    }

    var firstPage = await this.fetchPostsPage(1, BROWSE_PER_PAGE, {});
    var pages = [firstPage.series];
    var totalCount = toPositiveInteger(firstPage.totalCount, 0);

    if (totalCount > 0) {
      var totalPages = Math.max(1, Math.ceil(totalCount / BROWSE_PER_PAGE));
      var pendingPages = [];
      for (var page = 2; page <= totalPages; page += 1) {
        pendingPages.push(this.fetchPostsPage(page, BROWSE_PER_PAGE, {}));
      }

      (await Promise.all(pendingPages)).forEach(function(resultsPage) {
        pages.push(resultsPage.series);
      });
    } else if (firstPage.pageCount >= BROWSE_PER_PAGE) {
      var nextPage = 2;
      var nextResultsPage;

      do {
        nextResultsPage = await this.fetchPostsPage(nextPage, BROWSE_PER_PAGE, {});
        pages.push(nextResultsPage.series);
        nextPage += 1;
      } while (nextResultsPage.pageCount >= BROWSE_PER_PAGE);
    }

    this.cachedBrowseSeries = normalizeSeriesPayloads([].concat.apply([], pages));
    return this.cachedBrowseSeries;
  };

  DivaScans.prototype.fetchPostsPage = async function(page, perPage, options) {
    var resolvedPage = toPositiveInteger(page, 1);
    var resolvedPerPage = toPositiveInteger(perPage, SEARCH_PER_PAGE);
    var response = await this.fetchJson(buildApiUrl("/posts", {
      page: resolvedPage,
      perPage: resolvedPerPage,
      searchTerm: cleanText(options && options.searchTerm || ""),
      isNovel: false,
      tag: cleanText(options && options.tag || "")
    }));

    return {
      page: resolvedPage,
      perPage: resolvedPerPage,
      series: normalizeSeriesPayloads(response && response.posts),
      totalCount: toPositiveInteger(response && response.totalCount, 0),
      pageCount: Array.isArray(response && response.posts) ? response.posts.length : 0
    };
  };

  DivaScans.prototype.getTitleSearchResults = async function(title, page) {
    var resultsPage = await this.fetchPostsPage(page, SEARCH_PER_PAGE, {
      searchTerm: title
    });

    return App.createPagedResults({
      results: mapHomeItems(resultsPage.series),
      metadata: getNextPageMetadataFromCount(resultsPage.totalCount, resultsPage.page, resultsPage.perPage, resultsPage.pageCount)
    });
  };

  DivaScans.prototype.getArchiveSearchResults = async function(title, filters, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var archiveFilters = filters;

    if (Array.isArray(filters && filters.genres) && filters.genres.length > 0) {
      archiveFilters = Object.assign({}, filters, {
        archiveGenreIds: buildArchiveGenreIds(filters.genres, await this.fetchAllBrowseSeries())
      });
    }

    var response = await this.fetchJson(buildApiUrl("/query", buildArchiveQueryParams(title, archiveFilters, resolvedPage, SEARCH_PER_PAGE)));
    var pagePosts = Array.isArray(response && response.posts) ? response.posts : [];
    var series = normalizeSeriesPayloads(pagePosts);

    return App.createPagedResults({
      results: series.map(function(item) {
        return createPartialSeries(item, buildHomeSubtitle(item));
      }),
      metadata: getNextPageMetadataFromCount(response && response.totalCount, resolvedPage, SEARCH_PER_PAGE, pagePosts.length)
    });
  };

  DivaScans.prototype.fetchSeriesDetails = async function(seriesId) {
    if (isObject(this.cachedSeriesDetails[seriesId])) {
      return this.cachedSeriesDetails[seriesId];
    }

    var response = await this.fetchJson(buildApiUrl("/post", {
      postSlug: cleanText(seriesId)
    }));
    var series = isObject(response && response.post) ? response.post : null;

    if (!isSeriesPayload(series)) {
      throw new Error("Unable to decode the DivaScans series payload for " + seriesId + ".");
    }

    this.cachedSeriesDetails[seriesId] = series;
    return this.cachedSeriesDetails[seriesId];
  };

  DivaScans.prototype.fetchSeriesChapters = async function(series) {
    var seriesId = cleanText(series && series.slug);
    var seriesApiId = toPositiveInteger(series && series.id, 0);

    if (seriesId.length === 0 || seriesApiId <= 0) {
      throw new Error("DivaScans did not expose a valid series record for the chapter list.");
    }

    if (Array.isArray(this.cachedSeriesChapters[seriesId])) {
      return this.cachedSeriesChapters[seriesId];
    }

    var chapters = [];
    var skip = 0;
    var pageChapters = [];

    do {
      pageChapters = normalizeChapterEntries(await this.fetchJson(buildApiUrl("/post/chapters", {
        postId: seriesApiId,
        skip: skip,
        take: CHAPTERS_PER_REQUEST,
        order: "desc"
      })));
      chapters = chapters.concat(pageChapters);
      skip += pageChapters.length;
    } while (pageChapters.length === CHAPTERS_PER_REQUEST);

    this.cachedSeriesChapters[seriesId] = chapters;
    return chapters;
  };

  DivaScans.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  };

  DivaScans.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
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
      throw new Error("DivaScans returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
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
    return lower.includes("just a moment") && lower.includes("cloudflare");
  }

  function buildApiUrl(path, params) {
    var entries = [];
    Object.keys(params || {}).forEach(function(key) {
      var value = params[key];
      if (value === void 0 || value === null || value === "") {
        return;
      }
      entries.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });

    return API_BASE + path + (entries.length > 0 ? "?" + entries.join("&") : "");
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

  // Series / Card Helpers

  function createPartialSeries(series, subtitle) {
    return App.createPartialSourceManga({
      mangaId: String(series.slug || ""),
      title: cleanText(series.postTitle || ""),
      image: resolveSeriesImage(series),
      subtitle: emptyToUndefined(subtitle)
    });
  }

  function normalizeSeriesPayloads(seriesList) {
    var deduped = {};
    var ordered = [];

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      if (!isSeriesPayload(series) || series.isNovel === true || cleanText(series.seriesType).toUpperCase() === "NOVEL") {
        return;
      }

      var slug = cleanText(series.slug);
      if (slug.length === 0 || deduped[slug]) {
        return;
      }

      deduped[slug] = true;
      ordered.push(series);
    });

    return ordered;
  }

  function isSeriesPayload(series) {
    return isObject(series) &&
      typeof series.slug === "string" &&
      typeof series.postTitle === "string";
  }

  function createPagedSeriesResults(seriesList, page, perPage) {
    var normalizedSeries = normalizeSeriesPayloads(seriesList);
    var start = Math.max(0, (page - 1) * perPage);
    var end = start + perPage;
    var pageItems = normalizedSeries.slice(start, end).map(function(series) {
      return createPartialSeries(series, buildHomeSubtitle(series));
    });

    return App.createPagedResults({
      results: pageItems,
      metadata: end < normalizedSeries.length ? { page: page + 1 } : void 0
    });
  }

  function getNextPageMetadataFromCount(totalCount, currentPage, perPage, currentCount) {
    var resolvedTotalCount = toPositiveInteger(totalCount, 0);
    if (resolvedTotalCount > currentPage * perPage) {
      return {
        page: currentPage + 1
      };
    }

    if (resolvedTotalCount === 0 && toPositiveInteger(currentCount, 0) >= perPage) {
      return {
        page: currentPage + 1
      };
    }

    return void 0;
  }

  // Homepage Helpers

  function createHomeSection(id, title, type, items, containsMoreItems) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: type,
      items: items,
      containsMoreItems: containsMoreItems
    });
  }

  function mapHomeItems(seriesList) {
    return normalizeSeriesPayloads(seriesList).map(function(series) {
      return createPartialSeries(series, buildHomeSubtitle(series));
    });
  }

  function buildHomeSubtitle(series) {
    var latestChapter = findFirstChapterPreview(series && series.chapters);
    if (latestChapter) {
      return buildChapterListName(latestChapter, toChapterNumber(latestChapter.number, 0));
    }

    var statusLabel = formatOptionLabel(series && series.seriesStatus);
    return statusLabel.length > 0 ? statusLabel : void 0;
  }

  function extractHomePageData(html) {
    var flightChunks = decodeNextFlightChunks(html);
    return {
      featured: extractFeaturedItemsFromFlight(flightChunks),
      popularToday: extractPopularTodayItemsFromFlight(flightChunks),
      mostPopular: extractMostPopularItemsFromFlight(flightChunks),
      latestUpdates: extractLatestUpdateItemsFromFlight(flightChunks)
    };
  }

  function extractFeaturedItemsFromFlight(flightChunks) {
    return mapFlightHomeItems(extractFlightArrayValue(flightChunks, "sliderPosts"), function(series) {
      return createHomeCard(
        cleanText(series && series.slug),
        cleanText(series && (series.postTitle || series.title)),
        resolveSeriesImage(series),
        buildGenreSubtitle(series && series.genres, 3)
      );
    });
  }

  function extractPopularTodayItemsFromFlight(flightChunks) {
    return mapFlightHomeItems(extractFlightArrayValue(flightChunks, "popularPosts"), function(series) {
      return createHomeCard(
        cleanText(series && series.slug),
        cleanText(series && (series.postTitle || series.title)),
        resolveSeriesImage(series),
        buildPopularTodaySubtitle(series)
      );
    });
  }

  function extractMostPopularItemsFromFlight(flightChunks) {
    return mapFlightHomeItems(extractFlightArrayValue(flightChunks, "series"), function(series) {
      return createHomeCard(
        cleanText(series && series.slug),
        cleanText(series && (series.title || series.postTitle)),
        resolveSeriesImage(series),
        buildGenreSubtitle(series && series.tags, 3)
      );
    });
  }

  function mapFlightHomeItems(items, mapper) {
    var deduped = {};
    var mappedItems = [];

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var mappedItem = typeof mapper === "function" ? mapper(item) : null;
      var seriesId = cleanText(mappedItem && mappedItem.mangaId);
      if (seriesId.length === 0 || deduped[seriesId]) {
        return;
      }

      deduped[seriesId] = true;
      mappedItems.push(mappedItem);
    });

    return mappedItems;
  }

  function extractLatestUpdateItemsFromFlight(flightChunks) {
    return mapFlightHomeItems(extractFlightArrayValue(flightChunks, "items"), function(item) {
      return createHomeCard(
        cleanText(item && item.seriesSlug),
        cleanText(item && item.seriesTitle),
        normalizeUrl(item && item.seriesImage),
        buildLatestUpdateChapterLabel(item)
      );
    });
  }

  function buildPopularTodaySubtitle(series) {
    var parts = [];
    var rating = formatRatingLabel(series && series.averageRating);

    if (rating.length > 0) {
      parts.push(rating);
    }

    return parts.concat(extractDisplayLabels(series && series.genres, 4)).join(" \u00b7 ");
  }

  function buildGenreSubtitle(values, limit) {
    return extractDisplayLabels(values, limit).join(" \u00b7 ");
  }

  function extractDisplayLabels(values, limit) {
    var labels = [];
    var seen = {};
    var max = toPositiveInteger(limit, 0);

    (Array.isArray(values) ? values : []).forEach(function(value) {
      var label = normalizeGenreLabel(isObject(value) ? value.name || value.label || "" : value);
      var key = toOptionId(label);

      if (label.length === 0 || key.length === 0 || seen[key] || (max > 0 && labels.length >= max)) {
        return;
      }

      seen[key] = true;
      labels.push(label);
    });

    return labels;
  }

  function formatRatingLabel(value) {
    var rating = toNumber(value, NaN);
    if (!isFinite(rating) || rating <= 0) {
      return "";
    }

    return "\u2605 " + String(Math.round(rating * 100) / 100);
  }

  function buildLatestUpdateChapterLabel(item) {
    var chapter = {
      number: item && item.chapterNumber,
      title: item && item.chapterTitle
    };
    var chapterNumber = toChapterNumber(item && item.chapterNumber, 0);

    return item && item.isPaid === true ?
      buildLockedChapterLabel(chapter, chapterNumber) :
      buildReadableChapterLabel(chapter, chapterNumber);
  }

  function createHomeCard(seriesId, title, image, subtitle) {
    if (seriesId.length === 0 || title.length === 0 || image.length === 0) {
      return null;
    }

    return App.createPartialSourceManga({
      mangaId: seriesId,
      title: title,
      image: image,
      subtitle: emptyToUndefined(subtitle)
    });
  }

  function decodeNextFlightChunks(html) {
    var chunks = [];
    var match;
    var flightRegex = /self\.__next_f\.push\(\[1,("(?:(?:\\.|[^"\\])*)")\]\)<\/script>/g;

    while ((match = flightRegex.exec(String(html || ""))) !== null) {
      try {
        chunks.push(JSON.parse(match[1]));
      } catch (error) {
      }
    }

    return chunks;
  }

  function extractFlightArrayValue(flightChunks, key) {
    var value = extractFlightValue(flightChunks, key);
    return Array.isArray(value) ? value : [];
  }

  function extractFlightValue(flightChunks, key) {
    var marker = '"' + String(key || "") + '":';

    for (var chunkIndex = 0; chunkIndex < flightChunks.length; chunkIndex += 1) {
      var chunk = String(flightChunks[chunkIndex] || "");
      var markerIndex = chunk.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }

      var parsedValue = extractJsonValueAtIndex(chunk, markerIndex + marker.length);
      if (parsedValue !== null) {
        return parsedValue;
      }
    }

    return null;
  }

  function extractJsonValueAtIndex(source, valueIndex) {
    var index = toPositiveInteger(valueIndex, 0) - 1;
    var openToken = "";
    var closeToken = "";
    var depth = 0;
    var inString = false;
    var isEscaped = false;

    while (index + 1 < source.length && /\s/.test(source.charAt(index + 1))) {
      index += 1;
    }

    openToken = source.charAt(index + 1);
    closeToken = openToken === "[" ? "]" : openToken === "{" ? "}" : "";
    if (closeToken.length === 0) {
      return null;
    }

    for (var charIndex = index + 1; charIndex < source.length; charIndex += 1) {
      var character = source.charAt(charIndex);

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (character === "\\") {
          isEscaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === openToken) {
        depth += 1;
        continue;
      }

      if (character === closeToken) {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(index + 1, charIndex + 1));
          } catch (error) {
            return null;
          }
        }
      }
    }

    return null;
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var statuses = normalizeFilterOptions(filterData && filterData.statuses);

    if (genres.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genres.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_GENRE + option.id,
            label: option.label
          });
        })
      }));
    }

    if (statuses.length > 0) {
      sections.push(App.createTagSection({
        id: "status",
        label: "Status",
        tags: statuses.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_STATUS + option.id,
            label: option.label
          });
        })
      }));
    }

    sections.push(App.createTagSection({
      id: "sort",
      label: "Sort",
      tags: ARCHIVE_SORT_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_SORT + option.id,
          label: option.label
        });
      })
    }));

    sections.push(App.createTagSection({
      id: "order",
      label: "Order",
      tags: ARCHIVE_ORDER_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_ORDER + option.id,
          label: option.label
        });
      })
    }));

    return sections;
  }

  function extractSearchFilters(query) {
    var filters = {
      genres: [],
      status: void 0,
      minChapters: extractMinimumChaptersFilterValue(query),
      sortBy: void 0,
      sortDirection: void 0
    };
    var seenGenres = {};
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];

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

      if (tagId.indexOf(SEARCH_TAG_PREFIX_SORT) === 0 && filters.sortBy === void 0) {
        var sortBy = tagId.slice(SEARCH_TAG_PREFIX_SORT.length);
        if (getArchiveSortOption(sortBy)) {
          filters.sortBy = sortBy;
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_ORDER) === 0 && filters.sortDirection === void 0) {
        var sortDirection = tagId.slice(SEARCH_TAG_PREFIX_ORDER.length);
        if (isArchiveOrderDirection(sortDirection)) {
          filters.sortDirection = sortDirection;
        }
      }
    });

    return filters;
  }

  function hasActiveSearchFilters(filters) {
    if (!filters || !isObject(filters)) {
      return false;
    }

    return (Array.isArray(filters.genres) && filters.genres.length > 0) ||
      cleanText(filters.status).length > 0 ||
      toPositiveInteger(filters.minChapters, 0) > 0 ||
      hasArchiveSort(filters);
  }

  function hasArchiveSort(filters) {
    return cleanText(filters && filters.sortBy).length > 0 ||
      cleanText(filters && filters.sortDirection).length > 0;
  }

  function buildArchiveQueryParams(title, filters, page, perPage) {
    var sortOption = getArchiveSortOption(filters && filters.sortBy) || getArchiveSortOption("latest_chapters");
    var genreIds = Array.isArray(filters && filters.archiveGenreIds) ? filters.archiveGenreIds : [];
    var minChapters = toPositiveInteger(filters && filters.minChapters, 0);
    var params = {
      page: toPositiveInteger(page, 1),
      perPage: toPositiveInteger(perPage, SEARCH_PER_PAGE),
      view: "archive",
      seriesType: ARCHIVE_DEFAULT_SERIES_TYPES,
      orderBy: sortOption.orderBy,
      orderDirection: getArchiveOrderDirection(filters && filters.sortDirection, sortOption.defaultDirection)
    };
    var searchTerm = cleanText(title || "");
    var seriesStatus = cleanText(filters && filters.status);

    if (searchTerm.length > 0) {
      params.searchTerm = searchTerm;
    }
    if (genreIds.length > 0) {
      params.genreIds = genreIds.join(",");
    }
    if (seriesStatus.length > 0) {
      params.seriesStatus = seriesStatus;
    }
    if (minChapters > 0) {
      params.minChapters = minChapters;
    }

    return params;
  }

  function createMinimumChaptersSearchField() {
    var field = {
      id: SEARCH_FIELD_MIN_CHAPTERS,
      name: "Minimum Chapters",
      placeholder: "e.g. 10"
    };
    return typeof App !== "undefined" && App && typeof App.createSearchField === "function" ? App.createSearchField(field) : field;
  }

  function extractMinimumChaptersFilterValue(query) {
    var parameters = isObject(query && query.parameters) ? query.parameters : {};
    var values = Array.isArray(parameters[SEARCH_FIELD_MIN_CHAPTERS]) ? parameters[SEARCH_FIELD_MIN_CHAPTERS] : [];
    var rawValue = "";

    for (var index = 0; index < values.length; index += 1) {
      rawValue = cleanText(values[index]);
      if (rawValue.length > 0) {
        break;
      }
    }

    if (rawValue.length === 0) {
      return void 0;
    }
    if (!/^\d+$/.test(rawValue)) {
      throw new Error("Minimum Chapters must be a positive whole number.");
    }

    var minChapters = parseInt(rawValue, 10);
    if (!isFinite(minChapters) || minChapters <= 0) {
      throw new Error("Minimum Chapters must be a positive whole number.");
    }

    return minChapters;
  }

  function buildArchiveGenreIds(selectedGenres, seriesList) {
    var selected = {};
    var seen = {};
    var ids = [];

    (Array.isArray(selectedGenres) ? selectedGenres : []).forEach(function(genreId) {
      selected[cleanText(genreId)] = true;
    });

    normalizeSeriesPayloads(seriesList).forEach(function(series) {
      (Array.isArray(series.genres) ? series.genres : []).forEach(function(genre) {
        var paperbackGenreId = getGenreOptionId(genre && genre.name);
        var archiveGenreId = cleanText(genre && genre.id);
        if (!selected[paperbackGenreId] || archiveGenreId.length === 0 || seen[archiveGenreId]) {
          return;
        }

        seen[archiveGenreId] = true;
        ids.push(archiveGenreId);
      });
    });

    return ids;
  }

  function getArchiveSortOption(sortBy) {
    var sortId = cleanText(sortBy || "");
    for (var index = 0; index < ARCHIVE_SORT_OPTIONS.length; index += 1) {
      if (ARCHIVE_SORT_OPTIONS[index].id === sortId) {
        return ARCHIVE_SORT_OPTIONS[index];
      }
    }
    return null;
  }

  function getArchiveOrderDirection(sortDirection, fallback) {
    var direction = cleanText(sortDirection || "");
    return isArchiveOrderDirection(direction) ? direction : fallback;
  }

  function isArchiveOrderDirection(sortDirection) {
    return ARCHIVE_ORDER_OPTIONS.some(function(option) {
      return option.id === sortDirection;
    });
  }

  function extractGenreOptions(seriesList) {
    var deduped = {};

    normalizeSeriesPayloads(seriesList).forEach(function(series) {
      (Array.isArray(series.genres) ? series.genres : []).forEach(function(genre) {
        var option = createGenreOption(genre);
        if (!option) {
          return;
        }
        deduped[option.id] = option;
      });
    });

    return Object.keys(deduped).map(function(id) {
      return deduped[id];
    });
  }

  function extractNamedFilterOptions(seriesList, fieldName) {
    var deduped = {};

    normalizeSeriesPayloads(seriesList).forEach(function(series) {
      var value = cleanText(series && series[fieldName]);
      if (value.length === 0 || value.toUpperCase() === "NOVEL") {
        return;
      }

      deduped[value] = {
        id: value,
        label: formatOptionLabel(value)
      };
    });

    return Object.keys(deduped).map(function(id) {
      return deduped[id];
    });
  }

  function normalizeFilterOptions(options) {
    return (Array.isArray(options) ? options : []).filter(function(option) {
      return cleanText(option && option.id).length > 0 && cleanText(option && option.label).length > 0;
    }).map(function(option) {
      return {
        id: cleanText(option.id),
        label: cleanText(option.label)
      };
    }).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  // Detail Helpers

  function buildDetailTagSections(series) {
    var deduped = {};
    var genreTags = [];

    (Array.isArray(series && series.genres) ? series.genres : []).forEach(function(genre) {
      var option = createGenreOption(genre);
      if (!option || deduped[option.id]) {
        return;
      }

      deduped[option.id] = true;
      genreTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_GENRE + option.id,
        label: option.label
      }));
    });

    if (genreTags.length === 0) {
      return [];
    }

    return [
      App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags
      })
    ];
  }

  function resolveSeriesImage(series) {
    var candidates = [
      series && series.featuredImage,
      series && series.featuredImageCL,
      series && series.featuredLogo,
      series && series.coverImage,
      series && series.seriesImage,
      series && series.bannerHero,
      series && series.banner
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      var image = normalizeUrl(candidates[index] || "");
      if (image.length > 0) {
        return image;
      }
    }

    return "";
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
    var clean = cleanText(value || "");
    if (clean.length > 0 && titles.indexOf(clean) === -1) {
      titles.push(clean);
    }
  }

  function splitAlternativeTitles(value) {
    return String(value || "").split(/\s*[,;\n\r\u2022]+\s*/).map(function(title) {
      return cleanText(title);
    }).filter(function(title) {
      return title.length > 0;
    });
  }

  function createGenreOption(genre) {
    var label = normalizeGenreLabel(genre && genre.name);
    var id = toOptionId(label);

    if (id.length === 0 || label.length === 0) {
      return null;
    }

    return {
      id: id,
      label: label
    };
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

    return formatOptionLabel(rawLabel);
  }

  function getGenreOptionId(value) {
    return toOptionId(normalizeGenreLabel(value));
  }

  function toGenreNormalizationKey(value) {
    return cleanText(String(value || "").replace(/[_-]+/g, " "))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function mapStatus(status) {
    var value = cleanText(status).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function compareChapterEntriesDesc(left, right) {
    var leftNumber = toNumber(left && left.number, NaN);
    var rightNumber = toNumber(right && right.number, NaN);

    if (isFinite(leftNumber) && isFinite(rightNumber) && leftNumber !== rightNumber) {
      return rightNumber - leftNumber;
    }

    var leftDate = parseDate(left && (left.updatedAt || left.createdAt)).getTime();
    var rightDate = parseDate(right && (right.updatedAt || right.createdAt)).getTime();
    if (leftDate !== rightDate) {
      return rightDate - leftDate;
    }

    var leftSlug = cleanText(left && left.slug);
    var rightSlug = cleanText(right && right.slug);
    if (leftSlug < rightSlug) return 1;
    if (leftSlug > rightSlug) return -1;
    return 0;
  }

  function isDisplayChapter(chapter) {
    return isObject(chapter) &&
      typeof chapter.slug === "string" &&
      chapter.slug.length > 0 &&
      chapter.number !== void 0;
  }

  function normalizeChapterEntries(chapters) {
    var deduped = {};
    var ordered = [];

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      if (!isDisplayChapter(chapter)) {
        return;
      }

      var slug = cleanText(chapter.slug);
      if (slug.length === 0 || deduped[slug]) {
        return;
      }

      deduped[slug] = true;
      ordered.push(chapter);
    });

    return ordered;
  }

  function findFirstChapterPreview(chapters) {
    var previewChapters = Array.isArray(chapters) ? chapters.filter(isDisplayChapter).slice().sort(compareChapterEntriesDesc) : [];
    return previewChapters.length > 0 ? previewChapters[0] : null;
  }

  function getChapterAccessState(chapter) {
    if (!isObject(chapter)) {
      return CHAPTER_ACCESS_UNKNOWN;
    }

    if (chapter.isAccessible === true || chapter.isLocked === false) {
      return CHAPTER_ACCESS_READABLE;
    }

    if (chapter.isAccessible === false ||
      chapter.isLocked === true ||
      chapter.isLockedByCoins === true ||
      toNumber(chapter.isPermanentlyLocked, 0) > 0 ||
      toNumber(chapter.finalPrice, toNumber(chapter.price, 0)) > 0) {
      return CHAPTER_ACCESS_LOCKED;
    }

    return CHAPTER_ACCESS_UNKNOWN;
  }

  function shouldIncludeChapterForList(chapter, showLockedChapters) {
    var accessState = getChapterAccessState(chapter);
    if (accessState === CHAPTER_ACCESS_READABLE) {
      return true;
    }
    if (accessState === CHAPTER_ACCESS_LOCKED) {
      return showLockedChapters === true;
    }
    return false;
  }

  function buildChapterListName(chapter, fallbackNumber) {
    return getChapterAccessState(chapter) === CHAPTER_ACCESS_LOCKED ?
      buildLockedChapterLabel(chapter, fallbackNumber) :
      buildReadableChapterLabel(chapter, fallbackNumber);
  }

  function buildReadableChapterLabel(chapter, fallbackNumber) {
    var chapterNumber = toChapterNumber(chapter && chapter.number, fallbackNumber);
    var title = cleanText(chapter && chapter.title || "");
    var normalizedTitle = normalizeSearchText(title);
    if (title.length > 0 && normalizedTitle !== "chapter " + String(chapterNumber).toLowerCase()) {
      return "Chapter " + chapterNumber + ": " + title;
    }
    return "Chapter " + chapterNumber;
  }

  function buildLockedChapterLabel(chapter, fallbackNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapter, fallbackNumber);
  }

  async function getShowLockedChapters(stateManager) {
    var stored = await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS);
    return stored === true;
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
    var clean = cleanText(value || "");
    if (clean.length === 0) {
      return "";
    }
    return clean.replace("/public//", "/public/");
  }

  function normalizeSearchText(value) {
    return cleanText(value || "").toLowerCase();
  }

  function toOptionId(value) {
    return normalizeSearchText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
        if (part.length === 0) {
          return part;
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
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
    var clean = cleanText(value || "");
    return clean.length > 0 ? clean : void 0;
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
