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
    "gl": "GL",
    "slice of life": "Slice of Life",
    "yuri gl": "Yuri GL"
  };

  // Source Info

  var ErisScansInfo = {
    version: "1.0.0",
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
    this.cachedBrowseSeriesRequest = null;
    this.cachedFilterData = null;
    this.cachedSeriesPages = {};
    this.cachedSeriesPageRequests = {};
    this.cachedSeriesIndexHtml = null;
    this.cachedSeriesIndexHtmlRequest = null;
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
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
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
        parseLatestPosterItems(extractHomeSectionHtml(html, "Latest Updates")),
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
    if (!this.cachedFilterData) {
      this.cachedFilterData = await this.fetchFilterData();
    }

    return buildSearchTagSections(this.cachedFilterData);
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
        hentai: false
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
        name: buildChapterListName(entry.label, entry.number, entry.isLocked),
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
    if (Array.isArray(this.cachedBrowseSeries)) {
      return this.cachedBrowseSeries;
    }

    if (this.cachedBrowseSeriesRequest) {
      return this.cachedBrowseSeriesRequest;
    }

    this.cachedBrowseSeriesRequest = this.fetchText(DOMAIN + "/search_series").then(function(html) {
      this.cachedBrowseSeries = parseBrowseSeriesEntries(html);
      this.cachedBrowseSeriesRequest = null;
      return this.cachedBrowseSeries;
    }.bind(this)).catch(function(error) {
      this.cachedBrowseSeriesRequest = null;
      throw error;
    }.bind(this));

    return this.cachedBrowseSeriesRequest;
  };

  ErisScans.prototype.fetchFilterData = async function() {
    var results = await Promise.all([
      this.fetchSeriesIndexHtml(),
      this.fetchAllBrowseSeries()
    ]);
    var seriesIndexHtml = results[0];
    var allSeries = results[1];
    var genreOptions = extractDropdownFilterOptions(seriesIndexHtml, "genre");
    var statusOptions = extractDropdownFilterOptions(seriesIndexHtml, "status");
    var typeOptions = extractDropdownFilterOptions(seriesIndexHtml, "type").filter(isSupportedTypeOption);

    return {
      genres: genreOptions.length > 0 ? genreOptions : extractGenreOptions(allSeries),
      statuses: statusOptions.length > 0 ? statusOptions : DEFAULT_STATUS_OPTIONS,
      types: typeOptions.length > 0 ? typeOptions : DEFAULT_TYPE_OPTIONS
    };
  };

  ErisScans.prototype.getSeriesPageHtml = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");

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

  ErisScans.prototype.fetchSeriesIndexHtml = async function() {
    if (typeof this.cachedSeriesIndexHtml === "string" && this.cachedSeriesIndexHtml.length > 0) {
      return this.cachedSeriesIndexHtml;
    }

    if (this.cachedSeriesIndexHtmlRequest) {
      return this.cachedSeriesIndexHtmlRequest;
    }

    this.cachedSeriesIndexHtmlRequest = this.fetchText(DOMAIN + "/series/").then(function(html) {
      this.cachedSeriesIndexHtml = html;
      this.cachedSeriesIndexHtmlRequest = null;
      return html;
    }.bind(this)).catch(function(error) {
      this.cachedSeriesIndexHtmlRequest = null;
      throw error;
    }.bind(this));

    return this.cachedSeriesIndexHtmlRequest;
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
      var seriesUrl = normalizeUrl(extractMatch(block, /<a[^>]*href="(\/series\/[^"]+\/?)"/i, 1));

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

  function extractSeriesId(url) {
    var match = String(url || "").match(/\/series\/([^/?#]+)\/?/i);
    return match ? match[1] : "";
  }

  function buildBrowseSubtitle(series) {
    var parts = [];
    var typeLabel = cleanText(series && series.typeLabel || "");
    var statusLabel = getVisibleBrowseStatusLabel(series && series.statusId, series && series.statusLabel);

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

  function parseFeaturedHomeItems(html) {
    var items = [];
    var seen = {};
    var sectionHtml = sliceBetween(html, /<section class="splide series-splide/i, /<\/section>/i);
    var regex = /<a[^>]*href="(\/series\/[^"]+\/?)"[^>]*title="([^"]*)"[^>]*class="[^"]*splide__slide[^"]*"[\s\S]*?background-image:\s*url\(([^)]+)\)/gi;
    var match;

    while ((match = regex.exec(sectionHtml)) !== null) {
      var url = normalizeUrl(match[1]);
      var seriesId = extractSeriesId(url);
      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(match[2]),
        image: normalizeCssUrl(match[3])
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
    var blockRegex = /<div[^>]*class="group latest-poster[^"]*"[\s\S]*?(?=<div[^>]*class="group latest-poster[^"]*"|$)/gi;
    var match;

    while ((match = blockRegex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var seriesUrl = normalizeUrl(extractMatch(block, /<a[^>]*href="(\/series\/[^"]+\/?)"[^>]*title="([^"]*)"/i, 1));
      var seriesId = extractSeriesId(seriesUrl);

      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(extractMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i, 1)) || cleanText(extractMatch(block, /<a[^>]*href="\/series\/[^"]+\/?"[^>]*title="([^"]*)"/i, 1)),
        image: normalizeCssUrl(extractMatch(block, /background-image:\s*url\(([^)]+)\)/i, 1))
      }, buildLatestPosterSubtitle(block)));
    }

    return items;
  }

  function buildLatestPosterSubtitle(block) {
    var entries = extractLatestPosterChapterEntries(block);
    if (entries.length === 0) {
      return "";
    }

    return buildChapterPreviewSubtitle(entries[0]);
  }

  function extractLatestPosterChapterEntries(block) {
    var entries = [];
    var regex = /<a[^>]*href="\/chapter\/[^"]+\/?"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = regex.exec(String(block || ""))) !== null) {
      var entryHtml = match[0];
      var label = extractChapterEntryLabel(entryHtml, /<div class="truncate[^"]*">\s*([\s\S]*?)\s*<\/div>/i);

      if (label.length === 0) {
        continue;
      }

      entries.push({
        label: label,
        isLocked: isLockedChapterEntryHtml(entryHtml)
      });
    }

    return entries;
  }

  function extractChapterEntryLabel(entryHtml, visibleLabelPattern) {
    var visibleLabel = extractMatch(entryHtml, visibleLabelPattern, 1);
    var titleLabel = extractHtmlAttribute(entryHtml, "title");
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

  function extractDropdownFilterOptions(html, filterType) {
    var pattern = new RegExp(
      'initializeDropdownMenu\\(\\{\\s*type:\\s*"' + escapeRegex(filterType) + '"[\\s\\S]*?items:\\s*\\[([\\s\\S]*?)\\]\\s*\\}\\);',
      "i"
    );
    var block = extractMatch(html, pattern, 1);
    var options = [];
    var seen = {};
    var itemRegex = /value:\s*"([^"]+)"\s*,\s*displayName:\s*"([^"]+)"/gi;
    var match;

    while ((match = itemRegex.exec(block)) !== null) {
      var id = normalizeOptionId(match[1]);
      var label = normalizeGenreLabel(match[2]);
      if (id.length === 0 || label.length === 0 || seen[id]) {
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

  function isSupportedTypeOption(option) {
    return !isExcludedSeriesTypeId(option && option.id);
  }

  // Detail Helpers

  function parseSeriesDetails(html) {
    var metaHtml = sliceBetween(html, /<h1\b/i, /<div id="expand_content"/i);
    var status = extractInfoChip(metaHtml, "Status");
    var type = extractInfoChip(metaHtml, "Series Type");

    return {
      title: cleanText(extractMatch(metaHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i, 1)) || cleanText(extractMatch(html, /<meta property="og:title" content="([^"]+)"/i, 1)),
      alternativeTitles: extractAlternativeTitles(metaHtml),
      image: normalizeUrl(extractMatch(html, /<meta property="og:image" content="([^"]+)"/i, 1)) || normalizeCssUrl(extractMatch(metaHtml, /background-image:\s*url\(([^)]+)\)/i, 1)),
      description: extractSeriesDescription(html),
      author: extractInfoChip(metaHtml, "Author"),
      artist: extractInfoChip(metaHtml, "Artist"),
      statusId: normalizeOptionId(status),
      statusLabel: formatOptionLabel(status),
      typeId: normalizeOptionId(type),
      typeLabel: formatOptionLabel(type),
      genres: extractDetailGenres(metaHtml)
    };
  }

  function extractSeriesDescription(html) {
    var detailsHtml = sliceBetween(html, /<h1\b/i, /<a[^>]*alt="Start Reading"/i) || String(html || "");
    var description = cleanText(extractMatch(detailsHtml, /<div id="expand_content"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i, 1));

    if (description.length > 0) {
      return description;
    }

    return cleanText(extractMatch(detailsHtml, /<p[^>]*style="[^"]*white-space:\s*pre-wrap[^"]*"[^>]*>([\s\S]*?)<\/p>/i, 1));
  }

  function extractAlternativeTitles(html) {
    var block = extractMatch(
      html,
      /<div class="text-lg font-medium">\s*Alternative titles\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i,
      1
    );
    var titles = [];
    var seen = {};
    var spanRegex = /<span[^>]*class="select-all"[^>]*>([\s\S]*?)<\/span>/gi;
    var match;

    while ((match = spanRegex.exec(block)) !== null) {
      var title = cleanText(match[1]);
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
      '<(?:a|div)[^>]*(?:alt|title)="' + escapeRegex(label) + '"[^>]*>([\\s\\S]*?)<\\/(?:a|div)>',
      "i"
    );
    return cleanText(extractMatch(html, pattern, 1));
  }

  function extractDetailGenres(html) {
    var genres = [];
    var seen = {};
    var regex = /<a[^>]*href="\/series\/\?genre=[^"]+"[^>]*title="([^"]+)"[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var label = normalizeGenreLabel(match[1]);
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
    var regex = /<a\s+[^>]*href="(\/chapter\/[^"]+\/?)"[^>]*\bd="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var chapterId = extractLastPathComponent(normalizeUrl(match[1]));
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
        date: parseDate(match[2])
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

  function buildChapterPreviewSubtitle(entry) {
    return entry && entry.isLocked ?
      buildLockedChapterLabel(entry.label, extractChapterNumber(entry.label)) :
      buildReadableChapterLabel(entry && entry.label, extractChapterNumber(entry && entry.label));
  }

  function buildChapterListName(chapterLabel, chapterNumber, isLockedChapter) {
    return isLockedChapter ?
      buildLockedChapterLabel(chapterLabel, chapterNumber) :
      buildReadableChapterLabel(chapterLabel, chapterNumber);
  }

  function buildReadableChapterLabel(chapterLabel, chapterNumber) {
    var normalizedLabel = normalizeChapterLabel(chapterLabel);
    return normalizedLabel.length > 0 ? normalizedLabel : buildDefaultChapterName(chapterNumber);
  }

  function buildLockedChapterLabel(chapterLabel, chapterNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapterLabel, chapterNumber);
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
