"use strict";

(function() {
  // Constants

  var DOMAIN = "https://madarascans.com";
  var AJAX_URL = DOMAIN + "/wp-admin/admin-ajax.php";

  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;

  var CONTENT_RATING_MATURE = "MATURE";

  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_PINNED = "pinned_series";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_updates";

  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";

  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";

  var BROWSE_ORDER_OPTIONS = [
    { id: "new", label: "Latest Added" },
    { id: "popular", label: "Most Popular" },
    { id: "title", label: "Name (A-Z)" }
  ];
  var GENRE_LABEL_OVERRIDES = {
    "sci fi": "Sci-Fi"
  };

  // Source Info

  var MadaraScansInfo = {
    version: "1.0.0",
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
    this.cachedSeriesPages = {};
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
    return DOMAIN + "/" + encodePathSegment(chapterId) + "/";
  };

  MadaraScans.prototype.getHomePageSections = async function(sectionCallback) {
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
        SECTION_ID_PINNED,
        "Pinned Series",
        "singleRowLarge",
        parseHotCardItems(extractHotHomeSectionHtml(html, "Pinned Series")),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Most Popular Today",
        "singleRowNormal",
        parseHotCardItems(extractHotHomeSectionHtml(html, "Most Popular Today")),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest Updates",
        "singleRowNormal",
        parseLatestHomeItems(html),
        hasLatestHomeMoreItems(html)
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  MadaraScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(toPositiveInteger(metadata && metadata.page, 1));
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
          })
        ];
      }
    });
  };

  MadaraScans.prototype.supportsTagExclusion = async function() {
    return false;
  };

  MadaraScans.prototype.getSearchTags = async function() {
    if (!this.cachedFilterData) {
      this.cachedFilterData = await this.fetchFilterData();
    }

    return buildSearchTagSections(this.cachedFilterData);
  };

  MadaraScans.prototype.getMangaDetails = async function(seriesId) {
    var details = parseSeriesDetails(await this.getSeriesPageHtml(seriesId));

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title),
        image: details.image,
        desc: details.description,
        status: mapStatus(details.status),
        rating: details.rating,
        tags: buildDetailTagSections(details),
        hentai: false
      })
    });
  };

  MadaraScans.prototype.getChapters = async function(seriesId) {
    var results = await Promise.all([
      this.getSeriesPageHtml(seriesId),
      getShowLockedChapters(this.stateManager)
    ]);
    var entries = parseChapterEntries(results[0]).filter(function(entry) {
      return entry.isLocked ? results[1] === true : true;
    });
    var chapters = entries.map(function(entry) {
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

  MadaraScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var html = await this.fetchText(this.getChapterShareUrl(seriesId, chapterId));
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

    return this.getBrowseResults(filters, page);
  };

  // Source-Specific Fetch Helpers

  MadaraScans.prototype.getTitleSearchResults = async function(title, page) {
    var html = await this.fetchText(buildTitleSearchUrl(title, page));
    return App.createPagedResults({
      results: parseLegendCardItems(html),
      metadata: hasNextPage(html) ? { page: page + 1 } : void 0
    });
  };

  MadaraScans.prototype.getBrowseResults = async function(filters, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var normalizedFilters = filters || {};

    if (resolvedPage <= 1) {
      var html = await this.fetchText(buildBrowseUrl(normalizedFilters));
      var maxPages = extractBrowseMaxPages(html);
      return App.createPagedResults({
        results: parseLegendCardItems(html),
        metadata: maxPages > 1 ? { page: 2 } : void 0
      });
    }

    var responseHtml = await this.fetchAjaxHtml({
      action: "ts_homepage_load_more",
      page: resolvedPage,
      genre: cleanText(normalizedFilters.genre),
      orderby: normalizeBrowseOrder(normalizedFilters.order)
    }, DOMAIN + "/browse-manga/");

    return createPagedResultsFromAjaxHtml(responseHtml, resolvedPage);
  };

  MadaraScans.prototype.getLatestSectionItems = async function(page) {
    var resolvedPage = toPositiveInteger(page, 1);

    if (resolvedPage <= 1) {
      var html = await this.fetchText(DOMAIN + "/");
      return App.createPagedResults({
        results: parseLatestHomeItems(html),
        metadata: hasLatestHomeMoreItems(html) ? { page: 2 } : void 0
      });
    }

    var responseHtml = await this.fetchAjaxHtml({
      action: "ts_homepage_load_more",
      page: resolvedPage,
      type: "all"
    }, DOMAIN + "/");

    return createPagedResultsFromAjaxHtml(responseHtml, resolvedPage);
  };

  MadaraScans.prototype.fetchFilterData = async function() {
    var html = await this.fetchText(DOMAIN + "/browse-manga/");
    return {
      genres: extractGenreFilterOptions(html),
      orders: BROWSE_ORDER_OPTIONS
    };
  };

  MadaraScans.prototype.getSeriesPageHtml = async function(seriesId) {
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

  function buildBrowseUrl(filters) {
    var normalizedFilters = filters || {};
    var params = [];
    var order = normalizeBrowseOrder(normalizedFilters.order);
    var genre = cleanText(normalizedFilters.genre);

    params.push("order=" + encodeURIComponent(order));
    if (genre.length > 0) {
      params.push("genre=" + encodeURIComponent(genre));
    }

    return DOMAIN + "/browse-manga/?" + params.join("&");
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
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

  function createPartialSeries(series) {
    return App.createPartialSourceManga({
      mangaId: cleanText(series && series.id || ""),
      title: cleanText(series && series.title || ""),
      image: normalizeUrl(series && series.image || ""),
      subtitle: emptyToUndefined(series && series.subtitle)
    });
  }

  function createPagedResultsFromAjaxHtml(html, page) {
    var text = cleanText(html);
    var results = text === "no_more" ? [] : parseLegendCardItems(html);

    return App.createPagedResults({
      results: results,
      metadata: results.length > 0 ? { page: page + 1 } : void 0
    });
  }

  function parseLegendCardItems(html) {
    var items = [];
    var seen = {};
    var regex = /<article\b(?=[^>]*\bclass=["'][^"']*\blegend-card\b[^"']*["'])[\s\S]*?<\/article>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var seriesUrl = normalizeUrl(
        extractLinkHrefByClass(block, "legend-poster", /\/series\//i) ||
        extractFirstLinkHref(block, /\/series\//i)
      );
      var seriesId = extractSeriesId(seriesUrl);

      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var title = cleanText(extractMatch(block, /<h3[^>]*class="[^"]*legend-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, 1)) ||
        cleanText(extractMatch(block, /<img[^>]+alt="([^"]*)"/i, 1));

      if (title.length === 0) {
        continue;
      }

      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: title,
        image: extractFirstImageUrl(block),
        subtitle: buildLegendCardSubtitle(block)
      }));
    }

    return items;
  }

  function buildLegendCardSubtitle(block) {
    var entries = extractLegendChapterEntries(block);
    if (entries.length === 0) {
      return "";
    }

    return buildChapterListName(entries[0].label, extractChapterNumber(entries[0].label), entries[0].isLocked);
  }

  function extractLegendChapterEntries(block) {
    var entries = [];
    var regex = /<a\b(?=[^>]*\bclass=["'][^"']*\blegend-ch-link\b[^"']*["'])[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(block || ""))) !== null) {
      var entryHtml = match[0];
      var label = cleanText(extractMatch(entryHtml, /<span\b[^>]*class=["'][^"']*\bch-txt\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, 1));

      if (label.length === 0) {
        continue;
      }

      entries.push({
        label: normalizeChapterLabel(label),
        isLocked: isLockedChapterEntryHtml(entryHtml)
      });
    }

    return entries;
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
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bls-slide\b[^"']*["'])[\s\S]*?(?=<div\b(?=[^>]*\bclass=["'][^"']*\bls-slide\b[^"']*["'])|<div\b(?=[^>]*\bclass=["'][^"']*\bls-dots\b[^"']*["'])|$)/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var seriesUrl = normalizeUrl(extractLinkHrefByClass(block, "ls-link-overlay", /\/series\//i));
      var seriesId = extractSeriesId(seriesUrl);
      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var imageTag = extractTagByClass(block, "img", "ls-main-img");
      seen[seriesId] = true;
      items.push(createPartialSeries({
        id: seriesId,
        title: cleanText(extractMatch(block, /<h2[^>]*>([\s\S]*?)<\/h2>/i, 1)) || cleanText(extractHtmlAttribute(imageTag, "alt")),
        image: normalizeUrl(extractHtmlAttribute(imageTag, "src")),
        subtitle: emptyToUndefined(buildFeaturedRatingSubtitle(block))
      }));
    }

    return items;
  }

  function buildFeaturedRatingSubtitle(block) {
    var badgeText = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bls-badge\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1));
    var rating = toNumber(extractMatch(badgeText, /(\d+(?:\.\d+)?)/, 1), NaN);
    if (!isFinite(rating) || rating <= 0) {
      return "";
    }

    return "\u2605 " + String(Math.round(rating * 100) / 100);
  }

  function extractHotHomeSectionHtml(html, title) {
    var value = String(html || "");
    var headingPattern = new RegExp('<h2\\b(?=[^>]*\\bclass=["\\\'][^"\\\']*\\bhot-heading\\b[^"\\\']*["\\\'])[^>]*>\\s*' + escapeRegex(title) + '\\s*<\\/h2>', "i");
    var headingMatch = headingPattern.exec(value);

    if (!headingMatch) {
      return "";
    }

    var rest = value.slice(headingMatch.index);
    var afterHeading = rest.slice(headingMatch[0].length);
    var nextHeadingIndex = afterHeading.search(/<h2\b(?=[^>]*\bclass=["'][^"']*\b(?:hot-heading|sec-title)\b[^"']*["'])[^>]*>/i);
    return nextHeadingIndex >= 0 ? rest.slice(0, headingMatch[0].length + nextHeadingIndex) : rest;
  }

  function parseHotCardItems(html) {
    var items = [];
    var seen = {};
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bhot-card\b[^"']*["'])[\s\S]*?(?=<div\b(?=[^>]*\bclass=["'][^"']*\bhot-card\b[^"']*["'])|<\/section>|$)/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var block = match[0];
      var seriesUrl = normalizeUrl(extractLinkHrefByClass(block, "hot-poster", /\/series\//i));
      var seriesId = extractSeriesId(seriesUrl);

      if (seriesId.length === 0 || seen[seriesId]) {
        continue;
      }

      var title = cleanText(extractMatch(block, /<h3[^>]*class="[^"]*hot-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i, 1));
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

  function parseLatestHomeItems(html) {
    return parseLegendCardItems(extractLatestHomeSectionHtml(html));
  }

  function extractLatestHomeSectionHtml(html) {
    var value = String(html || "");
    var headingMatch = /<h2\b(?=[^>]*\bclass=["'][^"']*\bsec-title\b[^"']*["'])[^>]*>[\s\S]*?Latest Updates[\s\S]*?<\/h2>/i.exec(value);
    if (!headingMatch) {
      return "";
    }

    var rest = value.slice(headingMatch.index);
    var endIndex = rest.search(/<div\b(?=[^>]*\bclass=["'][^"']*\bpagination-premium\b[^"']*["'])/i);
    return endIndex >= 0 ? rest.slice(0, endIndex) : rest;
  }

  function hasLatestHomeMoreItems(html) {
    return /id="lux-load-more"/i.test(String(html || ""));
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var orders = normalizeFilterOptions((filterData && filterData.orders) || BROWSE_ORDER_OPTIONS);

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
      genre: "",
      order: "new"
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];

    includedTags.forEach(function(tag) {
      var tagId = cleanText(tag && tag.id || "");
      if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0 && filters.genre.length === 0) {
        filters.genre = tagId.slice(SEARCH_TAG_PREFIX_GENRE.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_ORDER) === 0) {
        filters.order = tagId.slice(SEARCH_TAG_PREFIX_ORDER.length);
      }
    });

    filters.order = normalizeBrowseOrder(filters.order);
    return filters;
  }

  function extractGenreFilterOptions(html) {
    var options = [];
    var seen = {};
    var regex = /<button\b(?=[^>]*\bclass=["'][^"']*\bgenre-select-item\b[^"']*["'])[\s\S]*?<\/button>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var buttonHtml = match[0];
      var id = cleanText(extractHtmlAttribute(buttonHtml, "data-slug"));
      var label = normalizeGenreLabel(buttonHtml);

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

  function extractBrowseMaxPages(html) {
    return toPositiveInteger(extractMatch(html, /var\s+max_pages\s*=\s*(\d+)/i, 1), 1);
  }

  function normalizeBrowseOrder(value) {
    var order = cleanText(value || "new").toLowerCase();
    return BROWSE_ORDER_OPTIONS.some(function(option) {
      return option.id === order;
    }) ? order : "new";
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

  // Detail Helpers

  function parseSeriesDetails(html) {
    var heroHtml = sliceBetween(
      html,
      /<div\b(?=[^>]*\bclass=["'][^"']*\blegendary-hero\b[^"']*["'])/i,
      /<div\b(?=[^>]*\bclass=["'][^"']*\blh-chapters-sec\b[^"']*["'])/i
    ) || String(html || "");

    return {
      title: extractSeriesTitle(heroHtml, html),
      image: normalizeUrl(extractMetaContent(html, "og:image")) ||
        normalizeUrl(extractMatch(heroHtml, /<div class="lh-poster">[\s\S]*?<img[^>]+src="([^"]+)"/i, 1)),
      description: extractSeriesDescription(heroHtml) || cleanText(extractMetaContent(html, "og:description")),
      status: cleanText(extractMatch(heroHtml, /<span[^>]*class="[^"]*status-badge-lux[^"]*"[^>]*>([\s\S]*?)<\/span>/i, 1)),
      rating: toNumber(extractMatch(heroHtml, /<i[^>]*class="[^"]*fa-star[^"]*"[^>]*><\/i>\s*([\d.]+)/i, 1), 0),
      genres: extractDetailGenres(heroHtml)
    };
  }

  function extractSeriesTitle(heroHtml, pageHtml) {
    var title = cleanText(extractMatch(heroHtml, /<h1[^>]*class="[^"]*lh-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i, 1));
    if (title.length > 0) {
      return title;
    }

    title = cleanText(extractMetaContent(pageHtml, "og:image:alt"));
    if (title.length > 0) {
      return title;
    }

    return cleanSeriesSeoTitle(extractMetaContent(pageHtml, "og:title"));
  }

  function cleanSeriesSeoTitle(value) {
    return cleanText(value)
      .replace(/^Read\s+/i, "")
      .replace(/\s+(?:Manga|Manhwa|Manhua|Comic)\s*\|\s*Madarascans\s*$/i, "")
      .replace(/\s*\|\s*Madarascans\s*$/i, "")
      .trim();
  }

  function extractSeriesDescription(html) {
    var story = extractMatch(html, /<div\b(?=[^>]*\bclass=["'][^"']*\blh-story-content\b[^"']*["'])[^>]*>([\s\S]*?)<div\b(?=[^>]*\bclass=["'][^"']*\blh-story-fade\b[^"']*["'])/i, 1);
    if (story.length === 0) {
      story = extractMatch(html, /<div\b(?=[^>]*\bclass=["'][^"']*\blh-story-content\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/i, 1);
    }
    return cleanText(story);
  }

  function extractDetailGenres(html) {
    var genres = [];
    var seen = {};
    var regex = /<a\b(?=[^>]*\bclass=["'][^"']*\blh-genre-tag\b[^"']*["'])[\s\S]*?<\/a>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
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

  function buildDetailTagSections(details) {
    var genreTags = (Array.isArray(details && details.genres) ? details.genres : []).map(function(genre) {
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

    return genreTags.length > 0 ? [
      App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags
      })
    ] : [];
  }

  function buildTitles(primaryTitle) {
    var title = cleanText(primaryTitle);
    return title.length > 0 ? [title] : ["Untitled"];
  }

  function mapStatus(status) {
    var value = cleanText(status).toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function parseChapterEntries(html) {
    var entries = [];
    var seen = {};
    var listHtml = sliceBetween(
      html,
      /<div\b(?=[^>]*\bclass=["'][^"']*\bch-list-grid\b[^"']*["'])(?=[^>]*\bid=["']chapters-list-container["'])/i,
      /<section\b(?=[^>]*\bclass=["'][^"']*\blava-related-section\b[^"']*["'])/i
    ) || String(html || "");
    var regex = /<div\b(?=[^>]*\bclass=["'][^"']*\bch-item\b[^"']*["'])[\s\S]*?(?=<div\b(?=[^>]*\bclass=["'][^"']*\bch-item\b[^"']*["'])|<section\b(?=[^>]*\bclass=["'][^"']*\blava-related-section\b[^"']*["'])|$)/gi;
    var match;

    while ((match = regex.exec(listHtml)) !== null) {
      var block = match[0];
      var link = normalizeUrl(extractLinkHrefByClass(block, "ch-main-anchor", null));
      var chapterId = extractLastPathComponent(link);

      if (chapterId.length === 0 || seen[chapterId]) {
        continue;
      }

      var rawLabel = cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bch-num\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1));
      var dataChapter = cleanText(extractHtmlAttribute(extractMatch(block, /<div\b[^>]*>/i, 0), "data-ch"));
      var label = normalizeChapterLabel(rawLabel || dataChapter);
      var number = extractChapterNumber(dataChapter || label);

      seen[chapterId] = true;
      entries.push({
        id: chapterId,
        label: label,
        number: number,
        date: parseDate(cleanText(extractMatch(block, /<span\b(?=[^>]*\bclass=["'][^"']*\bch-date\b[^"']*["'])[^>]*>([\s\S]*?)<\/span>/i, 1))),
        isLocked: isLockedChapterEntryHtml(block)
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
    var payloadText = extractMatch(html, /ts_reader\.run\((\{[\s\S]*?\})\);/i, 1);
    if (payloadText.length === 0) {
      return null;
    }

    try {
      return JSON.parse(payloadText);
    } catch (_) {
      return null;
    }
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

  function buildChapterListName(chapterLabel, chapterNumber, isLockedChapter) {
    var label = normalizeChapterLabel(chapterLabel);
    if (label.length === 0) {
      label = chapterNumber > 0 ? "Chapter " + formatChapterNumber(chapterNumber) : "Chapter";
    }

    return isLockedChapter ? LOCKED_CHAPTER_LABEL_PREFIX + label : label;
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

  function extractLinkHrefByClass(html, className, hrefPattern) {
    var regex = /<a\b[^>]*>/gi;
    var match;

    while ((match = regex.exec(String(html || ""))) !== null) {
      var tag = match[0];
      var href = extractHtmlAttribute(tag, "href");
      if (hasHtmlClass(tag, className) && (!hrefPattern || hrefPattern.test(href))) {
        return href;
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
    var imageTag = extractMatch(html, /<img\b[^>]*>/i, 0);
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

  function normalizeCssUrl(value) {
    return normalizeUrl(String(value || "").replace(/^['"]|['"]$/g, ""));
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
