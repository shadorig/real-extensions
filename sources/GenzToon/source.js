"use strict";

(function() {
  // Constants

  var DOMAIN = "https://genztoons.org";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var SEARCH_PER_PAGE = 24;
  var HOME_LATEST_PER_PAGE = 24;
  var BROWSE_CACHE_MS = 5 * 60 * 1000;
  var LATEST_CACHE_MS = 2 * 60 * 1000;
  var SERIES_PAGE_CACHE_MS = 60 * 1000;
  var SERIES_PAGE_CACHE_LIMIT = 24;
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_PINNED = "pinned_series";
  var SECTION_ID_DISCOUNTED = "bulk_discounted_series";
  var SECTION_ID_LATEST = "latest_updates";
  var SECTION_ID_TRENDING = "trending";
  var SECTION_ID_RECENT = "recently_added";
  var SECTION_ID_EDITOR_CHOICE = "editors_choice";
  var SECTION_ID_BLACK_WHITE_SERIES = "black_white_series";
  var SECTION_ID_COMPLETED = "completed_series";
  var LATEST_UPDATES_VIEW_ALL = "all";
  var LATEST_UPDATES_VIEW_FREE = "free";
  var LATEST_UPDATES_VIEW_ACTION = "action";
  var LATEST_UPDATES_VIEW_ROMANCE = "romance";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var STATE_LATEST_UPDATES_VIEW = "latest_updates_view";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var CHAPTER_ACCESS_READABLE = "readable";
  var CHAPTER_ACCESS_LOCKED = "locked";
  var CHAPTER_ACCESS_UNKNOWN = "unknown";
  var LATEST_UPDATES_VIEW_OPTIONS = [
    { id: LATEST_UPDATES_VIEW_ALL, label: "All Series" },
    { id: LATEST_UPDATES_VIEW_FREE, label: "Free Series" },
    { id: LATEST_UPDATES_VIEW_ACTION, label: "Action" },
    { id: LATEST_UPDATES_VIEW_ROMANCE, label: "Romance" }
  ];
  var DEFAULT_STATUS_OPTIONS = [
    { id: "completed", label: "Completed" },
    { id: "dropped", label: "Dropped" },
    { id: "hiatus", label: "Hiatus" },
    { id: "ongoing", label: "Ongoing" }
  ];
  var DEFAULT_TYPE_OPTIONS = [
    { id: "comic", label: "Comic" },
    { id: "manga", label: "Manga" },
    { id: "mangatoon", label: "Mangatoon" },
    { id: "manhua", label: "Manhua" },
    { id: "manhwa", label: "Manhwa" }
  ];
  var GENRE_ID_OVERRIDES = {
    "deliquents": "delinquents",
    "showbizz": "showbiz"
  };
  var GENRE_LABEL_OVERRIDES = {
    "deliquents": "Delinquents",
    "genius mc": "Genius MC",
    "showbizz": "Showbiz",
    "slice of life": "Slice of Life",
    "weak to strong": "Weak to Strong"
  };
  var INVALID_GENRE_LABELS = {
    "\uac80\uc740\uba38\ub9ac \ubbf8\uad70 \ub300\uc6d0\uc218": true,
    "\uc2e0\uc785\uc0ac\uc6d0\uc774 \uc774\ub807\uac8c \uc77c\uc744 \uc798\ud588\ub2e4\uace0?": true
  };

  // Source Info

  var GenzToonInfo = {
    version: "1.1.0",
    name: "GenzToon",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function GenzToon() {
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
    this.cachedBrowseSeries = null;
    this.cachedBrowseSeriesExpiresAt = 0;
    this.cachedBrowseSeriesRequest = null;
    this.cachedSeriesPages = {};
    this.cachedSeriesPageOrder = [];
    this.cachedSeriesPageRequests = {};
    this.cachedLatestPosterItems = {};
    this.cachedLatestPosterItemsExpiresAt = {};
    this.cachedLatestPosterItemRequests = {};
    this.homeLatestInitialIds = {};
    this.homeLatestRenderedView = "";
    this.seriesSlugById = {};
  }

  // Paperback Interface Methods

  GenzToon.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  GenzToon.prototype.getTags = async function() {
    return this.getSearchTags();
  };

  GenzToon.prototype.getMangaShareUrl = function(seriesId) {
    var stableId = cleanText(seriesId || "");
    var slug = cleanText(this.seriesSlugById[stableId] || "");
    return DOMAIN + "/series/" + encodePathSegment(slug || stableId) + "/";
  };

  GenzToon.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return DOMAIN + "/chapter/" + encodePathSegment(chapterId) + "/";
  };

  GenzToon.prototype.getHomePageSections = async function(sectionCallback) {
    var latestUpdatesView = await getLatestUpdatesView(this.stateManager);
    var results = await Promise.all([
      this.fetchText(DOMAIN + "/"),
      latestUpdatesView === LATEST_UPDATES_VIEW_ALL ? Promise.resolve(null) : this.getLatestSectionItems(1, latestUpdatesView)
    ]);
    var html = results[0];
    var latestResults = results[1];
    var homepageSeriesIdLookup = buildHomepageSeriesIdLookup(html);
    cacheSeriesSlugMappingsFromLookup(this.seriesSlugById, homepageSeriesIdLookup);
    var latestSectionHtml = extractHomeSectionHtml(html, "Latest Updates");
    var latestItems;
    var latestContainsMoreItems;

    if (latestResults) {
      latestItems = latestResults.results;
      latestContainsMoreItems = latestResults.metadata !== void 0;
    } else {
      latestItems = parseLatestPosterItemsChecked(latestSectionHtml);
      latestContainsMoreItems = hasLatestViewMoreLink(latestSectionHtml);
    }

    this.homeLatestInitialIds[latestUpdatesView] = extractPartialSeriesIds(latestItems);
    this.homeLatestRenderedView = latestUpdatesView;
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        parseFeaturedHomeItems(html),
        false
      ),
      createHomeSection(
        SECTION_ID_PINNED,
        "Pinned Series",
        "singleRowLarge",
        parseLatestPosterItemsChecked(extractHomeSectionHtml(html, "Pinned Series")),
        false
      ),
      createHomeSection(
        SECTION_ID_DISCOUNTED,
        "Bulk Discounted Series",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Bulk Discounted Series"))),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        buildLatestUpdatesSectionTitle(latestUpdatesView),
        "singleRowNormal",
        latestItems,
        latestContainsMoreItems
      ),
      createHomeSection(
        SECTION_ID_TRENDING,
        "Trending",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Trending"))),
        false
      ),
      createHomeSection(
        SECTION_ID_RECENT,
        "Recently Added",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Recently Added"))),
        false
      ),
      createHomeSection(
        SECTION_ID_EDITOR_CHOICE,
        "Editor's Choice",
        "singleRowLarge",
        parseEditorChoiceItems(html),
        false
      ),
      createHomeSection(
        SECTION_ID_BLACK_WHITE_SERIES,
        "Manga - Black & White",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Manga - Black & White"))),
        false
      ),
      createHomeSection(
        SECTION_ID_COMPLETED,
        "Completed Series",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Completed Series"))),
        false
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  GenzToon.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    var metadataView = cleanText(metadata && metadata.view || "");
    var renderedView = cleanText(this.homeLatestRenderedView || "");
    var view = metadataView.length > 0 ? normalizeLatestUpdatesView(metadataView) :
      renderedView.length > 0 ? normalizeLatestUpdatesView(renderedView) :
      await getLatestUpdatesView(this.stateManager);
    var seenIds = Array.isArray(metadata && metadata.seenIds) ? metadata.seenIds.slice() :
      Array.isArray(this.homeLatestInitialIds[view]) ? this.homeLatestInitialIds[view].slice() : [];
    var allItems = await this.fetchAllLatestPosterItems(view);

    if (seenIds.length === 0) {
      if (view === LATEST_UPDATES_VIEW_ALL) {
        var homeHtml = await this.fetchText(DOMAIN + "/");
        seenIds = extractPartialSeriesIds(parseLatestPosterItemsChecked(extractHomeSectionHtml(homeHtml, "Latest Updates")));
      } else {
        seenIds = extractPartialSeriesIds(allItems.slice(0, HOME_LATEST_PER_PAGE));
      }
    }

    return createPagedPartialSeriesResultsExcludingSeen(
      allItems,
      seenIds,
      HOME_LATEST_PER_PAGE,
      view
    );
  };

  GenzToon.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  GenzToon.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;
    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      rows: async function() {
        return [
          App.createDUISelect({
            id: STATE_LATEST_UPDATES_VIEW,
            label: "Latest Updates View",
            options: LATEST_UPDATES_VIEW_OPTIONS.map(function(option) {
              return option.id;
            }),
            allowsMultiselect: false,
            labelResolver: async function(value) {
              return getLatestUpdatesViewLabel(value);
            },
            value: App.createDUIBinding({
              get: async function() {
                return getLatestUpdatesViewSelection(await getLatestUpdatesView(stateManager));
              },
              set: async function(newValue) {
                await stateManager.store(STATE_LATEST_UPDATES_VIEW, normalizeLatestUpdatesView(newValue));
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

  GenzToon.prototype.supportsTagExclusion = async function() {
    return false;
  };

  GenzToon.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchFilterData());
  };

  GenzToon.prototype.getMangaDetails = async function(seriesId) {
    var seriesDetails = parseSeriesDetails(await this.getSeriesPageHtml(seriesId));
    if (cleanText(seriesDetails.title).length === 0 || cleanText(seriesDetails.image).length === 0) {
      throw new Error("GenzToon series detail markup changed and could not be parsed.");
    }

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(seriesDetails.title, seriesDetails.alternativeTitles),
        image: seriesDetails.image,
        desc: cleanText(seriesDetails.description || ""),
        author: emptyToUndefined(seriesDetails.author),
        artist: emptyToUndefined(seriesDetails.artist),
        status: mapStatus(seriesDetails.statusId),
        rating: 0,
        tags: buildDetailTagSections(seriesDetails),
        hentai: false
      })
    });
  };

  GenzToon.prototype.getChapters = async function(seriesId) {
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = parseChapterEntries(await this.getSeriesPageHtml(seriesId)).filter(function(entry) {
      return shouldIncludeChapterForList(entry, showLockedChapters);
    }).map(function(entry) {
      var chapter = {
        id: entry.id,
        name: buildChapterListName(entry, entry.number),
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

  GenzToon.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var html = await this.fetchText(this.getChapterShareUrl(seriesId, chapterId));
    if (isLockedChapterPage(html)) {
      throw new Error("This chapter is locked on GenzToon and cannot be loaded in Paperback.");
    }

    var pages = parseChapterPages(html);
    if (pages.length === 0) {
      throw new Error("GenzToon did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  GenzToon.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var filters = extractSearchFilters(query);
    var allSeries = await this.fetchAllBrowseSeries();
    var matchingSeries = allSeries.filter(function(series) {
      return matchesSeriesFilters(series, filters) && matchesSeriesTitle(series, title);
    });

    return createPagedSeriesResults(matchingSeries, page, SEARCH_PER_PAGE);
  };

  // Source-Specific Fetch Helpers

  GenzToon.prototype.fetchAllBrowseSeries = async function() {
    if (Array.isArray(this.cachedBrowseSeries) && Date.now() < this.cachedBrowseSeriesExpiresAt) {
      return this.cachedBrowseSeries;
    }

    if (this.cachedBrowseSeriesRequest) {
      return this.cachedBrowseSeriesRequest;
    }

    this.cachedBrowseSeriesRequest = this.fetchText(DOMAIN + "/search_series").then(function(html) {
      var parsedSeries = parseBrowseSeriesEntries(html);
      if (containsSeriesLinks(html) && parsedSeries.length === 0) {
        throw new Error("GenzToon series catalog markup changed and could not be parsed.");
      }

      this.cachedBrowseSeries = parsedSeries;
      cacheSeriesSlugMappingsFromSeries(this.seriesSlugById, parsedSeries);
      this.cachedBrowseSeriesExpiresAt = Date.now() + BROWSE_CACHE_MS;
      this.cachedBrowseSeriesRequest = null;
      return this.cachedBrowseSeries;
    }.bind(this)).catch(function(error) {
      this.cachedBrowseSeriesRequest = null;
      throw error;
    }.bind(this));

    return this.cachedBrowseSeriesRequest;
  };

  GenzToon.prototype.getLatestSectionItems = async function(page, latestUpdatesView) {
    var view = latestUpdatesView === void 0 ?
      await getLatestUpdatesView(this.stateManager) :
      normalizeLatestUpdatesView(latestUpdatesView);

    return createPagedPartialSeriesResults(
      await this.fetchAllLatestPosterItems(view),
      toPositiveInteger(page, 1),
      HOME_LATEST_PER_PAGE
    );
  };

  GenzToon.prototype.fetchAllLatestPosterItems = async function(latestUpdatesView) {
    var view = normalizeLatestUpdatesView(latestUpdatesView);

    if (Array.isArray(this.cachedLatestPosterItems[view]) && Date.now() < toNumber(this.cachedLatestPosterItemsExpiresAt[view], 0)) {
      return this.cachedLatestPosterItems[view];
    }

    if (this.cachedLatestPosterItemRequests[view]) {
      return this.cachedLatestPosterItemRequests[view];
    }

    this.cachedLatestPosterItemRequests[view] = this.fetchText(buildLatestUpdatesUrl(view)).then(function(html) {
      cacheSeriesSlugMappingsFromLookup(this.seriesSlugById, buildHomepageSeriesIdLookup(html));
      this.cachedLatestPosterItems[view] = parseLatestPosterItemsChecked(extractHomeSectionHtml(html, "Latest Updates"));
      this.cachedLatestPosterItemsExpiresAt[view] = Date.now() + LATEST_CACHE_MS;
      delete this.cachedLatestPosterItemRequests[view];
      return this.cachedLatestPosterItems[view];
    }.bind(this)).catch(function(error) {
      delete this.cachedLatestPosterItemRequests[view];
      throw error;
    }.bind(this));

    return this.cachedLatestPosterItemRequests[view];
  };

  GenzToon.prototype.fetchFilterData = async function() {
    var allSeries = await this.fetchAllBrowseSeries();

    return {
      genres: extractGenreOptions(allSeries),
      statuses: mergeFilterOptions(DEFAULT_STATUS_OPTIONS, extractSeriesFieldOptions(allSeries, "statusId", "statusLabel")),
      types: mergeFilterOptions(
        DEFAULT_TYPE_OPTIONS,
        extractSeriesFieldOptions(allSeries, "typeId", "typeLabel").filter(isSupportedTypeOption)
      )
    };
  };

  GenzToon.prototype.getSeriesPageHtml = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");
    if (cacheKey.length === 0) {
      throw new Error("GenzToon requires a series id.");
    }

    var cached = this.cachedSeriesPages[cacheKey];

    if (cached && Date.now() < cached.expiresAt) {
      touchCacheKey(this.cachedSeriesPageOrder, cacheKey);
      return cached.value;
    }

    if (!this.cachedSeriesPageRequests[cacheKey]) {
      this.cachedSeriesPageRequests[cacheKey] = this.fetchText(this.getMangaShareUrl(cacheKey)).then(function(html) {
        storeSeriesSlugMapping(this.seriesSlugById, cacheKey, extractCanonicalSeriesSlug(html));
        storeBoundedCacheEntry(
          this.cachedSeriesPages,
          this.cachedSeriesPageOrder,
          cacheKey,
          { value: html, expiresAt: Date.now() + SERIES_PAGE_CACHE_MS },
          SERIES_PAGE_CACHE_LIMIT
        );
        delete this.cachedSeriesPageRequests[cacheKey];
        return html;
      }.bind(this)).catch(function(error) {
        delete this.cachedSeriesPageRequests[cacheKey];
        throw error;
      }.bind(this));
    }

    return this.cachedSeriesPageRequests[cacheKey];
  };

  GenzToon.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  // Response Helpers

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("GenzToon returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested GenzToon page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("GenzToon returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
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

  function createPartialSeries(series, subtitle) {
    return App.createPartialSourceManga({
      mangaId: cleanText(series && series.id || ""),
      title: cleanText(series && series.title || ""),
      image: normalizeUrl(series && series.image || ""),
      subtitle: emptyToUndefined(subtitle)
    });
  }

  function mapSeriesItems(seriesList) {
    return (Array.isArray(seriesList) ? seriesList : []).filter(function(series) {
      return cleanText(series && series.id).length > 0 &&
        cleanText(series && series.title).length > 0;
    }).map(function(series) {
      return createPartialSeries(series, buildBrowseSubtitle(series));
    });
  }

  function parseBrowseSeriesEntries(html) {
    var entries = [];
    var seen = {};
    var buttonRegex = /<button\b[\s\S]*?<\/button>/gi;
    var match;

    while ((match = buttonRegex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var openTagMatch = block.match(/^<button\b[^>]*>/i);
      var openTag = openTagMatch ? openTagMatch[0] : "";
      var legacyId = cleanText(extractHtmlAttribute(openTag, "id"));
      var anchorTag = extractFirstSeriesAnchorTag(block);
      var seriesUrl = normalizeUrl(extractHtmlAttribute(anchorTag, "href"));
      var slug = extractSeriesId(seriesUrl);
      var seriesId = legacyId || slug;

      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var rawTitle = cleanText(extractHtmlAttribute(openTag, "title"));
      var title = cleanText(extractHtmlAttribute(anchorTag, "title")) ||
        cleanText(extractHtmlAttribute(openTag, "alt")) ||
        cleanText(extractMatch(block, /<div[^>]*class=(['"])[^'"]*\bfont-bold\b[^'"]]*\1[^>]*>([\s\S]*?)<\/div>/i, 2)) ||
        rawTitle;
      if (title.length === 0) {
        continue;
      }

      var tags = parseStringArray(extractHtmlAttribute(openTag, "tags"));
      var genres = normalizeGenreEntries(tags);
      var typeId = normalizeOptionId(extractHtmlAttribute(openTag, "data-type"));
      var statusId = normalizeOptionId(extractHtmlAttribute(openTag, "data-status"));
      var typeLabel = formatOptionLabel(extractHtmlAttribute(openTag, "data-type"));
      var statusLabel = formatOptionLabel(extractHtmlAttribute(openTag, "data-status"));
      var discountLabel = cleanText(extractMatch(block, />\s*(\d+%\s+OFF)\s*</i, 1));
      var isNew = /<span\b[^>]*>\s*New\s*<\/span>/i.test(block);

      if (isExcludedSeriesTypeId(typeId)) {
        continue;
      }

      seen[seriesId] = true;
      entries.push({
        id: seriesId,
        slug: slug,
        title: title,
        searchTitle: rawTitle.length > 0 ? rawTitle : title,
        image: normalizeCssUrl(extractMatch(block, /background-image:\s*url\(([^)]+)\)/i, 1)),
        genres: genres,
        genreIds: genres.map(function(genre) {
          return genre.id;
        }),
        statusId: statusId,
        statusLabel: statusLabel,
        typeId: typeId,
        typeLabel: typeLabel,
        discountLabel: discountLabel,
        isNew: isNew
      });
    }

    return entries;
  }

  function createPagedSeriesResults(seriesList, page, perPage) {
    var resolvedPage = toPositiveInteger(page, 1);
    var normalizedSeries = Array.isArray(seriesList) ? seriesList : [];
    var start = Math.max(0, (resolvedPage - 1) * perPage);
    var end = start + perPage;
    var pageItems = normalizedSeries.slice(start, end).map(function(series) {
      return createPartialSeries(series, buildBrowseSubtitle(series));
    });

    return App.createPagedResults({
      results: pageItems,
      metadata: end < normalizedSeries.length ? { page: resolvedPage + 1 } : void 0
    });
  }

  function createPagedPartialSeriesResults(items, page, perPage) {
    var resolvedPage = toPositiveInteger(page, 1);
    var normalizedItems = Array.isArray(items) ? items : [];
    var start = Math.max(0, (resolvedPage - 1) * perPage);
    var end = start + perPage;

    return App.createPagedResults({
      results: normalizedItems.slice(start, end),
      metadata: end < normalizedItems.length ? { page: resolvedPage + 1 } : void 0
    });
  }

  function createPagedPartialSeriesResultsExcludingSeen(items, seenIds, perPage, view) {
    var normalizedItems = Array.isArray(items) ? items : [];
    var seen = {};
    var normalizedSeenIds = [];

    (Array.isArray(seenIds) ? seenIds : []).forEach(function(id) {
      var normalizedId = cleanText(id);
      if (normalizedId.length === 0 || seen[normalizedId]) {
        return;
      }
      seen[normalizedId] = true;
      normalizedSeenIds.push(normalizedId);
    });

    var remaining = normalizedItems.filter(function(item) {
      var id = cleanText(item && item.mangaId);
      return id.length > 0 && !seen[id];
    });
    var results = remaining.slice(0, perPage);
    var nextSeenIds = normalizedSeenIds.concat(extractPartialSeriesIds(results));

    return App.createPagedResults({
      results: results,
      metadata: results.length < remaining.length ? {
        view: normalizeLatestUpdatesView(view),
        seenIds: nextSeenIds
      } : void 0
    });
  }

  function extractPartialSeriesIds(items) {
    return (Array.isArray(items) ? items : []).map(function(item) {
      return cleanText(item && item.mangaId);
    }).filter(function(id, index, values) {
      return id.length > 0 && values.indexOf(id) === index;
    });
  }

  function extractSeriesId(url) {
    var match = String(url || "").match(/\/series\/([^/?#]+)\/?/i);
    return match ? match[1] : "";
  }

  function buildBrowseSubtitle(series) {
    var parts = [];
    var discountLabel = cleanText(series && series.discountLabel || "");
    var typeLabel = cleanText(series && series.typeLabel || "");
    var statusLabel = getVisibleBrowseStatusLabel(series && series.statusId, series && series.statusLabel);

    if (series && series.isNew === true) {
      parts.push("New");
    }
    if (discountLabel.length > 0) {
      parts.push(discountLabel);
    }
    if (typeLabel.length > 0) {
      parts.push(typeLabel);
    }
    if (statusLabel.length > 0) {
      parts.push(statusLabel);
    }

    return parts.join(" · ");
  }

  function getVisibleBrowseStatusLabel(statusId, statusLabel) {
    var normalizedId = cleanText(statusId).toLowerCase();
    if (normalizedId.length === 0 || normalizedId === "ongoing") {
      return "";
    }

    return cleanText(statusLabel) || formatOptionLabel(statusId);
  }

  function isExcludedSeriesTypeId(typeId) {
    return cleanText(typeId).toLowerCase() === "novel";
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

  function buildHomepageSeriesIdLookup(html) {
    var lookup = {};
    var value = String(html || "");
    var buttonRegex = /<button\b[\s\S]*?<\/button>/gi;
    var match;

    while ((match = buttonRegex.exec(value)) !== null) {
      var block = match[0];
      var openTag = extractOpeningTag(block);
      var databaseId = cleanText(extractHtmlAttribute(openTag, "id"));
      var seriesAnchor = extractFirstSeriesAnchorTag(block);
      var slug = extractSeriesId(normalizeUrl(extractHtmlAttribute(seriesAnchor, "href")));
      if (databaseId.length > 0 && slug.length > 0) {
        lookup[slug] = databaseId;
      }
    }

    extractBlocksByClass(value, "div", "editor-pick-button").forEach(function(block) {
      var tag = extractOpeningTag(block);
      var databaseId = cleanText(extractHtmlAttribute(tag, "id"));
      var slug = cleanText(extractHtmlAttribute(tag, "data-id"));
      if (databaseId.length > 0 && slug.length > 0) {
        lookup[slug] = databaseId;
      }
    });

    extractBlocksByClass(value, "div", "latest-poster").forEach(function(block) {
      var seriesAnchor = extractFirstSeriesAnchorTag(block);
      var slug = extractSeriesId(normalizeUrl(extractHtmlAttribute(seriesAnchor, "href")));
      var databaseId = extractSeriesDatabaseIdFromChapterHref(extractHtmlAttribute(extractFirstChapterAnchorTag(block), "href"));
      if (databaseId.length > 0 && slug.length > 0) {
        lookup[slug] = databaseId;
      }
    });

    return lookup;
  }

  function cacheSeriesSlugMappingsFromLookup(target, lookup) {
    if (!target || !lookup || typeof lookup !== "object") {
      return;
    }

    Object.keys(lookup).forEach(function(slug) {
      storeSeriesSlugMapping(target, lookup[slug], slug);
    });
  }

  function cacheSeriesSlugMappingsFromSeries(target, seriesList) {
    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      storeSeriesSlugMapping(target, series && series.id, series && series.slug);
    });
  }

  function storeSeriesSlugMapping(target, seriesId, slug) {
    var normalizedId = cleanText(seriesId || "");
    var normalizedSlug = cleanText(slug || "");
    if (!target || normalizedId.length === 0 || normalizedSlug.length === 0 || normalizedId === normalizedSlug) {
      return;
    }

    target[normalizedId] = normalizedSlug;
  }

  function extractCanonicalSeriesSlug(html) {
    var regex = /<link\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      if (cleanText(extractHtmlAttribute(tag, "rel")).toLowerCase() !== "canonical") {
        continue;
      }

      return extractSeriesId(normalizeUrl(extractHtmlAttribute(tag, "href")));
    }

    return "";
  }

  function parseFeaturedHomeItems(html) {
    var items = [];
    var seen = {};
    var sectionHtml = extractElementHtmlByClass(html, "section", "series-splide");
    var regex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(sectionHtml)) !== null) {
      var block = match[0];
      var openTag = extractOpeningTag(block);
      if (!hasHtmlClass(openTag, "splide__slide")) {
        continue;
      }

      var url = normalizeUrl(extractHtmlAttribute(openTag, "href"));
      var slug = extractSeriesId(url);
      var seriesId = slug;
      var title = cleanText(extractHtmlAttribute(openTag, "title")) || cleanText(extractHtmlAttribute(openTag, "alt"));
      if (isUnsupportedNovelSeries(slug, title, "")) {
        continue;
      }
      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: normalizeCssUrl(extractMatch(block, /background-image:\s*url\(([^)]+)\)/i, 1))
      }));
    }

    return items;
  }

  function extractHomeSectionHtml(html, title) {
    var value = String(html || "");
    var sectionHeadingPattern = new RegExp("<h2[^>]*>\\s*" + escapeRegex(title) + "\\s*<\\/h2>", "i");
    var match = sectionHeadingPattern.exec(value);

    if (!match) {
      return "";
    }

    var sectionHtml = value.slice(match.index + match[0].length);
    var nextHeadingMatch = sectionHtml.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
    return nextHeadingMatch ? sectionHtml.slice(0, nextHeadingMatch.index) : sectionHtml;
  }

  function parseLatestPosterItems(html) {
    var items = [];
    var seen = {};
    var blocks = extractBlocksByClass(html, "div", "latest-poster");

    blocks.forEach(function(block) {
      var seriesAnchor = extractFirstSeriesAnchorTag(block);
      var seriesUrl = normalizeUrl(extractHtmlAttribute(seriesAnchor, "href"));
      var slug = extractSeriesId(seriesUrl);
      var seriesId = slug;
      var title = cleanText(extractMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i, 1)) || cleanText(extractHtmlAttribute(seriesAnchor, "title")) || cleanText(extractHtmlAttribute(seriesAnchor, "alt"));
      var typeLabel = extractLatestPosterTypeLabel(block);

      if (seriesId.length === 0 || title.length === 0 || isUnsupportedNovelSeries(slug, title, typeLabel) || seen[seriesId]) {
        return;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: normalizeCssUrl(extractMatch(block, /background-image:\s*url\(([^)]+)\)/i, 1))
      }, buildLatestPosterSubtitle(block)));
    });

    return items;
  }

  function parseLatestPosterItemsChecked(html) {
    var items = parseLatestPosterItems(html);
    if (items.length === 0 && containsSupportedLatestPosterEvidence(html)) {
      throw new Error("GenzToon latest-card markup changed and could not be parsed.");
    }
    return items;
  }

  function containsSupportedLatestPosterEvidence(html) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var slug = extractSeriesId(normalizeUrl(extractHtmlAttribute(tag, "href")));
      var title = cleanText(extractHtmlAttribute(tag, "title")) || cleanText(extractHtmlAttribute(tag, "alt"));
      if (slug.length > 0 && title.length > 0 && !isUnsupportedNovelSeries(slug, title, "")) {
        return true;
      }
    }

    return false;
  }

  function parseEditorChoiceItems(html) {
    var items = [];
    var seen = {};
    var blocks = extractBlocksByClass(html, "div", "editor-pick-button");

    blocks.forEach(function(block) {
      var tag = extractOpeningTag(block);
      var legacyId = cleanText(extractHtmlAttribute(tag, "id"));
      var slug = cleanText(extractHtmlAttribute(tag, "data-id"));
      var seriesId = legacyId || slug;
      var title = cleanText(extractHtmlAttribute(tag, "title"));
      var imageId = cleanText(extractHtmlAttribute(tag, "data-img"));

      if (seriesId.length === 0 || title.length === 0 || isUnsupportedNovelSeries(slug, title, "") || seen[seriesId]) {
        return;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: imageId.length > 0 ? buildUploadUrl(imageId) : ""
      }));
    });

    return items;
  }

  function buildLatestPosterSubtitle(block) {
    var entries = extractLatestPosterChapterEntries(block);
    var parts = [];
    var typeLabel = extractLatestPosterTypeLabel(block);

    if (typeLabel.length > 0) {
      parts.push(typeLabel);
    }
    if (entries.length > 0) {
      parts.push(buildChapterPreviewSubtitle(entries[0]));
    }

    return parts.join(" · ");
  }

  function extractLatestPosterTypeLabel(block) {
    return formatOptionLabel(extractMatch(block, /<span\b[^>]*class=(['"])[^'"]*\bcapitalize\b[^'"]*\1[^>]*>\s*([\s\S]*?)\s*<\/span>/i, 2));
  }

  function isUnsupportedNovelSeries(slug, title, typeLabel) {
    return normalizeOptionId(typeLabel) === "novel" ||
      /\[novel\]/i.test(cleanText(title)) ||
      /(?:^|-)novel$/i.test(cleanText(slug));
  }

  function hasLatestViewMoreLink(html) {
    return /<a\b[^>]*href=(['"])\/latest\/?\1/i.test(String(html || ""));
  }

  function extractLatestPosterChapterEntries(block) {
    var entries = [];
    var regex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(block || ""))) !== null) {
      var entryHtml = match[0];
      var openTag = extractOpeningTag(entryHtml);
      if (!isChapterHref(extractHtmlAttribute(openTag, "href"))) {
        continue;
      }
      var label = extractChapterEntryLabel(entryHtml, /<div class="truncate[^"]*">\s*([\s\S]*?)\s*<\/div>/i);

      if (label.length === 0) {
        continue;
      }

      entries.push({
        label: label,
        isLocked: isLockedChapterEntryHtml(entryHtml),
        coinCost: toNumber(extractHtmlAttribute(entryHtml, "c"), 0),
        dateLabel: cleanText(extractHtmlAttribute(entryHtml, "d"))
      });
    }

    return entries;
  }

  function extractChapterEntryLabel(entryHtml, visibleLabelPattern) {
    var visibleLabel = extractMatch(entryHtml, visibleLabelPattern, 1);
    var titleLabel = extractHtmlAttribute(extractMatch(entryHtml, /^<a\b[^>]*>/i, 0), "title");
    return chooseMoreInformativeChapterLabel(visibleLabel, titleLabel);
  }

  function chooseMoreInformativeChapterLabel(primaryLabel, fallbackLabel) {
    var primary = normalizeChapterLabel(primaryLabel);
    var fallback = normalizeChapterLabel(fallbackLabel);
    var primaryNumber;
    var fallbackNumber;

    if (primary.length === 0) {
      return fallback;
    }

    if (fallback.length === 0 || primary.toLowerCase() === fallback.toLowerCase()) {
      return primary;
    }

    primaryNumber = extractChapterNumber(primary);
    fallbackNumber = extractChapterNumber(fallback);
    if (primaryNumber > 0 && primaryNumber === fallbackNumber && fallback.length > primary.length) {
      return fallback;
    }

    return primary;
  }

  async function getLatestUpdatesView(stateManager) {
    return normalizeLatestUpdatesView(await stateManager.retrieve(STATE_LATEST_UPDATES_VIEW));
  }

  function normalizeLatestUpdatesView(value) {
    var rawValue = Array.isArray(value) ? value[0] : value;
    var view = cleanText(rawValue || "").toLowerCase();

    if (view === LATEST_UPDATES_VIEW_FREE) return LATEST_UPDATES_VIEW_FREE;
    if (view === LATEST_UPDATES_VIEW_ACTION) return LATEST_UPDATES_VIEW_ACTION;
    if (view === LATEST_UPDATES_VIEW_ROMANCE) return LATEST_UPDATES_VIEW_ROMANCE;
    return LATEST_UPDATES_VIEW_ALL;
  }

  function getLatestUpdatesViewSelection(value) {
    return [normalizeLatestUpdatesView(value)];
  }

  function getLatestUpdatesViewLabel(value) {
    var view = normalizeLatestUpdatesView(value);
    for (var index = 0; index < LATEST_UPDATES_VIEW_OPTIONS.length; index += 1) {
      if (LATEST_UPDATES_VIEW_OPTIONS[index].id === view) {
        return LATEST_UPDATES_VIEW_OPTIONS[index].label;
      }
    }

    return formatOptionLabel(view);
  }

  function buildLatestUpdatesSectionTitle(value) {
    var view = normalizeLatestUpdatesView(value);
    return view === LATEST_UPDATES_VIEW_ALL ? "Latest Updates" : "Latest Updates - " + getLatestUpdatesViewLabel(view);
  }

  function buildLatestUpdatesUrl(value) {
    var view = normalizeLatestUpdatesView(value);
    return view === LATEST_UPDATES_VIEW_ALL ?
      DOMAIN + "/latest/" :
      DOMAIN + "/latest/?series=" + encodeURIComponent(view);
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeGenreOptions(filterData && filterData.genres);
    var statuses = normalizeFilterOptions(filterData && filterData.statuses);
    var types = normalizeFilterOptions(filterData && filterData.types);

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

    return sections;
  }

  function extractSearchFilters(query) {
    var filters = {
      genres: [],
      statuses: [],
      types: []
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];
    var seenGenres = {};
    var seenStatuses = {};
    var seenTypes = {};

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

      if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0) {
        var statusId = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
        var normalizedStatusId = cleanText(statusId).toLowerCase();
        if (statusId.length > 0 && !seenStatuses[normalizedStatusId]) {
          seenStatuses[normalizedStatusId] = true;
          filters.statuses.push(statusId);
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0) {
        var typeId = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
        var normalizedTypeId = cleanText(typeId).toLowerCase();
        if (typeId.length > 0 && !seenTypes[normalizedTypeId]) {
          seenTypes[normalizedTypeId] = true;
          filters.types.push(typeId);
        }
      }
    });

    return filters;
  }

  function matchesSeriesFilters(series, filters) {
    if (!series || typeof series !== "object") {
      return false;
    }

    var selectedStatuses = Array.isArray(filters && filters.statuses) ? filters.statuses : [];
    if (selectedStatuses.length > 0 && !matchesSingleValueFilter(series.statusId, selectedStatuses)) {
      return false;
    }

    var selectedTypes = Array.isArray(filters && filters.types) ? filters.types : [];
    if (selectedTypes.length > 0 && !matchesSingleValueFilter(series.typeId, selectedTypes)) {
      return false;
    }

    var requiredGenres = Array.isArray(filters && filters.genres) ? filters.genres : [];
    if (requiredGenres.length > 0) {
      var genreLookup = {};
      (Array.isArray(series.genreIds) ? series.genreIds : []).forEach(function(genreId) {
        genreLookup[cleanText(genreId).toLowerCase()] = true;
      });

      for (var index = 0; index < requiredGenres.length; index += 1) {
        if (!genreLookup[cleanText(requiredGenres[index]).toLowerCase()]) {
          return false;
        }
      }
    }

    return true;
  }

  function matchesSingleValueFilter(value, selectedValues) {
    var normalizedValue = cleanText(value).toLowerCase();
    if (normalizedValue.length === 0) {
      return false;
    }

    return selectedValues.some(function(selectedValue) {
      return normalizedValue === cleanText(selectedValue).toLowerCase();
    });
  }

  function matchesSeriesTitle(series, title) {
    var needle = normalizeSearchText(title);
    if (needle.length === 0) {
      return true;
    }

    return [
      series && series.title,
      series && series.searchTitle,
      series && series.slug ? String(series.slug).replace(/-/g, " ") : "",
      series && series.id ? String(series.id).replace(/-/g, " ") : ""
    ].some(function(value) {
      return normalizeSearchText(value).indexOf(needle) !== -1;
    });
  }

  function extractGenreOptions(seriesList) {
    var deduped = {};

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      (Array.isArray(series && series.genres) ? series.genres : []).forEach(function(genre) {
        var normalized = createGenreOption(genre);
        if (!normalized || deduped[normalized.id]) {
          return;
        }

        deduped[normalized.id] = normalized;
      });
    });

    return sortFilterOptions(Object.keys(deduped).map(function(key) {
      return deduped[key];
    }));
  }

  function extractSeriesFieldOptions(seriesList, idField, labelField) {
    var deduped = {};

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      var id = cleanText(series && series[idField]).toLowerCase();
      var label = cleanText(series && series[labelField]);
      if (id.length === 0 || label.length === 0 || deduped[id]) {
        return;
      }

      deduped[id] = {
        id: id,
        label: label
      };
    });

    return sortFilterOptions(Object.keys(deduped).map(function(key) {
      return deduped[key];
    }));
  }

  function mergeFilterOptions(primary, secondary) {
    var deduped = {};

    [primary, secondary].forEach(function(options) {
      (Array.isArray(options) ? options : []).forEach(function(option) {
        var id = cleanText(option && option.id).toLowerCase();
        var label = cleanText(option && option.label);
        if (id.length === 0 || label.length === 0 || deduped[id]) {
          return;
        }

        deduped[id] = {
          id: id,
          label: label
        };
      });
    });

    return sortFilterOptions(Object.keys(deduped).map(function(key) {
      return deduped[key];
    }));
  }

  function normalizeGenreOptions(options) {
    var deduped = {};

    (Array.isArray(options) ? options : []).forEach(function(option) {
      var normalized = createGenreOption(option);
      if (!normalized || deduped[normalized.id]) {
        return;
      }

      deduped[normalized.id] = normalized;
    });

    return sortFilterOptions(Object.keys(deduped).map(function(key) {
      return deduped[key];
    }));
  }

  function normalizeFilterOptions(options) {
    return sortFilterOptions((Array.isArray(options) ? options : []).map(function(option) {
      return {
        id: cleanText(option && option.id),
        label: cleanText(option && option.label)
      };
    }).filter(function(option) {
      return option.id.length > 0 && option.label.length > 0;
    }));
  }

  function sortFilterOptions(options) {
    return (Array.isArray(options) ? options.slice() : []).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  function isSupportedTypeOption(option) {
    return !isExcludedSeriesTypeId(option && option.id);
  }

  // Detail Helpers

  function parseSeriesDetails(html) {
    var statusLabel = extractMetadataValue(html, "Status");
    var typeLabel = extractMetadataValue(html, "Type") ||
      extractMetadataValue(html, "Series Type");
    var alternativeTitles = extractAlternativeTitles(html);

    return {
      title: cleanText(extractMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i, 1)) ||
        cleanText(extractMetaContent(html, "og:title")),
      alternativeTitles: alternativeTitles,
      image: normalizeUrl(extractMetaContent(html, "og:image")) ||
        normalizeCssUrl(extractMatch(html, /--photoURL:url\(([^)]+)\)/i, 1)),
      description: extractSeriesDescription(html),
      author: extractMetadataValue(html, "Author"),
      artist: extractMetadataValue(html, "Artist"),
      statusId: normalizeOptionId(statusLabel),
      statusLabel: formatOptionLabel(statusLabel),
      typeId: normalizeOptionId(typeLabel),
      typeLabel: formatOptionLabel(typeLabel),
      publishedAt: extractJsonLdString(html, "datePublished"),
      updatedAt: extractJsonLdString(html, "dateModified"),
      chapterCount: toNumber(extractMatch(html, />\s*(\d+)\s+Chapters\s*</i, 1), 0),
      genres: extractDetailGenres(html)
    };
  }

  function extractJsonLdString(html, key) {
    var pattern = new RegExp('"' + escapeRegex(key) + '"\\s*:\\s*"([^\"]+)"', "i");
    return cleanText(extractMatch(html, pattern, 1));
  }

  function extractSeriesDescription(html) {
    var description = cleanText(extractMatch(html, /<div id="expand_content"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i, 1));

    if (description.length > 0) {
      return description;
    }

    return cleanText(extractMetaContent(html, "description"));
  }

  function extractAlternativeTitles(html) {
    var block = sliceBetween(
      html,
      /<div\b[^>]*>\s*Alternative titles\s*<\/div>/i,
      /<div\b[^>]*\bid=(['"])expand_button\1/i
    );
    var titles = [];
    var seen = {};
    var spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/gi;
    var match;

    while ((match = spanRegex.exec(block)) !== null) {
      var title = cleanText(match[1]);
      var key = title.toLowerCase();
      if (title.length === 0 || /^no alternative titles?\.?$/i.test(title) || seen[key]) {
        continue;
      }

      seen[key] = true;
      titles.push(title);
    }

    return titles;
  }

  function extractMetadataValue(html, label) {
    var value = String(html || "");
    var labelPattern = new RegExp("<span\\b[^>]*>\\s*" + escapeRegex(label) + "\\s*<\\/span>", "i");
    var labelMatch = labelPattern.exec(value);
    if (!labelMatch) {
      return "";
    }

    var tail = value.slice(labelMatch.index + labelMatch[0].length);
    var divRegex = /<div\b[^>]*>/gi;
    var match;

    while ((match = divRegex.exec(tail)) !== null) {
      if (!hasHtmlClass(match[0], "min-h-8")) {
        continue;
      }

      var end = tail.toLowerCase().indexOf("</div>", divRegex.lastIndex);
      return cleanText(end >= 0 ? tail.slice(divRegex.lastIndex, end) : tail.slice(divRegex.lastIndex));
    }

    return "";
  }

  function extractDetailGenres(html) {
    var genres = [];
    var seen = {};
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var href = decodeEntities(extractHtmlAttribute(tag, "href"));
      if (!/^\/series\/?\?genre=/i.test(href)) {
        continue;
      }

      var normalized = createGenreOption(extractHtmlAttribute(tag, "title") || extractHtmlAttribute(tag, "alt") || extractQueryParameter(href, "genre"));
      if (!normalized || seen[normalized.id]) {
        continue;
      }

      seen[normalized.id] = true;
      genres.push(normalized);
    }

    return genres;
  }

  function buildDetailTagSections(details) {
    var sections = [];
    var genreTags = (Array.isArray(details && details.genres) ? details.genres : []).map(function(genre) {
      var genreId = cleanText(genre && genre.id);
      var genreLabel = cleanText(genre && genre.label);
      if (genreId.length === 0 || genreLabel.length === 0) {
        return null;
      }

      return App.createTag({
        id: SEARCH_TAG_PREFIX_GENRE + genreId,
        label: genreLabel
      });
    }).filter(Boolean);
    var metadataTags = [];

    if (cleanText(details && details.statusId).length > 0 && cleanText(details && details.statusLabel).length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_STATUS + details.statusId,
        label: "Status: " + details.statusLabel
      }));
    }

    if (cleanText(details && details.typeId).length > 0 && cleanText(details && details.typeLabel).length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_TYPE + details.typeId,
        label: "Type: " + details.typeLabel
      }));
    }

    addDetailMetadataTag(metadataTags, "published", "Published", formatDateMetadata(details && details.publishedAt));
    addDetailMetadataTag(metadataTags, "updated", "Updated", formatDateMetadata(details && details.updatedAt));
    if (toNumber(details && details.chapterCount, 0) > 0) {
      addDetailMetadataTag(metadataTags, "chapters", "Chapters", String(Math.floor(toNumber(details.chapterCount, 0))));
    }

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

  function addDetailMetadataTag(tags, id, label, value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return;
    }

    tags.push(App.createTag({
      id: "metadata:" + id + ":" + normalizeOptionId(clean),
      label: label + ": " + clean
    }));
  }

  function formatDateMetadata(value) {
    var raw = cleanText(value);
    if (raw.length === 0) {
      return "";
    }

    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
  }

  function buildTitles(primaryTitle, alternativeTitles) {
    var titles = [];
    addUniqueTitle(titles, primaryTitle);

    if (Array.isArray(alternativeTitles)) {
      alternativeTitles.forEach(function(title) {
        addUniqueTitle(titles, title);
      });
    } else {
      splitAlternativeTitles(alternativeTitles).forEach(function(title) {
        addUniqueTitle(titles, title);
      });
    }

    return titles.length > 0 ? titles : ["Untitled"];
  }

  function addUniqueTitle(titles, value) {
    var title = cleanText(value);
    if (title.length > 0 && titles.indexOf(title) === -1) {
      titles.push(title);
    }
  }

  function splitAlternativeTitles(value) {
    return String(value || "").split(/\s*[•;\n\r,\/]+\s*/).map(function(title) {
      return cleanText(title);
    }).filter(function(title) {
      return title.length > 0;
    });
  }

  function mapStatus(statusId) {
    var value = cleanText(statusId).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function parseChapterEntries(html) {
    var entries = [];
    var seen = {};
    var chapterListHtml = extractElementHtmlById(html, "div", "chapters");
    if (chapterListHtml.length === 0) {
      if (containsChapterLinks(html)) {
        throw new Error("GenzToon chapter-list markup changed and could not be parsed safely.");
      }
      return entries;
    }
    var regex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(chapterListHtml)) !== null) {
      var block = match[0];
      var openTag = extractOpeningTag(block);
      var href = extractHtmlAttribute(openTag, "href");
      if (!isChapterHref(href)) {
        continue;
      }

      var chapterId = extractLastPathComponent(normalizeUrl(href));
      if (chapterId.length === 0 || seen[chapterId]) {
        continue;
      }

      seen[chapterId] = true;

      var label = extractChapterEntryLabel(block, /<span class="text-sm truncate">\s*([\s\S]*?)\s*<\/span>/i);
      var chapterNumber = extractChapterNumber(label || chapterId);

      entries.push({
        id: chapterId,
        label: label,
        number: chapterNumber,
        isLocked: isLockedChapterEntryHtml(block),
        coinCost: toNumber(extractHtmlAttribute(block, "c"), 0),
        date: parseDate(extractHtmlAttribute(block, "d"))
      });
    }

    return entries.sort(compareChapterEntriesDesc);
  }

  function parseChapterPages(html) {
    var pages = [];
    var seen = {};
    var imgRegex = /<img\b[^>]*>/gi;
    var match;

    while ((match = imgRegex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var className = String(extractHtmlAttribute(tag, "class") || "").toLowerCase();
      if (className.indexOf("myimage") === -1) {
        continue;
      }

      var uid = cleanText(extractHtmlAttribute(tag, "uid"));
      if (uid.length === 0 || seen[uid]) {
        continue;
      }

      seen[uid] = true;
      pages.push({
        order: toPositiveInteger(extractHtmlAttribute(tag, "count"), pages.length),
        url: buildPageImageUrl(uid)
      });
    }

    return pages.sort(function(left, right) {
      return left.order - right.order;
    }).map(function(page) {
      return page.url;
    });
  }

  function buildPageImageUrl(uid) {
    return buildUploadUrl(uid);
  }

  function extractChapterNumber(value) {
    var match = String(value || "").match(/(\d+(?:\.\d+)?)/);
    return match ? toNumber(match[1], 0) : 0;
  }

  function buildDefaultChapterName(chapterNumber) {
    return chapterNumber > 0 ? "Chapter " + chapterNumber : "Chapter";
  }

  function compareChapterEntriesDesc(left, right) {
    if (left.number !== right.number) {
      return right.number - left.number;
    }

    var leftTime = left.date instanceof Date && !isNaN(left.date.getTime()) ? left.date.getTime() : 0;
    var rightTime = right.date instanceof Date && !isNaN(right.date.getTime()) ? right.date.getTime() : 0;
    return rightTime - leftTime;
  }

  function isLockedChapterEntryHtml(html) {
    var value = String(html || "");
    return /Coin\.svg/i.test(value) || /alt="Coin"/i.test(value) || /material-symbols:lock\.svg/i.test(value);
  }

  function isLockedChapterPage(html) {
    var value = String(html || "");
    return /This is an early access chapter/i.test(value) || /purchase the chapter using cards balance/i.test(value);
  }

  function buildChapterPreviewSubtitle(entry) {
    var label = buildChapterListName(entry, extractChapterNumber(entry && entry.label));
    var dateLabel = cleanText(entry && entry.dateLabel);
    return dateLabel.length > 0 ? label + " • " + dateLabel : label;
  }

  function buildChapterListName(entry, fallbackNumber) {
    return getChapterAccessState(entry) === CHAPTER_ACCESS_LOCKED ?
      buildLockedChapterLabel(entry, fallbackNumber) :
      buildReadableChapterLabel(entry, fallbackNumber);
  }

  function buildReadableChapterLabel(entry, fallbackNumber) {
    var chapterNumber = toChapterNumber(entry && entry.number, fallbackNumber);
    var normalizedLabel = normalizeChapterLabel(entry && entry.label);
    return normalizedLabel.length > 0 ? normalizedLabel : buildDefaultChapterName(chapterNumber);
  }

  function buildLockedChapterLabel(entry, fallbackNumber) {
    var label = LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(entry, fallbackNumber);
    var coinCost = Math.floor(toNumber(entry && entry.coinCost, 0));
    return coinCost > 0 ? label + " · " + coinCost + (coinCost === 1 ? " coin" : " coins") : label;
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

  function getChapterAccessState(entry) {
    if (!entry || typeof entry !== "object") {
      return CHAPTER_ACCESS_UNKNOWN;
    }

    if (entry.isLocked === true) {
      return CHAPTER_ACCESS_LOCKED;
    }

    if (entry.isLocked === false) {
      return CHAPTER_ACCESS_READABLE;
    }

    return CHAPTER_ACCESS_UNKNOWN;
  }

  function shouldIncludeChapterForList(entry, showLockedChapters) {
    var accessState = getChapterAccessState(entry);
    if (accessState === CHAPTER_ACCESS_READABLE) {
      return true;
    }

    return accessState === CHAPTER_ACCESS_LOCKED && showLockedChapters === true;
  }

  async function getShowLockedChapters(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS)) === true;
  }

  // Generic Utilities

  function extractBlocksByClass(html, tagName, className) {
    var value = String(html || "");
    var tagRegex = new RegExp("<" + escapeRegex(tagName) + "\\b[^>]*>", "gi");
    var starts = [];
    var match;

    while ((match = tagRegex.exec(value)) !== null) {
      if (hasHtmlClass(match[0], className)) {
        starts.push(match.index);
      }
    }

    return starts.map(function(start, index) {
      var end = index + 1 < starts.length ? starts[index + 1] : value.length;
      return value.slice(start, end);
    });
  }

  function extractElementHtmlByClass(html, tagName, className) {
    var value = String(html || "");
    var openTagRegex = new RegExp("<" + escapeRegex(tagName) + "\\b[^>]*>", "gi");
    var match;

    while ((match = openTagRegex.exec(value)) !== null) {
      if (!hasHtmlClass(match[0], className)) {
        continue;
      }

      var closingTag = "</" + tagName + ">";
      var end = value.toLowerCase().indexOf(closingTag.toLowerCase(), openTagRegex.lastIndex);
      return end >= 0 ? value.slice(match.index, end + closingTag.length) : value.slice(match.index);
    }

    return "";
  }

  function extractElementHtmlById(html, tagName, id) {
    var value = String(html || "");
    var tagRegex = new RegExp("<\\/?" + escapeRegex(tagName) + "\\b[^>]*>", "gi");
    var expectedId = cleanText(id);
    var start = -1;
    var depth = 0;
    var match;

    while ((match = tagRegex.exec(value)) !== null) {
      var tag = match[0];
      var isClosing = /^<\//.test(tag);

      if (start < 0) {
        if (!isClosing && cleanText(extractHtmlAttribute(tag, "id")) === expectedId) {
          start = match.index;
          depth = 1;
        }
        continue;
      }

      if (isClosing) {
        depth -= 1;
        if (depth === 0) {
          return value.slice(start, tagRegex.lastIndex);
        }
      } else if (!/\/>\s*$/.test(tag)) {
        depth += 1;
      }
    }

    return start >= 0 ? value.slice(start) : "";
  }

  function extractFirstSeriesAnchorTag(html) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      if (extractSeriesId(normalizeUrl(extractHtmlAttribute(match[0], "href"))).length > 0) {
        return match[0];
      }
    }

    return "";
  }

  function extractFirstChapterAnchorTag(html) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      if (isChapterHref(extractHtmlAttribute(match[0], "href"))) {
        return match[0];
      }
    }

    return "";
  }

  function extractSeriesDatabaseIdFromChapterHref(value) {
    var chapterId = extractLastPathComponent(normalizeUrl(value));
    var separatorIndex = chapterId.indexOf("-");
    return separatorIndex > 0 ? chapterId.slice(0, separatorIndex) : "";
  }

  function isChapterHref(value) {
    var href = cleanText(value);
    return /^\/chapter\//i.test(href) || href.indexOf(DOMAIN + "/chapter/") === 0;
  }

  function containsChapterLinks(html) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      if (isChapterHref(extractHtmlAttribute(match[0], "href"))) {
        return true;
      }
    }

    return false;
  }

  function extractQueryParameter(value, key) {
    var pattern = new RegExp("(?:[?&])" + escapeRegex(key) + "=([^&#]*)", "i");
    var match = String(value || "").match(pattern);
    if (!match) {
      return "";
    }

    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch (_) {
      return match[1];
    }
  }

  function hasHtmlClass(html, className) {
    var expected = cleanText(className).toLowerCase();
    if (expected.length === 0) {
      return false;
    }

    return String(extractHtmlAttribute(extractOpeningTag(html), "class") || "").split(/\s+/).some(function(value) {
      return value.toLowerCase() === expected;
    });
  }

  function extractOpeningTag(html) {
    var match = String(html || "").match(/^\s*<[^>]+>/);
    return match ? match[0] : "";
  }

  function containsSeriesLinks(html) {
    return /<a\b[^>]*\bhref=(['"])\/series\/[^?\/#'"]+\/?\1/i.test(String(html || ""));
  }

  function extractMetaContent(html, propertyName) {
    var regex = /<meta\b[^>]*>/gi;
    var match;
    var expected = cleanText(propertyName).toLowerCase();

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var property = extractHtmlAttribute(tag, "property") || extractHtmlAttribute(tag, "name");
      if (cleanText(property).toLowerCase() === expected) {
        return extractHtmlAttribute(tag, "content");
      }
    }

    return "";
  }

  function touchCacheKey(order, key) {
    var index = order.indexOf(key);
    if (index >= 0) {
      order.splice(index, 1);
    }
    order.push(key);
  }

  function storeBoundedCacheEntry(cache, order, key, value, limit) {
    cache[key] = value;
    touchCacheKey(order, key);

    while (order.length > limit) {
      delete cache[order.shift()];
    }
  }

  function extractHtmlAttribute(html, attributeName) {
    var pattern = new RegExp("\\b" + escapeRegex(attributeName) + "=(['\"])([\\s\\S]*?)\\1", "i");
    var match = String(html || "").match(pattern);
    return match ? decodeEntities(match[2]) : "";
  }

  function parseStringArray(value) {
    var text = decodeEntities(String(value || "")).trim();
    if (text.length === 0) {
      return [];
    }

    try {
      var parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return text.split(/\s*,\s*/).map(function(item) {
        return cleanText(item);
      }).filter(function(item) {
        return item.length > 0;
      });
    }
  }

  function normalizeGenreEntries(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).map(function(value) {
      var normalized = createGenreOption(value);
      if (!normalized || seen[normalized.id]) {
        return null;
      }

      seen[normalized.id] = true;
      return normalized;
    }).filter(Boolean);
  }

  function createGenreOption(value) {
    var rawLabel = cleanText(value && (value.label || value.name || value.id || value));
    var key;
    var id;
    var label;

    if (rawLabel.length === 0) {
      return null;
    }

    key = toGenreNormalizationKey(rawLabel);
    if (key.length === 0 || Object.prototype.hasOwnProperty.call(INVALID_GENRE_LABELS, key)) {
      return null;
    }

    id = GENRE_ID_OVERRIDES[key] || normalizeOptionId(rawLabel);
    label = normalizeGenreLabel(rawLabel);

    if (id.length === 0 || label.length === 0) {
      return null;
    }

    return {
      id: id,
      label: label
    };
  }

  function normalizeOptionId(value) {
    var clean = cleanText(value).toLowerCase();
    var asciiSlug;
    if (clean.length === 0) {
      return "";
    }

    asciiSlug = clean.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (asciiSlug.length > 0) {
      return asciiSlug;
    }

    return encodeURIComponent(clean.replace(/\s+/g, "-"));
  }

  function normalizeSearchText(value) {
    return cleanText(value).toLowerCase();
  }

  function normalizeGenreLabel(value) {
    var rawLabel = cleanText(String(value || "")
      .replace(/_/g, " ")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
    var key = toGenreNormalizationKey(rawLabel);

    if (key.length === 0) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    return formatOptionLabel(rawLabel);
  }

  function toGenreNormalizationKey(value) {
    return cleanText(String(value || "").replace(/[_-]+/g, " "))
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatOptionLabel(value) {
    var clean = cleanText(String(value || "").replace(/_/g, " "));
    if (clean.length === 0) {
      return "";
    }
    if (clean === clean.toLowerCase() || clean === clean.toUpperCase()) {
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

  function parseDate(value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return void 0;
    }

    var parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return parseRelativeDate(clean);
  }

  function parseRelativeDate(value) {
    var normalized = cleanText(value).toLowerCase();
    var now = new Date();

    if (normalized === "yesterday") {
      now.setDate(now.getDate() - 1);
      return now;
    }

    var match = normalized.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
    if (!match) {
      return void 0;
    }

    var amount = toPositiveInteger(match[1], 0);
    var unit = match[2];

    if (unit === "second") now.setSeconds(now.getSeconds() - amount);
    if (unit === "minute") now.setMinutes(now.getMinutes() - amount);
    if (unit === "hour") now.setHours(now.getHours() - amount);
    if (unit === "day") now.setDate(now.getDate() - amount);
    if (unit === "week") now.setDate(now.getDate() - (amount * 7));
    if (unit === "month") now.setMonth(now.getMonth() - amount);
    if (unit === "year") now.setFullYear(now.getFullYear() - amount);

    return now;
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

  function normalizeCssUrl(value) {
    var url = String(value || "").trim().replace(/^['"]|['"]$/g, "");
    return normalizeUrl(url);
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

  function buildUploadUrl(value) {
    var uid = cleanText(value);
    return uid.length > 0 ? "https://cdn.meowing.org/uploads/" + encodeURIComponent(uid) : "";
  }

  function extractLastPathComponent(url) {
    var value = String(url || "").split(/[?#]/)[0].replace(/\/+$/, "");
    var slashIndex = value.lastIndexOf("/");
    return slashIndex >= 0 ? value.slice(slashIndex + 1) : value;
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function cleanText(value) {
    return decodeEntities(String(value || "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    var numeric = Math.floor(toNumber(value, fallback));
    return numeric > 0 ? numeric : fallback;
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

  // Exports

  var exportedSources = {
    GenzToonInfo: GenzToonInfo,
    GenzToon: GenzToon
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
