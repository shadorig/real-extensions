"use strict";

(function() {
  // Constants

  var DOMAIN = "https://elftoon.com";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_update";
  var SECTION_ID_POPULAR_SERIES = "popular_series";
  var STATE_POPULAR_SERIES_RANGE = "popular_series_range";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_ID_PREFIX = "locked::";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var POPULAR_SERIES_RANGE_WEEKLY = "weekly";
  var POPULAR_SERIES_RANGE_MONTHLY = "monthly";
  var POPULAR_SERIES_RANGE_ALLTIME = "alltime";
  var POPULAR_SERIES_RANGE_OPTIONS = [
    { id: POPULAR_SERIES_RANGE_WEEKLY, label: "Weekly" },
    { id: POPULAR_SERIES_RANGE_MONTHLY, label: "Monthly" },
    { id: POPULAR_SERIES_RANGE_ALLTIME, label: "All" }
  ];
  var DEFAULT_STATUS_OPTIONS = [
    { id: "ongoing", label: "Ongoing" },
    { id: "completed", label: "Completed" },
    { id: "hiatus", label: "Hiatus" }
  ];
  var DEFAULT_TYPE_OPTIONS = [
    { id: "manga", label: "Manga" },
    { id: "manhwa", label: "Manhwa" },
    { id: "manhua", label: "Manhua" },
    { id: "comic", label: "Comic" }
  ];
  var DEFAULT_ORDER_OPTIONS = [
    { id: "title", label: "A-Z" },
    { id: "titlereverse", label: "Z-A" },
    { id: "update", label: "Latest Update" },
    { id: "latest", label: "Newest" },
    { id: "popular", label: "Popular" }
  ];

  // Source Info

  var ElfToonInfo = {
    version: "1.0.0",
    name: "ElfToon",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function ElfToon() {
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
    this.cachedFilterLookups = null;
    this.cachedSeriesPages = {};
    this.cachedSeriesPageRequests = {};
  }

  // Paperback Interface Methods

  ElfToon.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  ElfToon.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  ElfToon.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/manga/" + encodePathSegment(seriesId) + "/";
  };

  ElfToon.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    var lockedSlug = extractLockedChapterSlug(chapterId);
    if (lockedSlug.length > 0) {
      return DOMAIN + "/" + encodePathSegment(lockedSlug) + "/";
    }
    return DOMAIN + "/" + encodePathSegment(chapterId) + "/";
  };

  ElfToon.prototype.getHomePageSections = async function(sectionCallback) {
    var results = await Promise.all([
      this.fetchText(buildHomePageUrl(1)),
      getPopularSeriesRange(this.stateManager)
    ]);
    var html = results[0];
    var popularSeriesRange = results[1];
    var latestSectionData = extractLatestSectionData(html);
    var homePreviewSubtitleMap = await this.getHomePreviewSubtitleMap(html, latestSectionData.subtitleMap);
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        parseFeaturedHomeItems(html, homePreviewSubtitleMap),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Popular Today",
        "singleRowLarge",
        parsePopularHomeItems(html, homePreviewSubtitleMap),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest Update",
        "singleRowNormal",
        latestSectionData.items,
        hasLatestSectionNextPage(html)
      ),
      createHomeSection(
        SECTION_ID_POPULAR_SERIES,
        "Popular Series",
        "singleRowNormal",
        parsePopularSeriesItems(html, popularSeriesRange),
        false
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  ElfToon.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    var page = Math.max(1, toNumber(metadata && metadata.page, 1));
    return this.getLatestSectionItems(page);
  };

  ElfToon.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
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
          App.createDUISelect({
            id: STATE_POPULAR_SERIES_RANGE,
            label: "Popular Series Period",
            options: POPULAR_SERIES_RANGE_OPTIONS.map(function(option) {
              return option.id;
            }),
            allowsMultiselect: false,
            labelResolver: async function(value) {
              return getPopularSeriesRangeLabel(value);
            },
            value: App.createDUIBinding({
              get: async function() {
                return getPopularSeriesRangeSelection(await getPopularSeriesRange(stateManager));
              },
              set: async function(newValue) {
                await stateManager.store(STATE_POPULAR_SERIES_RANGE, normalizePopularSeriesRange(newValue));
              }
            })
          }),
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
    return false;
  };

  ElfToon.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.getFilterData());
  };

  ElfToon.prototype.getMangaDetails = async function(seriesId) {
    var results = await Promise.all([
      this.getSeriesPageHtml(seriesId),
      this.getDetailTagLookups()
    ]);
    var html = results[0];
    var detailTagLookups = results[1];
    var title = cleanText(extractMatch(html, /<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i, 1));
    var alternativeTitles = cleanText(extractMatch(html, /<span class="alternative">([\s\S]*?)<\/span>/i, 1));
    var image = normalizeUrl(
      extractMatch(html, /<meta property="og:image" content="([^"]+)"/i, 1) ||
      extractMatch(html, /<div class="thumb"[\s\S]*?(?:data-src|src)="([^"]+)"/i, 1)
    );
    var description = cleanText(extractMatch(html, /<div class="entry-content entry-content-single"[^>]*>([\s\S]*?)<\/div>/i, 1));
    var author = emptyToUndefined(extractInfoField(html, "Author"));
    var artist = emptyToUndefined(extractInfoField(html, "Artist"));
    var rating = toNumber(
      extractMatch(html, /itemprop="ratingValue"[^>]*content="([^"]+)"/i, 1) ||
      extractMatch(html, /<div class="numscore">([\s\S]*?)<\/div>/i, 1),
      0
    );

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(title, alternativeTitles),
        image: image,
        desc: description,
        author: author,
        artist: artist,
        status: mapStatus(extractInfoField(html, "Status")),
        rating: rating,
        tags: buildDetailTagSections(html, detailTagLookups),
        hentai: false
      })
    });
  };

  ElfToon.prototype.getChapters = async function(seriesId) {
    var results = await Promise.all([
      this.getSeriesPageHtml(seriesId),
      getShowLockedChapters(this.stateManager)
    ]);
    var html = results[0];
    var showLockedChapters = results[1];
    var chapterListHtml = extractMatch(html, /<div class="eplister" id="chapterlist">[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i, 1);

    if (!chapterListHtml) {
      throw new Error("Unable to find the chapter list for " + seriesId + ".");
    }

    var chapters = [];
    var chapterRegex = /<li[^>]*data-num="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
    var match;

    while ((match = chapterRegex.exec(chapterListHtml)) !== null) {
      if (String(match[1] || "").indexOf("{{") !== -1) {
        continue;
      }

      var entryHtml = match[2];
      var chapterLabel = cleanText(extractMatch(entryHtml, /<span class="chapternum">\s*([\s\S]*?)\s*<\/span>/i, 1));
      var chapterNumber = extractChapterNumber(chapterLabel, match[1]);
      var chapterDate = parseDate(cleanText(extractMatch(entryHtml, /<span class="chapterdate">\s*([\s\S]*?)\s*<\/span>/i, 1)));
      var chapterUrl = normalizeUrl(extractMatch(entryHtml, /<a class="chapter-link-overlay" href="([^"]+)"/i, 1));
      var lockedMeta = extractLockedChapterMeta(entryHtml);
      var chapterId = "";
      var isLockedChapter = false;

      if (isReadableChapterUrl(chapterUrl)) {
        chapterId = extractLastPathComponent(chapterUrl);
      } else if (lockedMeta.locked && showLockedChapters) {
        chapterId = buildLockedChapterId(seriesId, chapterLabel, chapterNumber, lockedMeta);
        isLockedChapter = true;
      } else {
        continue;
      }

      if (!chapterId) {
        continue;
      }

      chapters.push(App.createChapter({
        id: chapterId,
        name: buildChapterListName(chapterLabel, chapterNumber, isLockedChapter),
        chapNum: chapterNumber,
        time: chapterDate,
        langCode: "en"
      }));
    }

    if (chapters.length === 0) {
      throw new Error("No chapters were found for " + seriesId + ".");
    }

    return chapters;
  };

  ElfToon.prototype.getChapterDetails = async function(seriesId, chapterId) {
    if (isLockedChapterId(chapterId)) {
      throw new Error("This chapter is locked on ElfToon and cannot be loaded in Paperback.");
    }

    var html = await this.fetchText(this.getChapterShareUrl(seriesId, chapterId));
    var readerPayload = extractReaderPayload(html);
    var sourceList = Array.isArray(readerPayload && readerPayload.sources) ? readerPayload.sources : [];
    var primarySource = sourceList.find(function(source) {
      return Array.isArray(source && source.images) && source.images.length > 0;
    });
    var pages = primarySource ? primarySource.images.map(function(page) {
      return normalizeReaderPageUrl(page);
    }).filter(function(page) {
      return page.length > 0;
    }) : [];

    if (readerPayload && readerPayload.protected === true) {
      throw new Error("This chapter is locked on ElfToon and cannot be loaded in Paperback.");
    }

    if (pages.length === 0) {
      throw new Error("ElfToon did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  ElfToon.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = Math.max(1, toNumber(metadata && metadata.page, 1));
    var filters = extractSearchFilters(query);

    if (title.length > 0) {
      // ElfToon exposes keyword search separately from the archive filter form.
      var searchHtml = await this.fetchText(buildSearchUrl(title, page));
      return createPagedResultsFromHtml(searchHtml, page);
    }

    return this.getArchiveResults(filters, page);
  };

  // Source-Specific Fetch Helpers

  ElfToon.prototype.getArchiveResults = async function(filters, page) {
    var html = await this.fetchText(buildArchiveUrl(page, filters));
    // The live server-rendered archive exposes paged URLs, but the fetched HTML
    // currently repeats page 1 content across those routes. Avoid fake pagination.
    return App.createPagedResults({
      results: parseCardResults(html)
    });
  };

  ElfToon.prototype.getLatestSectionItems = async function(page, html) {
    var resolvedPage = Math.max(1, toNumber(page, 1));
    var sectionHtml = typeof html === "string" ? html : await this.fetchText(buildHomePageUrl(resolvedPage));
    var latestSectionData = extractLatestSectionData(sectionHtml);
    return App.createPagedResults({
      results: latestSectionData.items,
      metadata: hasLatestSectionNextPage(sectionHtml) ? { page: resolvedPage + 1 } : void 0
    });
  };

  ElfToon.prototype.getHomePreviewSubtitleMap = async function(html, initialSubtitleMap) {
    var subtitleMap = Object.assign({}, initialSubtitleMap || {});
    var seen = {};
    var missingSeriesIds = [];

    collectPartialSeriesIds(parseFeaturedHomeItems(html).concat(parsePopularHomeItems(html))).forEach(function(seriesId) {
      if (subtitleMap[seriesId] || seen[seriesId]) {
        return;
      }

      seen[seriesId] = true;
      missingSeriesIds.push(seriesId);
    });

    if (missingSeriesIds.length === 0) {
      return subtitleMap;
    }

    var previewResults = await Promise.allSettled(missingSeriesIds.map(function(seriesId) {
      return this.getSeriesPageHtml(seriesId).then(function(seriesHtml) {
        return {
          id: seriesId,
          subtitle: extractSeriesPagePreviewSubtitle(seriesHtml)
        };
      });
    }.bind(this)));

    previewResults.forEach(function(result) {
      if (!result || result.status !== "fulfilled") {
        return;
      }

      var entry = result.value;
      if (entry && entry.id && entry.subtitle) {
        subtitleMap[entry.id] = entry.subtitle;
      }
    });

    return subtitleMap;
  };

  ElfToon.prototype.fetchFilterData = async function() {
    var html = await this.fetchText(DOMAIN + "/manga/");
    return {
      genres: extractGenreFilterOptions(html),
      statuses: extractNamedFilterOptions(html, "status", DEFAULT_STATUS_OPTIONS),
      types: extractNamedFilterOptions(html, "type", DEFAULT_TYPE_OPTIONS),
      orders: extractNamedFilterOptions(html, "order", DEFAULT_ORDER_OPTIONS)
    };
  };

  ElfToon.prototype.getFilterData = async function() {
    if (!this.cachedFilterData) {
      this.cachedFilterData = await this.fetchFilterData();
    }

    return this.cachedFilterData;
  };

  ElfToon.prototype.getDetailTagLookups = async function() {
    if (!this.cachedFilterLookups) {
      this.cachedFilterLookups = buildDetailTagLookups(await this.getFilterData());
    }

    return this.cachedFilterLookups;
  };

  ElfToon.prototype.getSeriesPageHtml = async function(seriesId) {
    var cacheKey = String(seriesId || "");

    if (typeof this.cachedSeriesPages[cacheKey] === "string") {
      return this.cachedSeriesPages[cacheKey];
    }

    if (!this.cachedSeriesPageRequests[cacheKey]) {
      this.cachedSeriesPageRequests[cacheKey] = this.fetchText(this.getMangaShareUrl(cacheKey)).then(function(html) {
        this.cachedSeriesPages[cacheKey] = html;
        delete this.cachedSeriesPageRequests[cacheKey];
        return html;
      }.bind(this)).catch(function(error) {
        delete this.cachedSeriesPageRequests[cacheKey];
        throw error;
      }.bind(this));
    }

    return this.cachedSeriesPageRequests[cacheKey];
  };

  ElfToon.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);
    return parseTextResponse(response, url);
  };

  // URL / Response Helpers

  function buildSearchUrl(title, page) {
    if (page > 1) {
      return DOMAIN + "/page/" + page + "/?s=" + encodeURIComponent(title);
    }
    return DOMAIN + "/?s=" + encodeURIComponent(title);
  }

  function buildHomePageUrl(page) {
    return page > 1 ? DOMAIN + "/page/" + page + "/" : DOMAIN + "/";
  }

  function buildArchiveUrl(page, filters) {
    var baseUrl = page > 1 ? DOMAIN + "/manga/page/" + page + "/" : DOMAIN + "/manga/";
    var params = [];
    var normalizedFilters = filters || {};
    var genres = Array.isArray(normalizedFilters.genres) ? normalizedFilters.genres : [];

    genres.forEach(function(genreId) {
      if (String(genreId || "").length > 0) {
        params.push("genre[]=" + encodeURIComponent(String(genreId)));
      }
    });

    if (normalizedFilters.status) {
      params.push("status=" + encodeURIComponent(String(normalizedFilters.status)));
    }
    if (normalizedFilters.type) {
      params.push("type=" + encodeURIComponent(String(normalizedFilters.type)));
    }
    if (normalizedFilters.order) {
      params.push("order=" + encodeURIComponent(String(normalizedFilters.order)));
    }

    return params.length > 0 ? baseUrl + "?" + params.join("&") : baseUrl;
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("ElfToon returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }
    if (response.status === 404) {
      throw new Error("The requested ElfToon page was not found.");
    }
    if (response.status >= 400) {
      throw new Error("ElfToon returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
    return lower.includes("just a moment") && lower.includes("cloudflare");
  }

  function formatRequestLabel(url) {
    var value = String(url || "");
    if (value.indexOf(DOMAIN) === 0) {
      return value.slice(DOMAIN.length) || "/";
    }
    return value.length > 0 ? value : "unknown endpoint";
  }

  // Series / Card Helpers

  function createPartialSeries(series) {
    return App.createPartialSourceManga({
      mangaId: String(series && series.id || ""),
      title: cleanText(series && series.title || ""),
      image: normalizeUrl(series && series.image || ""),
      subtitle: emptyToUndefined(series && series.subtitle)
    });
  }

  function createPagedResultsFromHtml(html, page) {
    return App.createPagedResults({
      results: parseCardResults(html),
      metadata: hasNextPage(html) ? { page: page + 1 } : void 0
    });
  }

  function parseCardResults(html, subtitleOverrides) {
    var results = [];
    var seen = {};
    var cardRegex = /<div class="bsx">\s*<a href="([^"]+)" title="([^"]*)">([\s\S]*?)<\/a>\s*<\/div>/gi;
    var match;

    while ((match = cardRegex.exec(String(html || ""))) !== null) {
      var url = normalizeUrl(match[1]);
      var seriesId = extractSeriesId(url);
      if (!seriesId || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      var innerHtml = match[3];
      var image = extractFirstImageUrl(innerHtml);
      var title = cleanText(match[2]) || cleanText(extractMatch(innerHtml, /<div class="tt">\s*([\s\S]*?)\s*<\/div>/i, 1));
      var subtitle = buildChapterSubtitle(
        extractMatch(innerHtml, /<div class="epxs">\s*([\s\S]*?)\s*<\/div>/i, 1),
        subtitleOverrides && subtitleOverrides[seriesId]
      );

      results.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: image,
        subtitle: subtitle
      }));
    }

    return results;
  }

  function hasNextPage(html) {
    var value = String(html || "");
    return /<link rel="next" href="/i.test(value) || /class="next page-numbers"/i.test(value);
  }

  // Homepage Helpers

  function createHomeSection(id, title, type, items, containsMoreItems) {
    return App.createHomeSection({
      id: id,
      title: title,
      containsMoreItems: containsMoreItems,
      type: type,
      items: items
    });
  }

  function parseFeaturedHomeItems(html, subtitleOverrides) {
    var items = [];
    var seen = {};
    var regex = /<div class="swiper-slide">([\s\S]*?)<div class="lazyload bigbanner[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[1];
      var url = normalizeUrl(extractMatch(block, /<a href="(https?:\/\/[^"]*\/manga\/[^"]+)"/i, 1));
      var seriesId = extractSeriesId(url);

      if (!seriesId || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(extractMatch(block, /<span class="name">([\s\S]*?)<\/span>/i, 1)),
        image: normalizeUrl(extractMatch(block, /<img[^>]+src="([^"]+)"[^>]+class="attachment-full/i, 1)),
        subtitle: buildChapterSubtitle(
          extractMatch(block, /<div class="slidlc">([\s\S]*?)<\/div>/i, 1),
          subtitleOverrides && subtitleOverrides[seriesId]
        )
      }));
    }

    return items;
  }

  function parsePopularHomeItems(html, subtitleOverrides) {
    var popularHtml = sliceBetween(html, /<h2>\s*Popular Today\s*<\/h2>/i, /<h2>\s*Latest Update\s*<\/h2>/i);
    return parseCardResults(popularHtml, subtitleOverrides);
  }

  function parsePopularSeriesItems(html, range) {
    var listHtml = extractPopularSeriesListHtml(html, range);
    var items = [];
    var seen = {};
    var regex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    var match;

    while ((match = regex.exec(listHtml)) !== null) {
      var block = match[1];
      var url = normalizeUrl(extractMatch(block, /<a class="series" href="([^"]+)"/i, 1));
      var seriesId = extractSeriesId(url);

      if (!seriesId || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(extractMatch(block, /<h2>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i, 1)),
        image: extractFirstImageUrl(block),
        subtitle: buildPopularSeriesSubtitle(block)
      }));
    }

    return items;
  }

  function extractPopularSeriesListHtml(html, range) {
    return extractMatch(
      html,
      new RegExp("<div class=['\"][^'\"]*\\bserieslist\\b[^'\"]*\\bpop\\b[^'\"]*\\bwpop\\b[^'\"]*\\bwpop-" + escapeRegex(normalizePopularSeriesRange(range)) + "\\b[^'\"]*['\"]>\\s*<ul>([\\s\\S]*?)<\\/ul>\\s*<\\/div>", "i"),
      1
    );
  }

  function buildPopularSeriesSubtitle(block) {
    var parts = [];
    var ratingLabel = formatRatingLabel(extractMatch(block, /<div class="numscore">\s*([\s\S]*?)\s*<\/div>/i, 1));
    var genres = extractGenreLabels(
      extractMatch(block, /<span>\s*<b>\s*Genres\s*<\/b>\s*:\s*([\s\S]*?)<\/span>/i, 1),
      3
    );

    if (ratingLabel.length > 0) {
      parts.push(ratingLabel);
    }

    return parts.concat(genres).join(" · ");
  }

  function extractLatestSectionData(html) {
    var latestHtml = extractLatestHomeSectionHtml(html);
    var items = [];
    var subtitleMap = {};
    var seen = {};
    var regex = /<div class="utao styletwo">([\s\S]*?)(?=<div class="utao styletwo">|$)/gi;
    var match;

    while ((match = regex.exec(latestHtml)) !== null) {
      var block = match[1];
      var url = normalizeUrl(extractMatch(block, /class="series"\s*href="([^"]+)"/i, 1));
      var seriesId = extractSeriesId(url);

      if (!seriesId || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      var subtitle = buildLatestHomeItemSubtitle(block);
      if (subtitle.length > 0) {
        subtitleMap[seriesId] = subtitle;
      }

      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(extractMatch(block, /<h4>([\s\S]*?)<\/h4>/i, 1)),
        image: extractFirstImageUrl(block),
        subtitle: subtitle
      }));
    }

    return {
      items: items,
      subtitleMap: subtitleMap
    };
  }

  function extractLatestHomeSectionHtml(html) {
    var latestHtml = sliceBetween(html, /<h2>\s*Latest Update\s*<\/h2>/i, /<div class="hpage">/i);
    if (latestHtml.length === 0) {
      latestHtml = sliceBetween(html, /<h2>\s*Latest Update\s*<\/h2>/i, /<div id="sidebar">/i);
    }
    return latestHtml;
  }

  function buildLatestHomeItemSubtitle(block) {
    var entries = extractLatestHomeChapterEntries(block);
    if (entries.length === 0) {
      return "";
    }

    return formatChapterSubtitle(entries[0].label, entries[0].locked);
  }

  function extractLatestHomeChapterEntries(block) {
    var entries = [];
    var listHtml = extractMatch(block, /<ul[^>]*>([\s\S]*?)<\/ul>/i, 1);
    var regex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    var match;

    while ((match = regex.exec(listHtml)) !== null) {
      var entryHtml = match[1];
      var label = normalizeChapterSubtitle(extractMatch(entryHtml, /<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i, 1));

      if (label.length === 0) {
        continue;
      }

      entries.push({
        label: label,
        locked: extractLockedChapterMeta(entryHtml).locked
      });
    }

    return entries;
  }

  function hasLatestSectionNextPage(html) {
    return /<div class="hpage">[\s\S]*class="r"/i.test(String(html || ""));
  }

  async function getPopularSeriesRange(stateManager) {
    return normalizePopularSeriesRange(await stateManager.retrieve(STATE_POPULAR_SERIES_RANGE));
  }

  function normalizePopularSeriesRange(value) {
    var rawValue = Array.isArray(value) ? value[0] : value;
    var range = cleanText(rawValue || "").toLowerCase();

    if (range === POPULAR_SERIES_RANGE_MONTHLY) {
      return POPULAR_SERIES_RANGE_MONTHLY;
    }
    if (range === POPULAR_SERIES_RANGE_ALLTIME) {
      return POPULAR_SERIES_RANGE_ALLTIME;
    }
    return POPULAR_SERIES_RANGE_WEEKLY;
  }

  function getPopularSeriesRangeSelection(value) {
    return [normalizePopularSeriesRange(value)];
  }

  function getPopularSeriesRangeLabel(value) {
    var normalizedRange = normalizePopularSeriesRange(value);
    for (var index = 0; index < POPULAR_SERIES_RANGE_OPTIONS.length; index += 1) {
      if (POPULAR_SERIES_RANGE_OPTIONS[index].id === normalizedRange) {
        return POPULAR_SERIES_RANGE_OPTIONS[index].label;
      }
    }

    return POPULAR_SERIES_RANGE_OPTIONS[0].label;
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var statuses = normalizeFilterOptions((filterData && filterData.statuses) || DEFAULT_STATUS_OPTIONS);
    var types = normalizeFilterOptions((filterData && filterData.types) || DEFAULT_TYPE_OPTIONS);
    var orders = normalizeFilterOptions((filterData && filterData.orders) || DEFAULT_ORDER_OPTIONS);

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

    if (types.length > 0) {
      sections.push(App.createTagSection({
        id: "type",
        label: "Type",
        tags: types.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_TYPE + option.id,
            label: option.label
          });
        })
      }));
    }

    if (orders.length > 0) {
      sections.push(App.createTagSection({
        id: "order",
        label: "Order",
        tags: orders.map(function(option) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_ORDER + option.id,
            label: option.label
          });
        })
      }));
    }

    return sections;
  }

  function extractSearchFilters(query) {
    var filters = {
      genres: [],
      status: void 0,
      type: void 0,
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
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0 && filters.status === void 0) {
        filters.status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0 && filters.type === void 0) {
        filters.type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_ORDER) === 0 && filters.order === void 0) {
        filters.order = tagId.slice(SEARCH_TAG_PREFIX_ORDER.length);
      }
    });

    return filters;
  }

  function extractGenreFilterOptions(html) {
    var options = [];
    var seen = {};
    var regex = /<input class="genre-item[^"]*" type="checkbox" id="genre-[^"]+" name="genre\[\]" value="([^"]+)">\s*<label[^>]*>([\s\S]*?)<\/label>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var id = cleanText(match[1]);
      var label = cleanText(match[2]);
      var key = label.toLowerCase();
      if (id.length === 0 || label.length === 0 || isBrokenGenreFilterOption(id, label) || seen[key]) {
        continue;
      }

      seen[key] = true;
      options.push({
        id: id,
        label: label
      });
    }

    return options.sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  function extractNamedFilterOptions(html, fieldName, fallbackOptions) {
    var options = [];
    var seen = {};
    var regex = new RegExp(
      '<input[^>]+name="' + escapeRegex(fieldName) + '"[^>]+value="([^"]*)"[^>]*>\\s*<label[^>]*>([\\s\\S]*?)<\\/label>',
      "gi"
    );
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var id = cleanText(match[1]);
      var label = cleanText(match[2]);
      var normalizedOption = normalizeNamedFilterOption(fieldName, id, label);
      if (!normalizedOption) {
        continue;
      }
      id = normalizedOption.id;
      label = normalizedOption.label;
      var key = label.toLowerCase();

      if (id.length === 0 || label.length === 0 || label === "All" || label === "Default" || seen[key]) {
        continue;
      }

      seen[key] = true;
      options.push({
        id: id,
        label: label
      });
    }

    if (options.length > 0) {
      return options;
    }

    return Array.isArray(fallbackOptions) ? fallbackOptions.slice() : [];
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
    });
  }

  function isBrokenGenreFilterOption(id, label) {
    return cleanText(id) === "134" && cleanText(label).toLowerCase() === "ac";
  }

  function normalizeNamedFilterOption(fieldName, id, label) {
    var cleanId = cleanText(id);
    var cleanLabel = cleanText(label);

    if (fieldName === "type" && cleanId.toLowerCase() === "novel") {
      return null;
    }

    if (fieldName === "order") {
      if (cleanId === "update") {
        cleanLabel = "Latest Update";
      } else if (cleanId === "latest") {
        cleanLabel = "Newest";
      }
    }

    return {
      id: cleanId,
      label: cleanLabel
    };
  }

  // Detail Helpers

  function buildDetailTagSections(html, detailTagLookups) {
    var sections = [];
    var lookupData = detailTagLookups || {};
    var genreLookup = lookupData.genres || {};
    var statusLookup = lookupData.statuses || {};
    var typeLookup = lookupData.types || {};
    var genres = extractGenreTags(html, genreLookup);
    var metadataTags = extractSearchableMetadataTags(html, statusLookup, typeLookup);

    if (genres.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genres
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

  function buildDetailTagLookups(filterData) {
    return {
      genres: buildSearchableTagLookup(filterData && filterData.genres, SEARCH_TAG_PREFIX_GENRE),
      statuses: buildSearchableTagLookup(filterData && filterData.statuses, SEARCH_TAG_PREFIX_STATUS),
      types: buildSearchableTagLookup(filterData && filterData.types, SEARCH_TAG_PREFIX_TYPE)
    };
  }

  function extractGenreTags(html, genreLookup) {
    var genreBlock = extractMatch(html, /<span class="mgen">([\s\S]*?)<\/span>/i, 1);
    var tags = [];
    var seen = {};
    var genreRegex = /<a[^>]+href="([^"]*\/genres\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = genreRegex.exec(genreBlock)) !== null) {
      var tagId = extractLastPathComponent(normalizeUrl(match[1]));
      var label = cleanText(match[2]);
      var resolvedTag = resolveSearchableDetailTag(tagId, label, genreLookup, SEARCH_TAG_PREFIX_GENRE);
      var key = label.toLowerCase();
      if (!resolvedTag || label.length === 0 || seen[key]) {
        continue;
      }

      seen[key] = true;
      tags.push(App.createTag(resolvedTag));
    }

    return tags;
  }

  function extractSearchableMetadataTags(html, statusLookup, typeLookup) {
    var metadataEntries = [
      {
        label: "Status",
        value: extractInfoField(html, "Status"),
        lookup: statusLookup,
        prefix: SEARCH_TAG_PREFIX_STATUS
      },
      {
        label: "Type",
        value: extractInfoField(html, "Type"),
        lookup: typeLookup,
        prefix: SEARCH_TAG_PREFIX_TYPE
      }
    ];

    return metadataEntries.map(function(entry) {
      var value = cleanText(entry.value);
      var resolvedTag = resolveSearchableDetailTag("", value, entry.lookup, entry.prefix);

      if (!resolvedTag) {
        return null;
      }

      return App.createTag({
        id: resolvedTag.id,
        label: entry.label + ": " + value
      });
    }).filter(Boolean);
  }

  function buildSearchableTagLookup(options, prefix) {
    var lookup = {};

    normalizeFilterOptions(options).forEach(function(option) {
      var tag = {
        id: prefix + option.id,
        label: option.label
      };

      buildSearchableLookupKeys(option.id, option.label).forEach(function(key) {
        if (!lookup[key]) {
          lookup[key] = tag;
        }
      });
    });

    return lookup;
  }

  function buildSearchableLookupKeys(id, label) {
    var keys = {};
    var cleanId = cleanText(id || "").toLowerCase();
    var cleanLabel = cleanText(label || "").toLowerCase();

    if (cleanId.length > 0) {
      keys[cleanId] = true;
    }
    if (cleanLabel.length > 0) {
      keys[cleanLabel] = true;
      keys[slugify(cleanLabel)] = true;
    }

    return Object.keys(keys);
  }

  function resolveSearchableDetailTag(rawId, rawLabel, lookup, prefix) {
    var normalizedId = cleanText(rawId || "").toLowerCase();
    var normalizedLabel = cleanText(rawLabel || "");
    var keys = buildSearchableLookupKeys(normalizedId, normalizedLabel);
    var lookupTable = lookup || {};

    for (var index = 0; index < keys.length; index += 1) {
      if (lookupTable[keys[index]]) {
        return lookupTable[keys[index]];
      }
    }

    return null;
  }

  function extractInfoField(html, label) {
    var fieldPattern = new RegExp(
      '<div class="imptdt">\\s*' + escapeRegex(label) + '\\s*<(?:i|a)[^>]*>([\\s\\S]*?)<\\/(?:i|a)>',
      "i"
    );
    return cleanText(extractMatch(html, fieldPattern, 1));
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
    return cleanText(value).split(/\s*[•;\n\r]+\s*/).map(function(title) {
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

  // Chapter Helpers

  function extractReaderPayload(html) {
    var payloadText = extractMatch(html, /ts_reader\.run\((\{[\s\S]*?\})\);/i, 1);
    if (!payloadText) {
      if (isLockedChapterPage(html)) {
        throw new Error("This chapter is locked on ElfToon and cannot be loaded in Paperback.");
      }
      throw new Error("Unable to find the reader payload on the chapter page.");
    }

    try {
      return JSON.parse(payloadText);
    } catch (error) {
      throw new Error("Unable to decode the reader payload for this chapter.");
    }
  }

  function buildChapterSubtitle(rawSubtitle, overrideSubtitle) {
    var override = cleanText(overrideSubtitle);
    if (override.length > 0) {
      return override;
    }

    return normalizeChapterSubtitle(rawSubtitle);
  }

  function formatChapterSubtitle(label, locked) {
    var normalized = normalizeChapterSubtitle(label);
    if (normalized.length === 0) {
      return "";
    }
    return buildChapterListName(normalized, 0, locked);
  }

  function normalizeChapterSubtitle(value) {
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

  function extractSeriesPagePreviewSubtitle(html) {
    var chapterListHtml = extractMatch(html, /<div class="eplister" id="chapterlist">[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i, 1);
    var entryHtml = extractMatch(chapterListHtml, /<li[^>]*data-num="[^"]*"[^>]*>([\s\S]*?)<\/li>/i, 1);
    var chapterLabel = cleanText(extractMatch(entryHtml, /<span class="chapternum">\s*([\s\S]*?)\s*<\/span>/i, 1));

    if (chapterLabel.length === 0) {
      return "";
    }

    return formatChapterSubtitle(chapterLabel, extractLockedChapterMeta(entryHtml).locked);
  }

  function isLockedChapterEntryHtml(html) {
    var value = String(html || "");
    return /data-bs-target="#lockedChapterModal"/i.test(value) ||
      /fa-lock/i.test(value);
  }

  function extractLockedChapterMeta(entryHtml) {
    return {
      locked: isLockedChapterEntryHtml(entryHtml),
      postId: cleanText(extractMatch(entryHtml, /data-id="([^"]+)"/i, 1))
    };
  }

  function buildLockedChapterId(seriesId, chapterLabel, chapterNumber, lockedMeta) {
    var slug = buildLockedChapterSlug(seriesId, chapterLabel, chapterNumber);
    if (slug.length === 0) {
      slug = String(seriesId || "") + "-locked-" + slugify(lockedMeta && (lockedMeta.postId || chapterLabel || chapterNumber || "chapter"));
    }
    var postId = cleanText(lockedMeta && lockedMeta.postId);
    return LOCKED_CHAPTER_ID_PREFIX + slug + (postId.length > 0 ? "::" + postId : "");
  }

  function buildLockedChapterSlug(seriesId, chapterLabel, chapterNumber) {
    var normalizedNumber = formatChapterNumberForSlug(chapterNumber);
    if (normalizedNumber.length === 0) {
      normalizedNumber = formatChapterNumberForSlug(extractChapterNumber(chapterLabel, ""));
    }
    if (normalizedNumber.length === 0) {
      return "";
    }
    return String(seriesId || "").trim() + "-chapter-" + normalizedNumber;
  }

  function formatChapterNumberForSlug(value) {
    var numeric = String(value || "").trim();
    if (numeric.length === 0) {
      return "";
    }
    return numeric.replace(/\.0+$/, "").replace(/\./g, "-");
  }

  function buildChapterName(number) {
    return number > 0 ? "Chapter " + number : "Chapter";
  }

  function buildReadableChapterLabel(chapterLabel, chapterNumber) {
    var normalizedLabel = normalizeChapterSubtitle(chapterLabel);
    return normalizedLabel.length > 0 ? normalizedLabel : buildChapterName(chapterNumber);
  }

  function buildLockedChapterLabel(chapterLabel, chapterNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapterLabel, chapterNumber);
  }

  function buildChapterListName(chapterLabel, chapterNumber, isLockedChapter) {
    return isLockedChapter ? buildLockedChapterLabel(chapterLabel, chapterNumber) : buildReadableChapterLabel(chapterLabel, chapterNumber);
  }

  function isLockedChapterId(chapterId) {
    return String(chapterId || "").indexOf(LOCKED_CHAPTER_ID_PREFIX) === 0;
  }

  function extractLockedChapterSlug(chapterId) {
    if (!isLockedChapterId(chapterId)) {
      return "";
    }
    var parts = String(chapterId || "").split("::");
    return parts.length > 1 ? parts[1] : "";
  }

  async function getShowLockedChapters(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS)) === true;
  }

  function isLockedChapterPage(html) {
    return /This chapter is locked/i.test(String(html || ""));
  }

  // Generic Utilities

  function collectPartialSeriesIds(items) {
    var ids = [];

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var seriesId = cleanText(item && item.mangaId);
      if (seriesId.length > 0) {
        ids.push(seriesId);
      }
    });

    return ids;
  }

  function extractFirstImageUrl(html) {
    return normalizeUrl(
      extractMatch(html, /data-src="([^"]+)"/i, 1) ||
      extractMatch(html, /<img[^>]+src="([^"]+)"/i, 1)
    );
  }

  function extractSeriesId(url) {
    var value = String(url || "");
    var seriesMatch = value.match(/\/manga\/([^/?#]+)\/?$/i);
    return seriesMatch ? seriesMatch[1] : "";
  }

  function extractLastPathComponent(url) {
    var value = String(url || "").split(/[?#]/)[0].replace(/\/+$/, "");
    var slashIndex = value.lastIndexOf("/");
    return slashIndex >= 0 ? value.slice(slashIndex + 1) : value;
  }

  function isReadableChapterUrl(url) {
    return typeof url === "string" && url.length > 0 && url !== "#" && /^https?:\/\//i.test(url);
  }

  function extractChapterNumber(label, fallback) {
    var value = String(label || fallback || "");
    var match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? toNumber(match[1], 0) : 0;
  }

  function encodePathSegment(value) {
    var segment = String(value || "").trim();
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
      return url;
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

  function normalizeReaderPageUrl(value) {
    var url = normalizeUrl(value);
    // Older reader payloads still expose elftoon.xyz asset URLs, which redirect
    // to the current elftoon.com host before the image can start loading.
    if (/^https?:\/\/(?:www\.)?elftoon\.xyz(?=\/)/i.test(url)) {
      return url.replace(/^https?:\/\/(?:www\.)?elftoon\.xyz(?=\/)/i, DOMAIN);
    }
    return url;
  }

  function parseDate(value) {
    var date = new Date(cleanText(value));
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

  function slugify(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function cleanText(value) {
    return decodeEntities(String(value || ""))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractGenreLabels(html, limit) {
    var labels = [];
    var seen = {};
    var max = Math.max(0, toNumber(limit, 0));
    var regex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var label = cleanText(match[1]);
      var key = label.toLowerCase();

      if (label.length === 0 || seen[key]) {
        continue;
      }

      seen[key] = true;
      labels.push(label);

      if (max > 0 && labels.length >= max) {
        break;
      }
    }

    return labels;
  }

  function formatRatingLabel(value) {
    var rating = toNumber(cleanText(value), NaN);
    if (!isFinite(rating) || rating <= 0) {
      return "";
    }

    return "★ " + String(Math.round(rating * 100) / 100);
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
      .replace(/&middot;/g, "·")
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—")
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
    return match && match[groupIndex || 1] ? match[groupIndex || 1] : "";
  }

  function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return isFinite(numeric) ? numeric : fallback;
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value);
    return clean.length > 0 ? clean : void 0;
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
