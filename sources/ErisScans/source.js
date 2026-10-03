"use strict";

(function() {
  // Constants

  var DOMAIN = "https://erisscans.com";

  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var BADGE_COLOR_WARNING = "warning";

  var CONTENT_RATING_MATURE = "MATURE";
  var SEARCH_PER_PAGE = 24;
  var HOME_LATEST_PER_PAGE = 24;
  var BROWSE_CACHE_MS = 5 * 60 * 1000;
  var LATEST_CACHE_MS = 2 * 60 * 1000;
  var SERIES_PAGE_CACHE_MS = 60 * 1000;
  var SERIES_PAGE_CACHE_LIMIT = 24;

  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_TRENDING = "trending";
  var SECTION_ID_PINNED = "pinned_series";
  var SECTION_ID_LATEST = "latest_updates";
  var SECTION_ID_RECENT = "recently_added";
  var SECTION_ID_COMPLETED = "completed_series";

  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";

  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";

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
  var GENRE_LABEL_OVERRIDES = {
    "adultd": "Adult",
    "gl": "GL",
    "joseiv": "Josei",
    "mater": "Mature",
    "maturemature": "Mature",
    "romace": "Romance",
    "slice of life": "Slice of Life",
    "sumt": "Smut",
    "yuri gl": "Yuri GL"
  };

  // Source Info

  var ErisScansInfo = {
    version: "1.1.1",
    name: "ErisScans",
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

  function ErisScans() {
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
    this.cachedLatestPosterItems = null;
    this.cachedLatestPosterItemsExpiresAt = 0;
    this.cachedLatestPosterItemsRequest = null;
  }

  // Paperback Interface Methods

  ErisScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  ErisScans.prototype.getTags = async function() {
    return this.getSearchTags();
  };

  ErisScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodePathSegment(seriesId) + "/";
  };

  ErisScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return DOMAIN + "/chapter/" + encodePathSegment(chapterId) + "/";
  };

  ErisScans.prototype.getHomePageSections = async function(sectionCallback) {
    var html = await this.fetchText(DOMAIN + "/");
    var latestSectionHtml = extractHomeSectionHtml(html, "Latest Updates");
    var latestItems = parseLatestPosterItems(latestSectionHtml);
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Spotlight",
        "featured",
        parseFeaturedHomeItems(html),
        false
      ),
      createHomeSection(
        SECTION_ID_TRENDING,
        "Trending",
        "singleRowLarge",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Trending"))),
        false
      ),
      createHomeSection(
        SECTION_ID_PINNED,
        "Pinned Series",
        "singleRowNormal",
        parseLatestPosterItems(extractHomeSectionHtml(html, "Pinned Series")),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest Updates",
        "singleRowNormal",
        latestItems,
        hasLatestViewMoreLink(latestSectionHtml)
      ),
      createHomeSection(
        SECTION_ID_RECENT,
        "Recently Added",
        "singleRowNormal",
        mapSeriesItems(parseBrowseSeriesEntries(extractHomeSectionHtml(html, "Recently Added"))),
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

  ErisScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(toPositiveInteger(metadata && metadata.page, 1));
  };

  ErisScans.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  ErisScans.prototype.getSourceMenu = async function() {
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

  ErisScans.prototype.supportsTagExclusion = async function() {
    return false;
  };

  ErisScans.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchFilterData());
  };

  ErisScans.prototype.getMangaDetails = async function(seriesId) {
    var seriesDetails = parseSeriesDetails(await this.getSeriesPageHtml(seriesId));

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
        hentai: hasHentaiGenre(seriesDetails)
      })
    });
  };

  ErisScans.prototype.getChapters = async function(seriesId) {
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = parseChapterEntries(await this.getSeriesPageHtml(seriesId)).filter(function(entry) {
      return shouldIncludeChapterForList(entry, showLockedChapters);
    }).map(function(entry) {
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

  ErisScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var html = await this.fetchText(this.getChapterShareUrl(seriesId, chapterId));
    if (isLockedChapterPage(html)) {
      throw new Error("This chapter is locked on ErisScans and cannot be loaded in Paperback.");
    }

    var pages = parseChapterPages(html);
    if (pages.length === 0) {
      throw new Error("ErisScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  ErisScans.prototype.getSearchResults = async function(query, metadata) {
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

  ErisScans.prototype.fetchAllBrowseSeries = async function() {
    if (Array.isArray(this.cachedBrowseSeries) && Date.now() < this.cachedBrowseSeriesExpiresAt) {
      return this.cachedBrowseSeries;
    }

    if (this.cachedBrowseSeriesRequest) {
      return this.cachedBrowseSeriesRequest;
    }

    this.cachedBrowseSeriesRequest = this.fetchText(DOMAIN + "/search_series").then(function(html) {
      var parsedSeries = parseBrowseSeriesEntries(html);
      if (containsSeriesLinks(html) && parsedSeries.length === 0) {
        throw new Error("ErisScans series catalog markup changed and could not be parsed.");
      }

      this.cachedBrowseSeries = parsedSeries;
      this.cachedBrowseSeriesExpiresAt = Date.now() + BROWSE_CACHE_MS;
      this.cachedBrowseSeriesRequest = null;
      return this.cachedBrowseSeries;
    }.bind(this)).catch(function(error) {
      this.cachedBrowseSeriesRequest = null;
      throw error;
    }.bind(this));

    return this.cachedBrowseSeriesRequest;
  };

  ErisScans.prototype.getLatestSectionItems = async function(page) {
    return createPagedPartialSeriesResults(
      await this.fetchAllLatestPosterItems(),
      toPositiveInteger(page, 1),
      HOME_LATEST_PER_PAGE
    );
  };

  ErisScans.prototype.fetchAllLatestPosterItems = async function() {
    if (Array.isArray(this.cachedLatestPosterItems) && Date.now() < this.cachedLatestPosterItemsExpiresAt) {
      return this.cachedLatestPosterItems;
    }

    if (this.cachedLatestPosterItemsRequest) {
      return this.cachedLatestPosterItemsRequest;
    }

    this.cachedLatestPosterItemsRequest = this.fetchText(DOMAIN + "/latest/").then(function(html) {
      this.cachedLatestPosterItems = parseLatestPosterItems(extractHomeSectionHtml(html, "Latest Updates"));
      this.cachedLatestPosterItemsExpiresAt = Date.now() + LATEST_CACHE_MS;
      this.cachedLatestPosterItemsRequest = null;
      return this.cachedLatestPosterItems;
    }.bind(this)).catch(function(error) {
      this.cachedLatestPosterItemsRequest = null;
      throw error;
    }.bind(this));

    return this.cachedLatestPosterItemsRequest;
  };

  ErisScans.prototype.fetchFilterData = async function() {
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

  ErisScans.prototype.getSeriesPageHtml = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");
    if (cacheKey.length === 0) {
      throw new Error("ErisScans requires a series id.");
    }

    var cached = this.cachedSeriesPages[cacheKey];

    if (cached && Date.now() < cached.expiresAt) {
      touchCacheKey(this.cachedSeriesPageOrder, cacheKey);
      return cached.value;
    }

    if (!this.cachedSeriesPageRequests[cacheKey]) {
      this.cachedSeriesPageRequests[cacheKey] = this.fetchText(this.getMangaShareUrl(cacheKey)).then(function(html) {
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

  ErisScans.prototype.fetchText = async function(url) {
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
      throw new Error("ErisScans returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested ErisScans page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("ErisScans returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
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
      var seriesId = cleanText(extractHtmlAttribute(openTag, "id"));
      var seriesAnchor = extractFirstSeriesAnchorTag(block);
      var seriesUrl = normalizeUrl(extractHtmlAttribute(seriesAnchor, "href"));

      if (seriesId.length === 0 && seriesUrl.length > 0) {
        seriesId = extractSeriesId(seriesUrl);
      }

      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var rawTitle = cleanText(extractHtmlAttribute(openTag, "title"));
      var title = cleanText(extractMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i, 1)) || rawTitle;
      if (title.length === 0) {
        continue;
      }

      var tags = parseStringArray(extractHtmlAttribute(openTag, "tags"));
      var genres = normalizeGenreEntries(tags);
      var typeId = normalizeOptionId(extractHtmlAttribute(openTag, "data-type"));
      var statusId = normalizeOptionId(extractHtmlAttribute(openTag, "data-status"));
      var typeLabel = formatOptionLabel(extractHtmlAttribute(openTag, "data-type"));
      var statusLabel = formatOptionLabel(extractHtmlAttribute(openTag, "data-status"));

      if (isExcludedSeriesTypeId(typeId)) {
        continue;
      }

      seen[seriesId] = true;
      entries.push({
        id: seriesId,
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
        typeLabel: typeLabel
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

  function extractSeriesId(url) {
    var match = String(url || "").match(/\/series\/([^/?#]+)\/?/i);
    return match ? match[1] : "";
  }

  function buildBrowseSubtitle(series) {
    var parts = [];
    var typeLabel = cleanText(series && series.typeLabel || "");
    var statusLabel = getVisibleBrowseStatusLabel(series && series.statusId, series && series.statusLabel);
    var genreLabel = buildBrowseGenreLabel(series && series.genres, 2);

    if (typeLabel.length > 0) {
      parts.push(typeLabel);
    }
    if (statusLabel.length > 0) {
      parts.push(statusLabel);
    }
    if (genreLabel.length > 0) {
      parts.push(genreLabel);
    }

    return parts.join(" · ");
  }

  function buildBrowseGenreLabel(genres, maxGenres) {
    var limit = toPositiveInteger(maxGenres, 2);
    var labels = [];
    var seen = {};

    (Array.isArray(genres) ? genres : []).forEach(function(genre) {
      var label = cleanText(genre && genre.label);
      var key = label.toLowerCase();
      if (label.length === 0 || seen[key] || labels.length >= limit) {
        return;
      }

      seen[key] = true;
      labels.push(label);
    });

    return labels.join(", ");
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

  function parseFeaturedHomeItems(html) {
    var items = [];
    var seen = {};
    var sectionHtml = extractElementHtmlByClass(html, "section", "series-splide");
    var anchorRegex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = anchorRegex.exec(sectionHtml)) !== null) {
      var block = match[0];
      if (!hasHtmlClass(block, "splide__slide")) {
        continue;
      }

      var url = normalizeUrl(extractHtmlAttribute(block, "href"));
      var seriesId = extractSeriesId(url);
      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var title = cleanText(extractHtmlAttribute(block, "title")) || cleanText(extractHtmlAttribute(block, "alt"));
      if (title.length === 0) {
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
    var expectedTitle = cleanText(title).toLowerCase();
    var headingRegex = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
    var match;

    while ((match = headingRegex.exec(value)) !== null) {
      if (cleanText(match[0]).toLowerCase() !== expectedTitle) {
        continue;
      }

      var sectionStart = headingRegex.lastIndex;
      var nextHeading = headingRegex.exec(value);
      return value.slice(sectionStart, nextHeading ? nextHeading.index : value.length);
    }

    return "";
  }

  function hasLatestViewMoreLink(html) {
    return hasAnchorPath(html, "/latest") || hasAnchorPath(html, "/latest/");
  }

  function parseLatestPosterItems(html) {
    var items = [];
    var seen = {};
    var blocks = extractBlocksByClass(html, "div", "latest-poster");

    blocks.forEach(function(block) {
      var seriesAnchor = extractFirstSeriesAnchorTag(block);
      var seriesUrl = normalizeUrl(extractHtmlAttribute(seriesAnchor, "href"));
      var seriesId = extractSeriesId(seriesUrl);

      if (seriesId.length === 0 || seen[seriesId]) {
        return;
      }

      var title = cleanText(extractMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i, 1)) || cleanText(extractHtmlAttribute(seriesAnchor, "title")) || cleanText(extractHtmlAttribute(seriesAnchor, "alt"));
      if (title.length === 0) {
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

  function buildLatestPosterSubtitle(block) {
    var entries = extractLatestPosterChapterEntries(block);
    if (entries.length === 0) {
      return "";
    }

    var parts = [buildChapterPreviewSubtitle(entries[0])];
    var dateLabel = cleanText(entries[0].dateLabel || "");
    if (dateLabel.length > 0) {
      parts.push(dateLabel);
    }

    return parts.filter(function(part) {
      return cleanText(part).length > 0;
    }).join(" · ");
  }

  function extractLatestPosterChapterEntries(block) {
    var entries = [];
    var regex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(block || ""))) !== null) {
      var entryHtml = match[0];
      var openTag = extractOpeningTag(entryHtml);
      var href = extractHtmlAttribute(openTag, "href");
      if (!isPathPrefix(href, "/chapter/")) {
        continue;
      }

      var label = extractChapterEntryLabel(entryHtml, /<div class="truncate[^"]*">\s*([\s\S]*?)\s*<\/div>/i);

      if (label.length === 0) {
        continue;
      }

      entries.push({
        label: label,
        isLocked: isLockedChapterEntryHtml(entryHtml),
        coinCost: extractLockedChapterCoinCost(entryHtml),
        dateLabel: cleanText(extractHtmlAttribute(openTag, "d"))
      });
    }

    return entries;
  }

  function extractChapterEntryLabel(entryHtml, visibleLabelPattern) {
    var visibleLabel = extractMatch(entryHtml, visibleLabelPattern, 1);
    var titleLabel = extractHtmlAttribute(extractOpeningTag(entryHtml), "title");
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

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
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
      series && series.id ? String(series.id).replace(/-/g, " ") : ""
    ].some(function(value) {
      return normalizeSearchText(value).indexOf(needle) !== -1;
    });
  }

  function extractGenreOptions(seriesList) {
    var deduped = {};

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      (Array.isArray(series && series.genres) ? series.genres : []).forEach(function(genre) {
        var genreId = cleanText(genre && genre.id);
        var genreLabel = normalizeGenreLabel(genre && genre.label);
        if (genreId.length === 0 || genreLabel.length === 0 || deduped[genreId]) {
          return;
        }

        deduped[genreId] = {
          id: genreId,
          label: genreLabel
        };
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
    var metaHtml = sliceBetween(html, /<h1\b/i, /<div\b[^>]*\bid=(['"])expand_content\1[^>]*>/i);
    var status = extractInfoChip(metaHtml, "Status");
    var type = extractInfoChip(metaHtml, "Series Type");

    return {
      title: cleanText(extractMatch(metaHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i, 1)) || cleanText(extractMetaContent(html, "og:title")),
      alternativeTitles: extractAlternativeTitles(metaHtml),
      image: normalizeUrl(extractMetaContent(html, "og:image")) || normalizeCssUrl(extractMatch(metaHtml, /background-image:\s*url\(([^)]+)\)/i, 1)),
      description: extractSeriesDescription(html),
      author: extractInfoChip(metaHtml, "Author"),
      artist: extractInfoChip(metaHtml, "Artist"),
      addedAt: extractStructuredDateLabel(html, "datePublished"),
      updatedAt: extractInfoChip(metaHtml, "Last Updated At"),
      statusId: normalizeOptionId(status),
      statusLabel: formatOptionLabel(status),
      typeId: normalizeOptionId(type),
      typeLabel: formatOptionLabel(type),
      genres: extractDetailGenres(metaHtml)
    };
  }

  function extractSeriesDescription(html) {
    var detailsHtml = sliceBetween(html, /<h1\b/i, /<a\b[^>]*(?:alt|title)=(['"])Start Reading\1[^>]*>/i) || String(html || "");
    var description = cleanText(extractMatch(detailsHtml, /<div\b[^>]*\bid=(['"])expand_content\1[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i, 2));

    if (description.length > 0) {
      return description;
    }

    return cleanText(extractMatch(detailsHtml, /<p[^>]*style="[^"]*white-space:\s*pre-wrap[^"]*"[^>]*>([\s\S]*?)<\/p>/i, 1));
  }

  function extractAlternativeTitles(html) {
    var block = extractMatch(
      html,
      /<div\b[^>]*>\s*Alternative titles\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i,
      1
    );
    var titles = [];
    var seen = {};
    var spanRegex = /<span\b[^>]*class=(['"])[^'"]*\bselect-all\b[^'"]*\1[^>]*>([\s\S]*?)<\/span>/gi;
    var match;

    while ((match = spanRegex.exec(block)) !== null) {
      var title = cleanText(match[2]);
      var key = title.toLowerCase();
      if (title.length === 0 || seen[key]) {
        continue;
      }

      seen[key] = true;
      titles.push(title);
    }

    if (titles.length > 0) {
      return titles;
    }

    return splitAlternativeTitles(block);
  }

  function extractInfoChip(html, label) {
    var pattern = new RegExp(
      '<(?:a|div)\\b[^>]*(?:alt|title)=([\'\"])' + escapeRegex(label) + '\\1[^>]*>([\\s\\S]*?)<\\/(?:a|div)>',
      "i"
    );
    return cleanText(extractMatch(html, pattern, 2));
  }

  function extractDetailGenres(html) {
    var genres = [];
    var seen = {};
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var href = extractHtmlAttribute(tag, "href");
      if (normalizeUrl(href).indexOf(DOMAIN + "/series/?genre=") !== 0) {
        continue;
      }

      var label = normalizeGenreLabel(extractHtmlAttribute(tag, "title") || extractHtmlAttribute(tag, "alt"));
      var id = normalizeOptionId(label);
      if (id.length === 0 || seen[id]) {
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

    var addedAt = cleanText(details && details.addedAt || "");
    if (addedAt.length > 0) {
      metadataTags.push(App.createTag({
        id: "added",
        label: "Added: " + addedAt
      }));
    }

    var updatedAt = cleanText(details && details.updatedAt || "");
    if (updatedAt.length > 0) {
      metadataTags.push(App.createTag({
        id: "updated",
        label: "Updated: " + updatedAt
      }));
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

  function hasHentaiGenre(details) {
    return (Array.isArray(details && details.genres) ? details.genres : []).some(function(genre) {
      return cleanText(genre && genre.id).toLowerCase() === "hentai";
    });
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
    var sourceHtml = chapterListHtml || String(html || "");
    var requireDateFallback = chapterListHtml.length === 0;
    var regex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(sourceHtml)) !== null) {
      var block = match[0];
      var openTag = extractOpeningTag(block);
      var href = extractHtmlAttribute(openTag, "href");
      var dateLabel = extractHtmlAttribute(openTag, "d");
      if (!isPathPrefix(href, "/chapter/") || (requireDateFallback && cleanText(dateLabel).length === 0)) {
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
        coinCost: extractLockedChapterCoinCost(block),
        date: parseDate(dateLabel)
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
      if (!hasHtmlClass(tag, "myImage")) {
        continue;
      }

      var uid = cleanText(extractHtmlAttribute(tag, "uid"));
      var order = toPositiveInteger(extractHtmlAttribute(tag, "count"), pages.length);
      var pageKey = String(order) + "|" + uid;
      if (uid.length === 0 || seen[pageKey]) {
        continue;
      }

      seen[pageKey] = true;
      pages.push({
        order: order,
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
    return "https://cdn.meowing.org/uploads/" + encodeURIComponent(cleanText(uid));
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

  function extractLockedChapterCoinCost(html) {
    if (!isLockedChapterEntryHtml(html)) {
      return 0;
    }

    return toPositiveInteger(extractHtmlAttribute(extractOpeningTag(html), "c"), 0);
  }

  function buildChapterPreviewSubtitle(entry) {
    return entry && entry.isLocked ?
      buildLockedChapterLabel(entry.label, extractChapterNumber(entry.label), entry.coinCost) :
      buildReadableChapterLabel(entry && entry.label, extractChapterNumber(entry && entry.label));
  }

  function buildChapterListName(chapterLabel, chapterNumber, isLockedChapter, coinCost) {
    return isLockedChapter ?
      buildLockedChapterLabel(chapterLabel, chapterNumber, coinCost) :
      buildReadableChapterLabel(chapterLabel, chapterNumber);
  }

  function buildReadableChapterLabel(chapterLabel, chapterNumber) {
    var normalizedLabel = normalizeChapterLabel(chapterLabel);
    return normalizedLabel.length > 0 ? normalizedLabel : buildDefaultChapterName(chapterNumber);
  }

  function buildLockedChapterLabel(chapterLabel, chapterNumber, coinCost) {
    var label = LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapterLabel, chapterNumber);
    var cost = toPositiveInteger(coinCost, 0);
    return cost > 0 ? label + " · " + cost + (cost === 1 ? " coin" : " coins") : label;
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

  function shouldIncludeChapterForList(entry, showLockedChapters) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    return entry.isLocked === true ? showLockedChapters === true : true;
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

  function hasAnchorPath(html, path) {
    var expected = normalizeComparableUrl(path);
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      if (normalizeComparableUrl(extractHtmlAttribute(match[0], "href")) === expected) {
        return true;
      }
    }

    return false;
  }

  function isPathPrefix(value, pathPrefix) {
    var url = normalizeUrl(value);
    var expectedPrefix = normalizeUrl(pathPrefix);
    return url.length > 0 && expectedPrefix.length > 0 && url.indexOf(expectedPrefix) === 0;
  }

  function normalizeComparableUrl(value) {
    return normalizeUrl(value).split(/[?#]/)[0].replace(/\/+$/, "");
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

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var property = extractHtmlAttribute(tag, "property") || extractHtmlAttribute(tag, "name");
      if (cleanText(property).toLowerCase() === cleanText(propertyName).toLowerCase()) {
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
      var label = normalizeGenreLabel(value);
      var id = normalizeOptionId(label);
      if (label.length === 0 || id.length === 0 || seen[id]) {
        return null;
      }

      seen[id] = true;
      return {
        id: id,
        label: label
      };
    }).filter(Boolean);
  }

  function normalizeOptionId(value) {
    return slugify(cleanText(value).toLowerCase());
  }

  function normalizeGenreLabel(value) {
    var label = cleanText(String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, ""));
    var key = toGenreNormalizationKey(label);

    if (key.length === 0) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    return titleCaseGenreLabel(label);
  }

  function toGenreNormalizationKey(value) {
    return cleanText(String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function titleCaseGenreLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/(^|[\s\/-])[a-z]/g, function(match) {
        return match.toUpperCase();
      })
      .trim();
  }

  function normalizeSearchText(value) {
    return cleanText(value).toLowerCase();
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

  function extractStructuredDateLabel(html, propertyName) {
    var pattern = new RegExp('"' + escapeRegex(propertyName) + '"\\s*:\\s*"([^"]+)"', "i");
    var value = extractMatch(html, pattern, 1);
    var date = parseDate(value);
    return date instanceof Date && !isNaN(date.getTime()) ? formatDateLabel(date) : "";
  }

  function formatDateLabel(date) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[date.getUTCMonth()] + " " + date.getUTCDate() + ", " + date.getUTCFullYear();
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

  function extractLastPathComponent(url) {
    var value = String(url || "").split(/[?#]/)[0].replace(/\/+$/, "");
    var slashIndex = value.lastIndexOf("/");
    return slashIndex >= 0 ? value.slice(slashIndex + 1) : value;
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function slugify(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
    return match && match[groupIndex || 1] ? match[groupIndex || 1] : "";
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

  function emptyToUndefined(value) {
    var clean = cleanText(value);
    return clean.length > 0 ? clean : void 0;
  }

  // Exports

  var exportedSources = {
    ErisScansInfo: ErisScansInfo,
    ErisScans: ErisScans
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
