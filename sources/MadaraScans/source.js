"use strict";

(function() {
  // Constants

  var DOMAIN = "https://madarascans.net";
  var AJAX_URL = DOMAIN + "/wp-admin/admin-ajax.php";

  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;

  var CONTENT_RATING_MATURE = "MATURE";

  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_NEW = "new_series";
  var SECTION_ID_LATEST_MANGA = "latest_manga";
  var SECTION_ID_LATEST_COMICS = "latest_comics";
  var SECTION_ID_COMPLETED = "completed_series";
  var SECTION_ID_COLLECTION_PREFIX = "collection:";

  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_GENRE_SLUG = "genre-slug:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";

  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var STATE_SHOW_CURATED_COLLECTIONS = "show_curated_collections";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var LOCKED_CHAPTER_ID_PREFIX = "locked::";
  var SERIES_PAGE_CACHE_TTL_MS = 30000;
  var SERIES_PAGE_CACHE_LIMIT = 20;
  var COLLECTION_CACHE_TTL_MS = 300000;

  var BROWSE_STATUS_OPTIONS = [
    { id: "ongoing", label: "Ongoing" },
    { id: "completed", label: "Completed" },
    { id: "hiatus", label: "Hiatus" }
  ];
  var BROWSE_TYPE_OPTIONS = [
    { id: "manga", label: "Manga" },
    { id: "manhwa", label: "Manhwa" },
    { id: "manhua", label: "Manhua" },
    { id: "comic", label: "Comic" }
  ];
  var BROWSE_ORDER_OPTIONS = [
    { id: "title", label: "A-Z" },
    { id: "titlereverse", label: "Z-A" },
    { id: "update", label: "Recently Updated" },
    { id: "latest", label: "Recently Added" },
    { id: "popular", label: "Popular" }
  ];
  var GENRE_LABEL_OVERRIDES = {
    "sci fi": "Sci-Fi"
  };

  // Source Info

  var MadaraScansInfo = {
    version: "2.0.0",
    name: "MadaraScans",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function MadaraScans() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 3,
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

    this.stateManager = App.createSourceStateManager();
    this.cachedFilterData = null;
    this.cachedFilterDataRequest = null;
    this.cachedLatestComicsItems = null;
    this.cachedLatestComicsHasMore = false;
    this.cachedCollectionSections = {};
    this.cachedCollectionSectionTimes = {};
    this.cachedCollectionSectionRequests = {};
    this.cachedSeriesPages = {};
    this.cachedSeriesPageTimes = {};
    this.cachedSeriesPageRequests = {};
  }

  // Paperback Interface Methods

  MadaraScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  MadaraScans.prototype.getTags = async function() {
    return this.getSearchTags();
  };

  MadaraScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodePathSegment(seriesId) + "/";
  };

  MadaraScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    if (isLockedChapterId(chapterId)) {
      var postId = extractLockedChapterPostId(chapterId);
      return postId.length > 0 ? DOMAIN + "/?p=" + encodeURIComponent(postId) : this.getMangaShareUrl(seriesId);
    }
    return DOMAIN + "/" + encodePathSegment(chapterId) + "/";
  };

  MadaraScans.prototype.getHomePageSections = async function(sectionCallback) {
    var html = await this.fetchText(DOMAIN + "/");
    this.cachedLatestComicsItems = parseSeriesCardItems(extractLatestComicsHomeHtml(html));
    this.cachedLatestComicsHasMore = hasLatestComicsMoreItems(html);
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        parseHeroHomeItems(html),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Popular Today",
        "singleRowLarge",
        parseSeriesCardItems(extractHomeSectionHtml(html, "popular-today")),
        false
      ),
      createHomeSection(
        SECTION_ID_NEW,
        "New Series",
        "singleRowNormal",
        parseSeriesCardItems(extractHomeSectionHtml(html, "new-series")),
        true
      ),
      createHomeSection(
        SECTION_ID_LATEST_MANGA,
        "Latest Manga",
        "singleRowNormal",
        parseSeriesCardItems(extractHomeSectionHtml(html, "latest-manga")),
        true
      ),
      createHomeSection(
        SECTION_ID_LATEST_COMICS,
        "Latest Comics",
        "singleRowNormal",
        this.cachedLatestComicsItems,
        this.cachedLatestComicsHasMore
      ),
      createHomeSection(
        SECTION_ID_COMPLETED,
        "Completed Series",
        "singleRowNormal",
        parseSeriesCardItems(extractHomeSectionHtml(html, "completed-series")),
        true
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });

    if (!(await getShowCuratedCollections(this.stateManager))) {
      return;
    }

    var collectionSections = await this.getHomeCollectionSections(parseHomeCollectionDefinitions(html));

    collectionSections.filter(function(section) {
      return section && Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  MadaraScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);

    if (homepageSectionId === SECTION_ID_NEW) {
      return this.getBrowseResults({ order: "latest" }, page);
    }
    if (homepageSectionId === SECTION_ID_LATEST_MANGA) {
      return this.getBrowseResults({ type: "manga", order: "update" }, page);
    }
    if (homepageSectionId === SECTION_ID_LATEST_COMICS) {
      return this.getLatestComicsSectionItems(page);
    }
    if (homepageSectionId === SECTION_ID_COMPLETED) {
      return this.getBrowseResults({ status: "completed", order: "update" }, page);
    }

    return App.createPagedResults({
      results: []
    });
  };

  MadaraScans.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  MadaraScans.prototype.getSourceMenu = async function() {
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
          }),
          App.createDUISwitch({
            id: STATE_SHOW_CURATED_COLLECTIONS,
            label: "Show Curated Collections",
            value: App.createDUIBinding({
              get: async function() {
                return getShowCuratedCollections(stateManager);
              },
              set: async function(newValue) {
                await stateManager.store(STATE_SHOW_CURATED_COLLECTIONS, newValue === true);
              }
            })
          })
        ];
      }
    });
  };

  MadaraScans.prototype.supportsTagExclusion = async function() {
    return false;
  };

  MadaraScans.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.getFilterDataSafe());
  };

  MadaraScans.prototype.getMangaDetails = async function(seriesId) {
    var details = parseSeriesDetails(await this.getSeriesPageHtml(seriesId));
    var filterData = this.cachedFilterData || createFallbackFilterData();

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title, details.alternateTitles),
        image: details.image,
        desc: details.description,
        status: mapStatus(details.status),
        author: emptyToUndefined(details.author),
        artist: emptyToUndefined(details.artist),
        rating: details.rating,
        tags: buildDetailTagSections(details, filterData),
        hentai: false
      })
    });
  };

  MadaraScans.prototype.getChapters = async function(seriesId) {
    var results = await Promise.all([
      this.getSeriesPageHtml(seriesId),
      getShowLockedChapters(this.stateManager)
    ]);
    var entries = parseChapterEntries(results[0], seriesId).filter(function(entry) {
      return entry.isLocked ? results[1] === true : true;
    });
    var chapters = entries.map(function(entry) {
      var chapter = {
        id: entry.id,
        name: buildChapterListName(entry.label, entry.number, entry.isLocked, entry.coinCost),
        chapNum: entry.number,
        langCode: "en"
      };

      if (entry.date instanceof Date && !isNaN(entry.date.getTime())) {
        chapter.time = entry.date;
      }

      return App.createChapter(chapter);
    });

    if (chapters.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return chapters;
  };

  MadaraScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var chapterUrl = this.getChapterShareUrl(seriesId, chapterId);
    if (isLockedChapterId(chapterId)) {
      var lockedPostId = extractLockedChapterPostId(chapterId);
      if (lockedPostId.length === 0) {
        throw new Error("This chapter is locked on MadaraScans and cannot be loaded in Paperback.");
      }
    }

    var html = await this.fetchText(chapterUrl);
    if (isLockedChapterPage(html)) {
      throw new Error("This chapter is locked on MadaraScans and cannot be loaded in Paperback.");
    }

    var pages = parseChapterPages(html);
    if (pages.length === 0) {
      throw new Error("MadaraScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  MadaraScans.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var filters = extractSearchFilters(query);

    if (title.length > 0) {
      return this.getTitleSearchResults(title, page);
    }

    if (filters.genreSlugs.length > 0) {
      filters.genres = filters.genres.concat(await this.resolveGenreSlugFilters(filters.genreSlugs));
    }

    return this.getBrowseResults(filters, page);
  };

  // Source-Specific Fetch Helpers

  MadaraScans.prototype.getTitleSearchResults = async function(title, page) {
    var html = await this.fetchText(buildTitleSearchUrl(title, page));
    return App.createPagedResults({
      results: parseSeriesCardItems(html),
      metadata: hasNextPage(html) ? { page: page + 1 } : void 0
    });
  };

  MadaraScans.prototype.getBrowseResults = async function(filters, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var normalizedFilters = filters || {};
    var html = await this.fetchText(buildBrowseUrl(normalizedFilters, resolvedPage));
    return App.createPagedResults({
      results: parseSeriesCardItems(html),
      metadata: hasNextBrowsePage(html) ? { page: resolvedPage + 1 } : void 0
    });
  };

  MadaraScans.prototype.getLatestComicsSectionItems = async function(page) {
    var resolvedPage = toPositiveInteger(page, 1);

    if (resolvedPage <= 1) {
      var initialItems = this.cachedLatestComicsItems;
      var hasMore = this.cachedLatestComicsHasMore === true;
      if (!Array.isArray(initialItems)) {
        var initialHomeHtml = await this.fetchText(DOMAIN + "/");
        initialItems = parseSeriesCardItems(extractLatestComicsHomeHtml(initialHomeHtml));
        this.cachedLatestComicsItems = initialItems;
        hasMore = hasLatestComicsMoreItems(initialHomeHtml);
        this.cachedLatestComicsHasMore = hasMore;
      }

      return App.createPagedResults({
        results: Array.isArray(initialItems) ? initialItems : [],
        metadata: hasMore ? { page: 2 } : void 0
      });
    }

    var responseHtml = normalizeAjaxHtmlPayload(await this.fetchAjaxHtml({
      action: "load_more_manga_posts",
      page: resolvedPage
    }, DOMAIN + "/"));
    var items = parseSeriesCardItems(responseHtml);

    return App.createPagedResults({
      results: items,
      metadata: items.length > 0 ? { page: resolvedPage + 1 } : void 0
    });
  };

  MadaraScans.prototype.fetchFilterData = async function() {
    var html = await this.fetchText(DOMAIN + "/series/");
    var radioOptions = extractLiveRadioFilterOptions(html);
    return {
      genres: extractGenreFilterOptions(html),
      statuses: radioOptions.statuses.length > 0 ? radioOptions.statuses : BROWSE_STATUS_OPTIONS,
      types: radioOptions.types.length > 0 ? radioOptions.types : BROWSE_TYPE_OPTIONS,
      orders: radioOptions.orders.length > 0 ? radioOptions.orders : BROWSE_ORDER_OPTIONS
    };
  };

  MadaraScans.prototype.getFilterData = async function() {
    if (!this.cachedFilterData) {
      if (!this.cachedFilterDataRequest) {
        this.cachedFilterDataRequest = this.fetchFilterData().then(function(filterData) {
          this.cachedFilterData = filterData;
          this.cachedFilterDataRequest = null;
          return filterData;
        }.bind(this)).catch(function(error) {
          this.cachedFilterDataRequest = null;
          throw error;
        }.bind(this));
      }
      return this.cachedFilterDataRequest;
    }
    return this.cachedFilterData;
  };

  MadaraScans.prototype.getFilterDataSafe = async function() {
    try {
      return await this.getFilterData();
    } catch (_) {
      return createFallbackFilterData();
    }
  };

  MadaraScans.prototype.resolveGenreSlugFilters = async function(genreSlugs) {
    var requestedSlugs = normalizeStringArray(genreSlugs).map(function(slug) {
      return slug.toLowerCase();
    });
    if (requestedSlugs.length === 0) {
      return [];
    }

    var options = normalizeFilterOptions((await this.getFilterData()).genres);
    var resolved = requestedSlugs.map(function(slug) {
      var match = options.find(function(option) {
        return slugifyGenreLabel(option.label) === slug;
      });
      return match ? cleanText(match.id) : "";
    });
    if (resolved.some(function(id) { return id.length === 0; })) {
      throw new Error("MadaraScans could not resolve one of the selected genre filters.");
    }
    return normalizeStringArray(resolved);
  };

  MadaraScans.prototype.getHomeCollectionSections = async function(collectionDefinitions) {
    var definitions = Array.isArray(collectionDefinitions) ? collectionDefinitions : [];
    if (definitions.length === 0) {
      return [];
    }

    var sections = await Promise.all(definitions.map(function(collection) {
      return this.getHomeCollectionSection(collection);
    }.bind(this)));
    return sections.filter(function(section) {
      return section && Array.isArray(section.items) && section.items.length > 0;
    });
  };

  MadaraScans.prototype.getHomeCollectionSection = async function(collection) {
    var cacheKey = cleanText(collection && collection.id) + "|" + cleanText(collection && collection.url) + "|" + cleanText(collection && collection.title);
    var cachedAt = toNumber(this.cachedCollectionSectionTimes[cacheKey], 0);
    var cacheAge = Date.now() - cachedAt;
    if (Object.prototype.hasOwnProperty.call(this.cachedCollectionSections, cacheKey) && cacheAge >= 0 && cacheAge < COLLECTION_CACHE_TTL_MS) {
      return this.cachedCollectionSections[cacheKey];
    }

    if (this.cachedCollectionSectionRequests[cacheKey]) {
      return this.cachedCollectionSectionRequests[cacheKey];
    }

    this.cachedCollectionSectionRequests[cacheKey] = this.fetchText(collection.url).then(function(collectionHtml) {
      var items = parseCollectionSeriesItems(collectionHtml);
      var section = items.length > 0 ? createHomeSection(
        SECTION_ID_COLLECTION_PREFIX + collection.id,
        "Collection: " + collection.title,
        "singleRowNormal",
        items,
        false
      ) : null;
      this.cachedCollectionSections[cacheKey] = section;
      this.cachedCollectionSectionTimes[cacheKey] = Date.now();
      delete this.cachedCollectionSectionRequests[cacheKey];
      return section;
    }.bind(this)).catch(function() {
      delete this.cachedCollectionSectionRequests[cacheKey];
      return null;
    }.bind(this));

    return this.cachedCollectionSectionRequests[cacheKey];
  };

  MadaraScans.prototype.getSeriesPageHtml = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");
    var cachedAt = toNumber(this.cachedSeriesPageTimes[cacheKey], 0);
    var cacheAge = Date.now() - cachedAt;

    if (typeof this.cachedSeriesPages[cacheKey] === "string" && cacheAge >= 0 && cacheAge < SERIES_PAGE_CACHE_TTL_MS) {
      return this.cachedSeriesPages[cacheKey];
    }

    if (!this.cachedSeriesPageRequests[cacheKey]) {
      this.cachedSeriesPageRequests[cacheKey] = this.fetchText(this.getMangaShareUrl(cacheKey)).then(function(html) {
        this.cachedSeriesPages[cacheKey] = html;
        this.cachedSeriesPageTimes[cacheKey] = Date.now();
        pruneSeriesPageCache(this.cachedSeriesPages, this.cachedSeriesPageTimes, SERIES_PAGE_CACHE_LIMIT);
        delete this.cachedSeriesPageRequests[cacheKey];
        return html;
      }.bind(this)).catch(function(error) {
        delete this.cachedSeriesPageRequests[cacheKey];
        throw error;
      }.bind(this));
    }

    return this.cachedSeriesPageRequests[cacheKey];
  };

  MadaraScans.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  MadaraScans.prototype.fetchAjaxHtml = async function(data, referer) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: AJAX_URL,
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-requested-with": "XMLHttpRequest",
        referer: referer || DOMAIN + "/"
      },
      data: data || {}
    }), 1);

    return parseTextResponse(response, AJAX_URL);
  };

  // URL / Response Helpers

  function buildTitleSearchUrl(title, page) {
    if (page > 1) {
      return DOMAIN + "/page/" + page + "/?s=" + encodeURIComponent(title);
    }
    return DOMAIN + "/?s=" + encodeURIComponent(title);
  }

  function buildBrowseUrl(filters, page) {
    var normalizedFilters = filters || {};
    var params = [];
    var order = normalizeBrowseOrder(normalizedFilters.order);
    var status = normalizeBrowseStatus(normalizedFilters.status);
    var type = normalizeBrowseType(normalizedFilters.type);
    var genres = normalizeStringArray(normalizedFilters.genres);
    var resolvedPage = toPositiveInteger(page, 1);

    if (resolvedPage > 1) {
      params.push("page=" + resolvedPage);
    }
    genres.forEach(function(genre) {
      params.push("genre%5B%5D=" + encodeURIComponent(genre));
    });
    if (status.length > 0) {
      params.push("status=" + encodeURIComponent(status));
    }
    if (type.length > 0) {
      params.push("type=" + encodeURIComponent(type));
    }
    if (order.length > 0) {
      params.push("order=" + encodeURIComponent(order));
    }

    return DOMAIN + "/series/" + (params.length > 0 ? "?" + params.join("&") : "");
  }

  function parseTextResponse(response, url) {
    var data = response && response.data;
    var raw = typeof data === "string" ? data : data && typeof data === "object" ? JSON.stringify(data) : String(data || "");
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("MadaraScans returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }
    if (response.status === 404) {
      throw new Error("The requested MadaraScans page was not found.");
    }
    if (response.status >= 400) {
      throw new Error("MadaraScans returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").slice(0, 20000).toLowerCase();
    return lower.includes("cloudflare") && (lower.includes("just a moment") || lower.includes("attention required"));
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

  function createPartialSeries(series) {
    return App.createPartialSourceManga({
      mangaId: cleanText(series && series.id || ""),
      title: cleanText(series && series.title || ""),
      image: normalizeUrl(series && series.image || ""),
      subtitle: emptyToUndefined(series && series.subtitle)
    });
  }

  function parseSeriesCardItems(html) {
    var items = [];
    var seen = {};
    var value = scopeSeriesCardHtml(html);
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bbsx\b[^"']*["'])[^>]*>/gi;
    var starts = [];
    var match;

    while ((match = regex.exec(value)) !== null) {
      starts.push(match.index);
    }

    starts.forEach(function(start, index) {
      var block = value.slice(start, index + 1 < starts.length ? starts[index + 1] : value.length);
      var seriesAnchor = extractMatch(block, /<a\b(?=[^>]*\bhref=["'][^"']*\/series\/[^"']*["'])[^>]*>/i, 0);
      var seriesUrl = normalizeUrl(extractHtmlAttribute(seriesAnchor, "href") || extractFirstLinkHref(block, /\/series\//i));
      var seriesId = extractSeriesId(seriesUrl);

      if (seriesId.length === 0 || seen[seriesId]) {
        return;
      }

      var title = cleanText(extractHtmlAttribute(seriesAnchor, "title")) ||
        cleanText(extractMatch(block, /<div\b(?=[^>]*\bclass=["'][^"']*\btt\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i, 1)) ||
        cleanText(extractHtmlAttribute(extractMatch(block, /<img\b[^>]*>/i, 0), "alt"));

      if (title.length === 0) {
        return;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: extractFirstImageUrl(block),
        subtitle: buildSeriesCardSubtitle(block)
      }));
    });

    return items;
  }

  function scopeSeriesCardHtml(html) {
    var value = String(html || "");
    var listMatch = /<div\b(?=[^>]*\bclass=["'][^"']*\blistupd\b[^"']*["'])[^>]*>/i.exec(value);
    if (listMatch) {
      var listRest = value.slice(listMatch.index);
      var listEndIndex = listRest.search(/<div\b(?=[^>]*\bclass=["'][^"']*\bhpage\b[^"']*["'])|<div\b(?=[^>]*\bid=["']sidebar["'])/i);
      return listEndIndex >= 0 ? listRest.slice(0, listEndIndex) : listRest;
    }

    var latestMatch = /<div\b(?=[^>]*\bid=["']manga-posts["'])[^>]*>/i.exec(value);
    if (latestMatch) {
      var latestRest = value.slice(latestMatch.index);
      var latestEndIndex = latestRest.search(/<button\b(?=[^>]*\bid=["']load-more["'])|<div\b(?=[^>]*\bdata-violet-section=["']completed-series["'])/i);
      return latestEndIndex >= 0 ? latestRest.slice(0, latestEndIndex) : latestRest;
    }

    return value;
  }

  function buildSeriesCardSubtitle(block) {
    var chapter = cleanText(extractMatch(block, /<div\b(?=[^>]*\bclass=["'][^"']*\bepxs\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i, 1));
    var date = cleanText(extractMatch(block, /<div\b(?=[^>]*\bclass=["'][^"']*\bepxdate\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i, 1));
    if (chapter.length > 0 && chapter !== "Chapter ?") {
      return chapter + (date.length > 0 ? " · " + date : "");
    }

    var format = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bviolet-format\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1));
    var status = cleanText(extractMatch(block, /<div\b(?=[^>]*\bclass=["'][^"']*\bstatus\b[^"']*["'])[^>]*>[\s\S]*?<i[^>]*>([\s\S]*?)<\/i>/i, 1));
    return [format, status].filter(function(value) {
      return value.length > 0;
    }).join(" · ");
  }

  function extractSeriesId(url) {
    var match = String(url || "").match(/\/series\/([^/?#]+)\/?/i);
    return match ? match[1] : "";
  }

  function hasNextPage(html) {
    var value = String(html || "");
    return /<a\b(?=[^>]*\bclass=["'][^"']*\bnext\b[^"']*["'])(?=[^>]*\bclass=["'][^"']*\bpage-numbers\b[^"']*["'])/i.test(value) ||
      /<link\b(?=[^>]*\brel=["']next["'])(?=[^>]*\bhref=["'])/i.test(value);
  }

  function hasNextBrowsePage(html) {
    var hpage = sliceBetween(html, /<div\b(?=[^>]*\bclass=["'][^"']*\bhpage\b[^"']*["'])/i, /<\/div>/i);
    return /<a\b(?=[^>]*\bclass=["'][^"']*\br\b[^"']*["'])(?=[^>]*\bhref=["'][^"']+["'])[^>]*>/i.test(hpage);
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

  function parseHeroHomeItems(html) {
    var items = [];
    var seen = {};
    var heroHtml = sliceBetween(html, /<div\b(?=[^>]*\bid=["']violet-hero-slider["'])/i, /<div\b(?=[^>]*\bclass=["'][^"']*\bviolet-popular-today-section\b[^"']*["'])/i);
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bswiper-slide\b[^"']*["'])[\s\S]*?(?=<div\b(?=[^>]*\bclass=["'][^"']*\bswiper-slide\b[^"']*["'])|$)/gi;
    var match;

    while ((match = regex.exec(heroHtml)) !== null) {
      var block = match[0];
      var seriesUrl = normalizeUrl(extractFirstLinkHref(block, /\/series\//i));
      var seriesId = extractSeriesId(seriesUrl);
      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var imageTag = extractTagByClass(block, "img", "slider-content") || extractMatch(block, /<img\b[^>]*>/i, 0);
      var title = cleanText(extractHtmlAttribute(imageTag, "alt"));
      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title.length > 0 ? title : seriesId.replace(/-/g, " "),
        image: extractFirstImageUrl(block)
      }));
    }

    return items;
  }

  function extractHomeSectionHtml(html, sectionId) {
    var value = String(html || "");
    var startPattern = new RegExp('<div\\b(?=[^>]*\\bdata-violet-section=["\\\']' + escapeRegex(sectionId) + '["\\\'])[^>]*>', "i");
    var startMatch = startPattern.exec(value);
    if (!startMatch) {
      return "";
    }

    var rest = value.slice(startMatch.index + startMatch[0].length);
    var endIndex = rest.search(/<section\b(?=[^>]*\bclass=["'][^"']*\bmadara-home-collections\b[^"']*["'])|<div\b(?=[^>]*\bclass=["'][^"']*\bviolet-latest-comics\b[^"']*["'])|<div\b(?=[^>]*\bdata-violet-section=["'])/i);
    return value.slice(startMatch.index, endIndex >= 0 ? startMatch.index + startMatch[0].length + endIndex : value.length);
  }

  function extractLatestComicsHomeHtml(html) {
    return sliceBetween(
      html,
      /<div\b(?=[^>]*\bclass=["'][^"']*\bviolet-latest-comics\b[^"']*["'])/i,
      /<div\b(?=[^>]*\bdata-violet-section=["']completed-series["'])/i
    );
  }

  function hasLatestComicsMoreItems(html) {
    return /<button\b(?=[^>]*\bid=["']load-more["'])[^>]*>/i.test(String(html || ""));
  }

  function normalizeAjaxHtmlPayload(payload) {
    var raw = String(payload || "").trim();
    if (raw.length === 0) {
      return "";
    }

    if (raw.charAt(0) !== "{" && raw.charAt(0) !== "[") {
      return raw;
    }

    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.success === false) {
        return "";
      }
      return parsed && typeof parsed.data === "string" ? parsed.data : raw;
    } catch (_) {
      return raw;
    }
  }

  function parseHomeCollectionDefinitions(html) {
    var collections = [];
    var seen = {};
    var regex = /<a\b(?=[^>]*\bclass=["'][^"']*\bmadara-collection-card\b[^"']*["'])[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var url = normalizeUrl(extractHtmlAttribute(extractMatch(block, /<a\b[^>]*>/i, 0), "href"));
      var id = cleanText(extractMatch(url, /\/collections\/([^/?#]+)\/?/i, 1));
      var title = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bmadara-collection-card__title\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1));
      if (id.length === 0 || title.length === 0 || seen[id]) {
        continue;
      }

      seen[id] = true;
      collections.push({ id: id, title: title, url: url });
    }

    return collections;
  }

  function parseCollectionSeriesItems(html) {
    var items = [];
    var seen = {};
    var regex = /<a\b(?=[^>]*\bclass=["'][^"']*\bmadara-collection-work\b[^"']*["'])[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var url = normalizeUrl(extractHtmlAttribute(extractMatch(block, /<a\b[^>]*>/i, 0), "href"));
      var seriesId = extractSeriesId(url);
      var title = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bmadara-collection-work__title\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1));
      if (seriesId.length === 0 || title.length === 0 || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: extractFirstImageUrl(block)
      }));
    }

    return items;
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var statuses = normalizeFilterOptions((filterData && filterData.statuses) || BROWSE_STATUS_OPTIONS, false);
    var types = normalizeFilterOptions((filterData && filterData.types) || BROWSE_TYPE_OPTIONS, false);
    var orders = normalizeFilterOptions((filterData && filterData.orders) || BROWSE_ORDER_OPTIONS, false);

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
      sections.push(createFilterTagSection("status", "Status", statuses, SEARCH_TAG_PREFIX_STATUS));
    }

    if (types.length > 0) {
      sections.push(createFilterTagSection("type", "Type", types, SEARCH_TAG_PREFIX_TYPE));
    }

    if (orders.length > 0) {
      sections.push(createFilterTagSection("order", "Order", orders, SEARCH_TAG_PREFIX_ORDER));
    }

    return sections;
  }

  function createFilterTagSection(id, label, options, prefix) {
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
      genres: [],
      genreSlugs: [],
      status: "",
      type: "",
      order: ""
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];

    includedTags.forEach(function(tag) {
      var tagId = cleanText(tag && tag.id || "");
      if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0) {
        filters.genres.push(tagId.slice(SEARCH_TAG_PREFIX_GENRE.length));
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE_SLUG) === 0) {
        filters.genreSlugs.push(tagId.slice(SEARCH_TAG_PREFIX_GENRE_SLUG.length));
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0) {
        filters.status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0) {
        filters.type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_ORDER) === 0) {
        filters.order = tagId.slice(SEARCH_TAG_PREFIX_ORDER.length);
      }
    });

    filters.genres = normalizeStringArray(filters.genres);
    filters.genreSlugs = normalizeStringArray(filters.genreSlugs);
    filters.status = normalizeBrowseStatus(filters.status);
    filters.type = normalizeBrowseType(filters.type);
    filters.order = normalizeBrowseOrder(filters.order);
    return filters;
  }

  function extractGenreFilterOptions(html) {
    var options = [];
    var seen = {};
    var value = String(html || "");
    var genreListHtml = sliceBetween(
      value,
      /<ul\b(?=[^>]*\bclass=["'][^"']*\bgenrez\b[^"']*["'])[^>]*>/i,
      /<\/ul>/i
    ) || value;
    var regex = /<li\b[^>]*>\s*<input\b(?=[^>]*\bclass=["'][^"']*\bgenre-item\b[^"']*["'])[^>]*>[\s\S]*?<\/li>/gi;
    var match;

    while ((match = regex.exec(genreListHtml)) !== null) {
      var block = match[0];
      var inputHtml = extractMatch(block, /<input\b[^>]*>/i, 0);
      var labelHtml = extractMatch(block, /<label\b[^>]*>[\s\S]*?<\/label>/i, 0);
      var id = cleanText(extractHtmlAttribute(inputHtml, "value"));
      var inputId = cleanText(extractHtmlAttribute(inputHtml, "id"));
      var labelFor = cleanText(extractHtmlAttribute(labelHtml, "for"));
      var label = normalizeGenreLabel(labelHtml);

      if (id.length === 0 || inputId.length === 0 || labelFor !== inputId || label.length === 0 || seen[id]) {
        continue;
      }

      seen[id] = true;
      options.push({
        id: id,
        label: label
      });
    }

    return sortFilterOptions(options);
  }

  function extractLiveRadioFilterOptions(html) {
    var result = {
      statuses: [],
      types: [],
      orders: []
    };
    var seen = {
      status: {},
      type: {},
      order: {}
    };
    var filterFormHtml = sliceBetween(
      html,
      /<form\b(?=[^>]*\bclass=["'][^"']*\bfilters\b[^"']*["'])[^>]*>/i,
      /<\/form>/i
    ) || String(html || "");
    var regex = /<li\b[^>]*>\s*<input\b[^>]*\btype=["']radio["'][^>]*>[\s\S]*?<\/li>/gi;
    var match;

    while ((match = regex.exec(filterFormHtml)) !== null) {
      var block = match[0];
      var inputHtml = extractMatch(block, /<input\b[^>]*>/i, 0);
      var name = cleanText(extractHtmlAttribute(inputHtml, "name")).toLowerCase();
      var id = cleanText(extractHtmlAttribute(inputHtml, "value")).toLowerCase();
      if ((name !== "status" && name !== "type" && name !== "order") || id.length === 0 || seen[name][id]) {
        continue;
      }
      if (name === "type" && id === "novel") {
        continue;
      }

      var allowedOptions = name === "status" ? BROWSE_STATUS_OPTIONS : name === "type" ? BROWSE_TYPE_OPTIONS : BROWSE_ORDER_OPTIONS;
      if (!allowedOptions.some(function(option) { return option.id === id; })) {
        continue;
      }

      var inputId = cleanText(extractHtmlAttribute(inputHtml, "id"));
      var labelHtml = extractMatch(block, /<label\b[^>]*>[\s\S]*?<\/label>/i, 0);
      var labelFor = cleanText(extractHtmlAttribute(labelHtml, "for"));
      var label = cleanText(labelHtml);
      if (inputId.length === 0 || labelFor !== inputId || label.length === 0) {
        continue;
      }

      seen[name][id] = true;
      var option = { id: id, label: label };
      if (name === "status") result.statuses.push(option);
      if (name === "type") result.types.push(option);
      if (name === "order") result.orders.push(option);
    }

    return result;
  }

  function normalizeBrowseStatus(value) {
    return normalizeBrowseOption(value, BROWSE_STATUS_OPTIONS);
  }

  function normalizeBrowseType(value) {
    return normalizeBrowseOption(value, BROWSE_TYPE_OPTIONS);
  }

  function normalizeBrowseOrder(value) {
    return normalizeBrowseOption(value, BROWSE_ORDER_OPTIONS);
  }

  function normalizeBrowseOption(value, options) {
    var normalized = cleanText(value || "").toLowerCase();
    return (Array.isArray(options) ? options : []).some(function(option) {
      return option.id === normalized;
    }) ? normalized : "";
  }

  function createFallbackFilterData() {
    return {
      genres: [],
      statuses: BROWSE_STATUS_OPTIONS,
      types: BROWSE_TYPE_OPTIONS,
      orders: BROWSE_ORDER_OPTIONS
    };
  }

  function normalizeFilterOptions(options, shouldSort) {
    var normalized = (Array.isArray(options) ? options : []).map(function(option) {
      return {
        id: cleanText(option && option.id),
        label: cleanText(option && option.label)
      };
    }).filter(function(option) {
      return option.id.length > 0 && option.label.length > 0;
    });
    return shouldSort === false ? normalized : sortFilterOptions(normalized);
  }

  function sortFilterOptions(options) {
    return (Array.isArray(options) ? options.slice() : []).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  // Detail Helpers

  function parseSeriesDetails(html) {
    var value = String(html || "");
    var imageTag = extractMatch(value, /<div\b(?=[^>]*\bclass=["'][^"']*\bthumb\b[^"']*["'])[^>]*>[\s\S]*?<img\b[^>]*>/i, 0);
    var postedOn = cleanText(extractMatch(value, /<time\b(?=[^>]*\bitemprop=["']datePublished["'])[^>]*>([\s\S]*?)<\/time>/i, 1));
    var metadata = extractSeriesMetadata(value);

    return {
      title: extractSeriesTitle(value, value),
      alternateTitles: extractAlternateTitles(value),
      image: normalizeUrl(extractHtmlAttribute(imageTag, "src")) || normalizeUrl(extractMetaContent(value, "og:image")),
      description: extractSeriesDescription(value) || cleanText(extractMetaContent(value, "og:description")),
      status: metadata.status || cleanText(extractMatch(value, /<div\b(?=[^>]*\bclass=["'][^"']*\bstatus\b[^"']*["'])[^>]*>[\s\S]*?<i[^>]*>([\s\S]*?)<\/i>/i, 1)),
      type: metadata.type,
      released: metadata.released,
      author: metadata.author,
      artist: metadata.artist,
      serialization: metadata.serialization,
      uploader: cleanText(extractMatch(value, /Posted\s+By[\s\S]*?<i\b(?=[^>]*\bitemprop=["']name["'])[^>]*>([\s\S]*?)<\/i>/i, 1)),
      views: metadata.views,
      postedOn: postedOn,
      rating: toNumber(extractMatch(value, /<div\b(?=[^>]*\bclass=["'][^"']*\bnumscore\b[^"']*["'])[^>]*>([\d.]+)<\/div>/i, 1), 0),
      genres: extractDetailGenres(value)
    };
  }

  function extractSeriesTitle(heroHtml, pageHtml) {
    var title = cleanText(extractMatch(heroHtml, /<h1\b(?=[^>]*\bclass=["'][^"']*\bentry-title\b[^"']*["'])[^>]*>([\s\S]*?)<\/h1>/i, 1));
    if (title.length > 0) {
      return title;
    }

    title = cleanText(extractMetaContent(pageHtml, "og:image:alt"));
    if (title.length > 0) {
      return title;
    }

    return cleanSeriesSeoTitle(extractMetaContent(pageHtml, "og:title"));
  }

  function extractAlternateTitles(html) {
    var alternate = cleanText(extractMatch(html, /<div\b(?=[^>]*\bclass=["'][^"']*\bdesktop-titles\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i, 1));
    return alternate.length > 0 ? [alternate] : [];
  }

  function cleanSeriesSeoTitle(value) {
    return cleanText(value)
      .replace(/^Read\s+/i, "")
      .replace(/\s+(?:Manga|Manhwa|Manhua|Comic)\s*\|\s*Madarascans\s*$/i, "")
      .replace(/\s*\|\s*Madarascans\s*$/i, "")
      .trim();
  }

  function extractSeriesDescription(html) {
    var value = String(html || "");
    var startMatch = /<div\b(?=[^>]*\bclass=["'][^"']*\bentry-content-single\b[^"']*["'])[^>]*>/i.exec(value);
    if (!startMatch) {
      return "";
    }

    var rest = value.slice(startMatch.index + startMatch[0].length);
    var endIndex = rest.search(/<div\b(?=[^>]*\bclass=["'][^"']*\bsee-more\b[^"']*["'])/i);
    return cleanText(endIndex >= 0 ? rest.slice(0, endIndex) : extractMatch(rest, /^([\s\S]*?)<\/div>/i, 1));
  }

  function extractDetailGenres(html) {
    var genres = [];
    var seen = {};
    var genreHtml = sliceBetween(
      html,
      /<div\b(?=[^>]*\bclass=["'][^"']*\bgenres-container\b[^"']*["'])/i,
      /<div\b(?=[^>]*\bclass=["'][^"']*\bsummary\b[^"']*["'])/i
    ) || String(html || "");
    var regex = /<a\b(?=[^>]*\bhref=["'][^"']*\/genres\/[^"']*["'])[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(genreHtml)) !== null) {
      var linkHtml = match[0];
      var id = cleanText(extractMatch(extractHtmlAttribute(linkHtml, "href"), /\/genres\/([^/"?#]+)\/?/i, 1));
      var label = normalizeGenreLabel(linkHtml);
      if (id.length === 0 || label.length === 0 || seen[id]) {
        continue;
      }

      seen[id] = true;
      genres.push({
        id: id,
        label: label
      });
    }

    return genres;
  }

  function extractSeriesMetadata(html) {
    var metadata = {};
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bimptdt\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[1];
      var heading = cleanText(extractMatch(block, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i, 1));
      var key = normalizeMetadataLabel(heading);
      if (key.length === 0 || Object.prototype.hasOwnProperty.call(metadata, key)) {
        continue;
      }
      var value = cleanText(extractMatch(block, /<i\b[^>]*>([\s\S]*?)<\/i>/i, 1));
      if (value.length > 0) {
        metadata[key] = value;
      }
    }

    return metadata;
  }

  function normalizeMetadataLabel(value) {
    return cleanText(value).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function buildDetailTagSections(details, filterData) {
    var sections = [];
    var genreTags = [];
    var metadataTags = [];

    (Array.isArray(details && details.genres) ? details.genres : []).forEach(function(genre) {
      var resolved = resolveSearchableGenre(genre, filterData && filterData.genres);
      var label = cleanText(genre && genre.label);
      var slug = cleanText(genre && genre.id).toLowerCase();
      if (!resolved && (label.length === 0 || slug.length === 0)) {
        return;
      }
      genreTags.push(App.createTag({
        id: resolved ? SEARCH_TAG_PREFIX_GENRE + resolved.id : SEARCH_TAG_PREFIX_GENRE_SLUG + slug,
        label: resolved ? resolved.label : label
      }));
    });

    var status = normalizeBrowseStatus(details && details.status);
    if (status.length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_STATUS + status,
        label: "Status: " + formatOptionLabel(status)
      }));
    }

    var type = normalizeBrowseType(details && details.type);
    if (type.length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_TYPE + type,
        label: "Type: " + formatOptionLabel(type)
      }));
    }

    addDetailMetadataTag(metadataTags, "released", "Released", details && details.released);
    addDetailMetadataTag(metadataTags, "serialization", "Serialization", details && details.serialization);
    addDetailMetadataTag(metadataTags, "uploader", "Posted By", details && details.uploader);
    addDetailMetadataTag(metadataTags, "views", "Views", details && details.views);
    addDetailMetadataTag(metadataTags, "posted", "Posted On", details && details.postedOn);

    if (metadataTags.length > 0) {
      sections.push(App.createTagSection({
        id: "metadata",
        label: "Metadata",
        tags: metadataTags
      }));
    }

    if (genreTags.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags
      }));
    }

    return sections;
  }

  function resolveSearchableGenre(genre, options) {
    var label = cleanText(genre && genre.label);
    var slug = cleanText(genre && genre.id).toLowerCase();
    var normalizedLabel = normalizeGenreKey(label);
    var match = (Array.isArray(options) ? options : []).find(function(option) {
      var optionLabel = cleanText(option && option.label);
      return normalizeGenreKey(optionLabel) === normalizedLabel || slugifyGenreLabel(optionLabel) === slug;
    });
    if (!match) {
      return null;
    }
    return {
      id: cleanText(match.id),
      label: label || cleanText(match.label)
    };
  }

  function normalizeGenreKey(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function slugifyGenreLabel(value) {
    return normalizeGenreKey(value).replace(/\s+/g, "-");
  }

  function addDetailMetadataTag(tags, id, label, value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return;
    }
    tags.push(App.createTag({
      id: "metadata:" + id + ":" + toMetadataId(clean),
      label: label + ": " + clean
    }));
  }

  function toMetadataId(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function buildTitles(primaryTitle, alternateTitles) {
    var titles = [cleanText(primaryTitle)].concat(Array.isArray(alternateTitles) ? alternateTitles.map(cleanText) : []);
    var deduped = dedupeTextStrings(titles.filter(function(title) {
      return title.length > 0;
    }));
    return deduped.length > 0 ? deduped : ["Untitled"];
  }

  function mapStatus(status) {
    var value = cleanText(status).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function parseChapterEntries(html, seriesId) {
    var entries = [];
    var seen = {};
    var listHtml = sliceBetween(
      html,
      /<div\b(?=[^>]*\bid=["']chapterlist["'])/i,
      /<\/ul>/i
    ) || String(html || "");
    var regex = /<li\b(?=[^>]*\bdata-num=["'])[^>]*>[\s\S]*?<\/li>/gi;
    var match;

    while ((match = regex.exec(listHtml)) !== null) {
      var block = match[0];
      var listTag = extractMatch(block, /<li\b[^>]*>/i, 0);
      var anchorTag = extractMatch(block, /<a\b[^>]*>/i, 0);
      var link = normalizeUrl(extractHtmlAttribute(anchorTag, "href"));
      var postId = cleanText(extractHtmlAttribute(anchorTag, "data-id"));
      var isLocked = link.length === 0 || isLockedChapterEntryHtml(block);
      var chapterId = isLocked ? buildLockedChapterId(postId, seriesId, extractHtmlAttribute(listTag, "data-num")) : extractLastPathComponent(link);

      if (chapterId.length === 0 || seen[chapterId]) {
        continue;
      }

      var rawLabel = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bchapternum\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1)) || cleanText(extractHtmlAttribute(anchorTag, "data-title"));
      var dataChapter = cleanText(extractHtmlAttribute(listTag, "data-num"));
      var label = normalizeChapterLabel(rawLabel || dataChapter);
      var number = extractChapterNumber(dataChapter || label);

      seen[chapterId] = true;
      entries.push({
        id: chapterId,
        label: label,
        number: number,
        date: parseDate(cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bchapterdate\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1))),
        isLocked: isLocked,
        coinCost: isLocked ? toPositiveInteger(extractHtmlAttribute(anchorTag, "data-coin"), 0) : 0
      });
    }

    return entries;
  }

  function parseChapterPages(html) {
    var readerPayload = extractReaderPayload(html);
    var pages = [];

    if (readerPayload && readerPayload.protected === true) {
      throw new Error("This chapter is locked on MadaraScans and cannot be loaded in Paperback.");
    }

    if (readerPayload) {
      var sourceList = Array.isArray(readerPayload.sources) ? readerPayload.sources : [];
      var primarySource = sourceList.find(function(source) {
        return Array.isArray(source && source.images) && source.images.length > 0;
      });

      pages = primarySource ? primarySource.images.map(function(page) {
        return normalizeUrl(page);
      }).filter(function(page) {
        return page.length > 0;
      }) : [];
    }

    if (pages.length === 0) {
      pages = extractReaderAreaImages(html);
    }

    return dedupeStrings(pages);
  }

  function extractReaderPayload(html) {
    var payloadText = extractBalancedJsonArgument(html, "ts_reader.run");
    if (payloadText.length === 0) {
      return null;
    }

    try {
      return JSON.parse(payloadText);
    } catch (_) {
      return null;
    }
  }

  function extractBalancedJsonArgument(html, functionName) {
    var value = String(html || "");
    var markerIndex = value.indexOf(functionName);
    if (markerIndex < 0) {
      return "";
    }

    var openParenIndex = value.indexOf("(", markerIndex + functionName.length);
    if (openParenIndex < 0) {
      return "";
    }

    var objectStart = value.indexOf("{", openParenIndex + 1);
    if (objectStart < 0) {
      return "";
    }

    var depth = 0;
    var inString = false;
    var escaped = false;
    for (var index = objectStart; index < value.length; index += 1) {
      var character = value.charAt(index);
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
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return value.slice(objectStart, index + 1);
        }
      }
    }

    return "";
  }

  function extractReaderAreaImages(html) {
    var readerHtml = sliceBetween(
      html,
      /<div\b(?=[^>]*\bclass=["'][^"']*\breader-area\b[^"']*["'])(?=[^>]*\bid=["']readerarea["'])/i,
      /<div\b(?=[^>]*\bid=["']reader-comments-area["'])/i
    );
    var pages = [];
    var regex = /<img\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(readerHtml)) !== null) {
      var tag = match[0];
      var src = normalizeUrl(extractHtmlAttribute(tag, "data-src") || extractHtmlAttribute(tag, "src"));
      if (src.length > 0) {
        pages.push(src);
      }
    }

    return pages;
  }

  function isLockedChapterEntryHtml(html) {
    var value = String(html || "");
    return /\bclass=["'][^"']*\blocked\b[^"']*["']/i.test(value) ||
      /\bclass=["'][^"']*\blocked-chapter\b[^"']*["']/i.test(value) ||
      /data-bs-target=["']#lockedChapterModal["']/i.test(value) ||
      /\bdata-coin=["'][^"']+["']/i.test(value) ||
      /coin-price/i.test(value) ||
      /fa-lock/i.test(value);
  }

  function isLockedChapterPage(html) {
    var value = String(html || "");
    return /This chapter is locked/i.test(value) ||
      /Please purchase it to read/i.test(value) ||
      /Buy now for/i.test(value) ||
      /\bclass=["'][^"']*\block-container\b[^"']*["']/i.test(value);
  }

  function buildLockedChapterId(postId, seriesId, chapterNumber) {
    var resolvedPostId = cleanText(postId);
    if (/^\d+$/.test(resolvedPostId)) {
      return LOCKED_CHAPTER_ID_PREFIX + resolvedPostId;
    }

    var fallback = [cleanText(seriesId), cleanText(chapterNumber)].filter(function(value) {
      return value.length > 0;
    }).join("::");
    return fallback.length > 0 ? LOCKED_CHAPTER_ID_PREFIX + fallback : "";
  }

  function isLockedChapterId(chapterId) {
    return cleanText(chapterId).indexOf(LOCKED_CHAPTER_ID_PREFIX) === 0;
  }

  function extractLockedChapterPostId(chapterId) {
    var value = cleanText(chapterId);
    if (!isLockedChapterId(value)) {
      return "";
    }
    var candidate = value.slice(LOCKED_CHAPTER_ID_PREFIX.length);
    return /^\d+$/.test(candidate) ? candidate : "";
  }

  function normalizeChapterLabel(value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return "";
    }

    if (/^chapter\b/i.test(clean)) {
      var suffix = clean.replace(/^chapter\b/i, "").replace(/^\s*:\s*/, " ").trim();
      return suffix.length > 0 ? "Chapter " + suffix : "Chapter";
    }

    return clean;
  }

  function buildChapterListName(chapterLabel, chapterNumber, isLockedChapter, coinCost) {
    var label = normalizeChapterLabel(chapterLabel);
    if (label.length === 0) {
      label = chapterNumber > 0 ? "Chapter " + formatChapterNumber(chapterNumber) : "Chapter";
    }

    if (!isLockedChapter) {
      return label;
    }

    var lockedLabel = LOCKED_CHAPTER_LABEL_PREFIX + label;
    var cost = toPositiveInteger(coinCost, 0);
    return cost > 0 ? lockedLabel + " · " + cost + (cost === 1 ? " coin" : " coins") : lockedLabel;
  }

  function extractChapterNumber(value) {
    var match = String(value || "").match(/(\d+(?:\.\d+)?)/);
    return match ? toNumber(match[1], 0) : 0;
  }

  function formatChapterNumber(value) {
    return String(value || "").replace(/\.0+$/, "");
  }

  async function getShowLockedChapters(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS)) === true;
  }

  async function getShowCuratedCollections(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_CURATED_COLLECTIONS)) !== false;
  }

  // Generic Utilities

  function extractHtmlAttribute(html, attributeName) {
    var pattern = new RegExp("\\b" + escapeRegex(attributeName) + "=(['\"])([\\s\\S]*?)\\1", "i");
    var match = String(html || "").match(pattern);
    return match ? decodeEntities(match[2]) : "";
  }

  function extractTagByClass(html, tagName, className) {
    var regex = new RegExp("<" + escapeRegex(tagName) + "\\b[^>]*>", "gi");
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      if (hasHtmlClass(match[0], className)) {
        return match[0];
      }
    }

    return "";
  }

  function extractFirstLinkHref(html, hrefPattern) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var href = extractHtmlAttribute(match[0], "href");
      if (!hrefPattern || hrefPattern.test(href)) {
        return href;
      }
    }

    return "";
  }

  function extractMetaContent(html, propertyName) {
    var target = cleanText(propertyName).toLowerCase();
    var regex = /<meta\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var name = cleanText(extractHtmlAttribute(tag, "property") || extractHtmlAttribute(tag, "name")).toLowerCase();
      if (name === target) {
        return extractHtmlAttribute(tag, "content");
      }
    }

    return "";
  }

  function hasHtmlClass(html, className) {
    return extractHtmlAttribute(html, "class").split(/\s+/).some(function(value) {
      return value === className;
    });
  }

  function extractFirstImageUrl(html) {
    var imageTag = extractTagByClass(html, "img", "ts-post-image") ||
      extractTagByClass(html, "img", "wp-post-image") ||
      extractMatch(html, /<img\b[^>]*>/i, 0);
    return normalizeUrl(extractHtmlAttribute(imageTag, "data-src") || extractHtmlAttribute(imageTag, "src"));
  }

  function extractLastPathComponent(url) {
    var value = String(url || "").split(/[?#]/)[0].replace(/\/+$/, "");
    var slashIndex = value.lastIndexOf("/");
    return slashIndex >= 0 ? value.slice(slashIndex + 1) : value;
  }

  function encodePathSegment(value) {
    var segment = cleanText(value || "");
    if (segment.length === 0) {
      return "";
    }

    try {
      segment = decodeURIComponent(segment);
    } catch (_) {
    }

    return encodeURIComponent(segment);
  }

  function normalizeUrl(value) {
    var url = decodeEntities(String(value || "").replace(/\\\//g, "/")).trim();
    if (url.length === 0 || url === "#") {
      return "";
    }
    if (url.indexOf("//") === 0) {
      return "https:" + url;
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    if (url.charAt(0) === "/") {
      return DOMAIN + url;
    }
    return DOMAIN + "/" + url.replace(/^\/+/, "");
  }

  function parseDate(value) {
    var clean = cleanText(value).replace(/\//g, "-");
    var date = new Date(clean);
    return isNaN(date.getTime()) ? void 0 : date;
  }

  function sliceBetween(value, startPattern, endPattern) {
    var html = String(value || "");
    var startIndex = typeof startPattern === "string" ? html.indexOf(startPattern) : html.search(startPattern);
    if (startIndex < 0) {
      return "";
    }

    var sliced = html.slice(startIndex);
    var endIndex = typeof endPattern === "string" ? sliced.indexOf(endPattern) : sliced.search(endPattern);
    return endIndex >= 0 ? sliced.slice(0, endIndex) : sliced;
  }

  function dedupeStrings(values) {
    var seen = {};
    var result = [];
    (Array.isArray(values) ? values : []).forEach(function(value) {
      var clean = normalizeUrl(value);
      if (clean.length === 0 || seen[clean]) {
        return;
      }

      seen[clean] = true;
      result.push(clean);
    });

    return result;
  }

  function dedupeTextStrings(values) {
    var seen = {};
    var result = [];
    (Array.isArray(values) ? values : []).forEach(function(value) {
      var clean = cleanText(value);
      var key = clean.toLowerCase();
      if (clean.length === 0 || seen[key]) {
        return;
      }
      seen[key] = true;
      result.push(clean);
    });
    return result;
  }

  function normalizeStringArray(values) {
    return dedupeTextStrings(Array.isArray(values) ? values : []).filter(function(value) {
      return value.length > 0;
    });
  }

  function pruneSeriesPageCache(pageCache, timeCache, limit) {
    var keys = Object.keys(pageCache || {});
    var resolvedLimit = toPositiveInteger(limit, SERIES_PAGE_CACHE_LIMIT);
    if (keys.length <= resolvedLimit) {
      return;
    }

    keys.sort(function(left, right) {
      return toNumber(timeCache && timeCache[left], 0) - toNumber(timeCache && timeCache[right], 0);
    });
    keys.slice(0, keys.length - resolvedLimit).forEach(function(key) {
      delete pageCache[key];
      if (timeCache) {
        delete timeCache[key];
      }
    });
  }

  function formatOptionLabel(value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return "";
    }

    if (clean === clean.toLowerCase() || clean === clean.toUpperCase()) {
      return clean.replace(/\b[a-z]/g, function(letter) {
        return letter.toUpperCase();
      });
    }

    return clean;
  }

  function normalizeGenreLabel(value) {
    var label = formatOptionLabel(value);
    var key = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (key.length === 0) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    return label;
  }

  function cleanText(value) {
    return decodeEntities(String(value || ""))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
      .replace(/&gt;/g, ">")
      .replace(/&ndash;/g, "-")
      .replace(/&mdash;/g, "-")
      .replace(/&hellip;/g, "...")
      .replace(/&ldquo;/g, "\"")
      .replace(/&rdquo;/g, "\"")
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'");
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

  function extractMatch(value, pattern, groupIndex) {
    var match = String(value || "").match(pattern);
    var index = groupIndex === 0 ? 0 : groupIndex || 1;
    return match && match[index] ? match[index] : "";
  }

  function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return isFinite(numeric) ? numeric : fallback;
  }

  function toPositiveInteger(value, fallback) {
    var numeric = parseInt(value, 10);
    return isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value);
    return clean.length > 0 ? clean : void 0;
  }

  // Exports

  var exportedSources = {
    MadaraScansInfo: MadaraScansInfo,
    MadaraScans: MadaraScans
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
