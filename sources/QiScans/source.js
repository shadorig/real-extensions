"use strict";

(function() {
  // Constants

  var DOMAIN = "https://qimanhwa.com";
  var API_BASE = "https://api.qimanhwa.com/api/v1";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var CHAPTERS_PER_PAGE = 100;
  var BROWSE_PER_PAGE = 100;
  var SEARCH_PER_PAGE = 24;
  var HOME_LATEST_PER_PAGE = 24;
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_PINNED = "pinned_series";
  var SECTION_ID_POPULAR = "popular";
  var SECTION_ID_LATEST = "latest";
  var SECTION_ID_NEW_SERIES = "new_series";
  var SECTION_ID_EDITORS_PICK = "editors_pick";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var CHAPTER_ACCESS_READABLE = "readable";
  var CHAPTER_ACCESS_LOCKED = "locked";
  var CHAPTER_ACCESS_UNKNOWN = "unknown";
  var SEARCH_STATUS_OPTIONS = [
    { id: "ONGOING", label: "Ongoing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "HIATUS", label: "Hiatus" },
    { id: "DROPPED", label: "Dropped" }
  ];
  var SEARCH_TYPE_OPTIONS = [
    { id: "MANGA", label: "Manga" },
    { id: "MANHWA", label: "Manhwa" },
    { id: "MANHUA", label: "Manhua" }
  ];
  var SEARCH_SORT_OPTIONS = [
    { id: "latest", label: "Latest Updated" },
    { id: "newest", label: "Newest" },
    { id: "popular", label: "Popular" },
    { id: "alphabetical", label: "A-Z" }
  ];
  var GENRE_LABEL_OVERRIDES = {
    "apocalypce": "Apocalypse",
    "vampiers": "Vampires"
  };

  // Source Info

  var QiScansInfo = {
    version: "1.0.0",
    name: "QiScans",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function QiScans() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
      requestTimeout: 20000
    });
    this.stateManager = App.createSourceStateManager();
    this.cachedGenres = null;
    this.cachedGenreTagLookup = null;
    this.cachedAlphabeticalBrowse = null;
  }

  // Paperback Interface Methods

  QiScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  QiScans.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  QiScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodeURIComponent(seriesId);
  };

  QiScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/" + encodeURIComponent(chapterId);
  };

  QiScans.prototype.getHomePageSections = async function(sectionCallback) {
    var homeResults = await Promise.all([
      this.fetchJson(API_BASE + "/home"),
      this.getLatestSectionItems(1)
    ]);
    var home = homeResults[0];
    var latestResults = homeResults[1];
    var sections = [
      createHomeSection(
        SECTION_ID_FEATURED,
        "Featured",
        "featured",
        mapHomeItems(home.banners),
        false
      ),
      createHomeSection(
        SECTION_ID_POPULAR,
        "Popular Today",
        "singleRowLarge",
        mapHomeItems(home.popular),
        false
      ),
      createHomeSection(
        SECTION_ID_PINNED,
        "Pinned Series",
        "singleRowNormal",
        mapHomeItems(home.pinned),
        false
      ),
      createHomeSection(
        SECTION_ID_LATEST,
        "Latest Updates",
        "singleRowNormal",
        latestResults.results,
        latestResults.metadata !== void 0
      ),
      createHomeSection(
        SECTION_ID_EDITORS_PICK,
        "Editor's Pick",
        "singleRowNormal",
        mapHomeItems(home.editorsPick, {
          allowStatus: true
        }),
        false
      ),
      createHomeSection(
        SECTION_ID_NEW_SERIES,
        "New Series",
        "singleRowNormal",
        mapHomeItems(home.newSeries),
        false
      )
    ];

    sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    }).forEach(function(section) {
      sectionCallback(section);
    });
  };

  QiScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(metadata && metadata.page ? metadata.page : 1);
  };

  QiScans.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  QiScans.prototype.getSourceMenu = async function() {
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

  QiScans.prototype.supportsTagExclusion = async function() {
    return false;
  };

  QiScans.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.getGenres());
  };

  QiScans.prototype.getMangaDetails = async function(seriesId) {
    var details = await this.fetchJson(API_BASE + "/series/" + encodeURIComponent(seriesId));
    var rawDescription = details.description || "";
    var description = sanitizeSynopsis(details.description || "");
    var tagSections = buildDetailTagSections(details);

    if (requiresGenreTagLookup(details && details.genres)) {
      tagSections = buildDetailTagSections(details, await this.getGenreTagLookup());
    }

    if (description.length === 0 || hasSynopsisUiControls(rawDescription) || tagSections.length === 0) {
      var detailHtml = await this.fetchText(this.getMangaShareUrl(seriesId));
      var htmlDescription = extractSynopsisFromHtml(detailHtml);
      var htmlGenres = extractHtmlGenres(detailHtml);

      if (shouldUseHtmlSynopsis(description, htmlDescription, rawDescription)) {
        description = htmlDescription;
      }

      if (tagSections.length === 0 && htmlGenres.length > 0) {
        var htmlGenreSections = buildDetailTagSections({
          genres: htmlGenres
        });
        if (requiresGenreTagLookup(htmlGenres)) {
          htmlGenreSections = buildDetailTagSections({
            genres: htmlGenres
          }, await this.getGenreTagLookup());
        }
        tagSections = htmlGenreSections;
      }
    }

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title, details.alternativeTitles),
        image: String(details.cover || ""),
        desc: description,
        author: emptyToUndefined(details.author),
        artist: emptyToUndefined(details.artist),
        status: mapStatus(details.status),
        rating: Number(details.stats && details.stats.averageRating || 0),
        tags: tagSections,
        hentai: false
      })
    });
  };

  QiScans.prototype.getChapters = async function(seriesId) {
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var seriesSlug = encodeURIComponent(seriesId);
    var firstPage = await this.fetchJson(API_BASE + "/series/" + seriesSlug + "/chapters" + buildQueryString({
      page: 1,
      perPage: CHAPTERS_PER_PAGE
    }));
    var totalPages = getTotalPageCount(firstPage);
    var chapterPages = [firstPage];

    if (totalPages > 1) {
      var pendingPages = [];
      for (var page = 2; page <= totalPages; page += 1) {
        pendingPages.push(this.fetchJson(API_BASE + "/series/" + seriesSlug + "/chapters" + buildQueryString({
          page: page,
          perPage: CHAPTERS_PER_PAGE
        })));
      }
      chapterPages = chapterPages.concat(await Promise.all(pendingPages));
    }

    var visibleChapters = [];
    var seenChapterIds = {};

    chapterPages.forEach(function(chapterPage) {
      var pageChapters = Array.isArray(chapterPage.data) ? chapterPage.data : [];
      pageChapters.forEach(function(chapter) {
        if (!shouldIncludeChapterForList(chapter, showLockedChapters)) {
          return;
        }
        var chapterId = String(chapter.slug || "");
        if (chapterId.length === 0 || seenChapterIds[chapterId]) {
          return;
        }
        seenChapterIds[chapterId] = true;
        visibleChapters.push(chapter);
      });
    });

    return visibleChapters.map(function(chapter, index) {
      var number = toChapterNumber(chapter && chapter.number, visibleChapters.length - index);
      return App.createChapter({
        id: String(chapter.slug),
        name: buildChapterListName(chapter, number),
        chapNum: number,
        time: chapter.createdAt ? new Date(chapter.createdAt) : new Date(),
        langCode: "en"
      });
    });
  };

  QiScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var chapter = await this.fetchJson(API_BASE + "/series/" + encodeURIComponent(seriesId) + "/chapters/" + encodeURIComponent(chapterId));

    if (getChapterAccessState(chapter) === CHAPTER_ACCESS_LOCKED) {
      throw new Error("This chapter is locked on QiScans and cannot be loaded in Paperback.");
    }

    var images = Array.isArray(chapter.images) ? chapter.images.slice() : [];
    images.sort(function(a, b) {
      return toNumber(a.order, 0) - toNumber(b.order, 0);
    });

    var pages = images.map(function(image) {
      return image && image.url ? String(image.url) : "";
    }).filter(function(url) {
      return url.length > 0;
    });

    if (pages.length === 0) {
      throw new Error("QiScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  QiScans.prototype.getSearchResults = async function(query, metadata) {
    var page = metadata && metadata.page ? metadata.page : 1;
    var title = query && typeof query.title === "string" ? query.title.trim() : "";
    var filters = extractSearchFilters(query);
    var resultsPage;

    if (title.length > 0 && title.length < 2) {
      return App.createPagedResults({
        results: []
      });
    }

    if (title.length >= 2) {
      resultsPage = await this.fetchJson(API_BASE + "/series/search" + buildQueryString({
        q: title,
        page: page,
        perPage: SEARCH_PER_PAGE
      }));
    } else if (filters.sort === "alphabetical") {
      return this.getAlphabeticalBrowseResults(filters, page);
    } else {
      resultsPage = await this.fetchJson(API_BASE + "/series" + buildQueryString({
        page: page,
        perPage: SEARCH_PER_PAGE,
        genre: filters.genre,
        status: filters.status,
        sort: filters.sort || "latest",
        type: filters.type
      }));
    }

    var items = Array.isArray(resultsPage.data) ? resultsPage.data : [];
    var results = items.filter(function(item) {
      return isComicSeries(item) && matchesSeriesFilters(item, filters);
    }).map(createPartialSeries);

    return App.createPagedResults({
      results: results,
      metadata: getNextPageMetadata(resultsPage, page)
    });
  };

  // Source-Specific Fetch Helpers

  QiScans.prototype.getAlphabeticalBrowseResults = async function(filters, page) {
    var cacheKey = JSON.stringify({
      genre: filters.genre || "",
      status: filters.status || "",
      type: filters.type || "",
      sort: "alphabetical"
    });
    var allItems;

    if (this.cachedAlphabeticalBrowse && this.cachedAlphabeticalBrowse.key === cacheKey) {
      allItems = this.cachedAlphabeticalBrowse.items;
    } else {
      allItems = await this.fetchAllBrowseItems(filters, "alphabetical");
      this.cachedAlphabeticalBrowse = {
        key: cacheKey,
        items: allItems
      };
    }

    var start = Math.max(0, (page - 1) * SEARCH_PER_PAGE);
    var end = start + SEARCH_PER_PAGE;
    var pageItems = allItems.slice(start, end).map(createPartialSeries);

    return App.createPagedResults({
      results: pageItems,
      metadata: end < allItems.length ? { page: page + 1 } : void 0
    });
  };

  QiScans.prototype.fetchAllBrowseItems = async function(filters, sort) {
    var firstPage = await this.fetchJson(API_BASE + "/series" + buildQueryString({
      page: 1,
      perPage: BROWSE_PER_PAGE,
      genre: filters.genre,
      status: filters.status,
      sort: sort,
      type: filters.type
    }));
    var totalPages = getTotalPageCount(firstPage);
    var browsePages = [firstPage];

    if (totalPages > 1) {
      var pendingPages = [];
      for (var page = 2; page <= totalPages; page += 1) {
        pendingPages.push(this.fetchJson(API_BASE + "/series" + buildQueryString({
          page: page,
          perPage: BROWSE_PER_PAGE,
          genre: filters.genre,
          status: filters.status,
          sort: sort,
          type: filters.type
        })));
      }
      browsePages = browsePages.concat(await Promise.all(pendingPages));
    }

    var allItems = [];
    browsePages.forEach(function(resultsPage) {
      var items = Array.isArray(resultsPage.data) ? resultsPage.data : [];
      items.forEach(function(item) {
        if (isComicSeries(item) && matchesSeriesFilters(item, filters)) {
          allItems.push(item);
        }
      });
    });

    allItems.sort(compareAlphabeticalSeries);
    return allItems;
  };

  QiScans.prototype.getLatestSectionItems = async function(page) {
    var resultsPage = await this.fetchJson(API_BASE + "/home/latest" + buildQueryString({
      page: page,
      perPage: HOME_LATEST_PER_PAGE
    }));
    var items = mapHomeItems(resultsPage.data);

    return App.createPagedResults({
      results: items,
      metadata: getNextPageMetadata(resultsPage, page)
    });
  };

  QiScans.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  }

  QiScans.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  QiScans.prototype.getGenres = async function() {
    if (!Array.isArray(this.cachedGenres)) {
      var genres = await this.fetchJson(API_BASE + "/series/genres");
      this.cachedGenres = Array.isArray(genres) ? genres : [];
    }

    return this.cachedGenres;
  };

  QiScans.prototype.getGenreTagLookup = async function() {
    if (!this.cachedGenreTagLookup) {
      this.cachedGenreTagLookup = buildGenreTagLookup(normalizeGenres(await this.getGenres()));
    }

    return this.cachedGenreTagLookup;
  };

  // Response Helpers

  function parseJsonResponse(response, url) {
    var raw = typeof response.data === "string" ? response.data : "";
    ensureReadableResponse(response, raw, url);

    if (isObject(response.data)) {
      return response.data;
    }

    try {
      return JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("QiScans returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("QiScans returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }
    if (response.status === 404) {
      throw new Error("The requested QiScans page was not found.");
    }
    if (response.status >= 400) {
      throw new Error("QiScans returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
    return lower.includes("just a moment") && lower.includes("cloudflare");
  }

  function buildQueryString(params) {
    var entries = [];
    Object.keys(params).forEach(function(key) {
      var value = params[key];
      if (value === void 0 || value === null || value === "") {
        return;
      }
      entries.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });

    return entries.length > 0 ? "?" + entries.join("&") : "";
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

  function isSeriesPayload(item) {
    return isObject(item) &&
      typeof item.slug === "string" &&
      typeof item.title === "string" &&
      "cover" in item &&
      "type" in item;
  }

  function isComicSeries(item) {
    return isSeriesPayload(item) && String(item.type || "").toUpperCase() !== "NOVEL";
  }

  function createPartialSeries(item, subtitle) {
    return App.createPartialSourceManga({
      mangaId: String(item.slug || ""),
      title: cleanText(item.title || ""),
      image: String(item.cover || ""),
      subtitle: subtitle
    });
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

  function mapHomeItems(items) {
    var options = arguments.length > 1 && arguments[1] ? arguments[1] : {};
    return (Array.isArray(items) ? items : []).filter(function(item) {
      return isComicSeries(item) &&
        String(item && item.slug || "").length > 0 &&
        cleanText(item && item.title || "").length > 0;
    }).map(function(item) {
      return createPartialSeries(item, buildHomeSubtitle(item, options));
    });
  }

  function buildHomeSubtitle(item, options) {
    if (!isObject(item)) {
      return void 0;
    }

    var latestChapter = findFirstChapterPreview(item && item.chapters);
    if (latestChapter) {
      return buildChapterListName(latestChapter, toChapterNumber(latestChapter.number, 0));
    }

    var rating = toNumber(item.avgRating, NaN);
    if (isFinite(rating) && rating > 0) {
      return "\u2605 " + rating.toFixed(1);
    }

    if (options && options.allowStatus) {
      var status = formatStatusLabel(item.status || "");
      return status.length > 0 ? status : void 0;
    }

    return void 0;
  }

  // Search / Filter Helpers

  function buildSearchTagSections(genres) {
    var sections = [];
    var normalizedGenres = normalizeGenres(genres);

    if (normalizedGenres.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: normalizedGenres.map(function(genre) {
          return App.createTag({
            id: SEARCH_TAG_PREFIX_GENRE + genre.id,
            label: genre.label
          });
        })
      }));
    }

    sections.push(App.createTagSection({
      id: "status",
      label: "Status",
      tags: SEARCH_STATUS_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_STATUS + option.id,
          label: option.label
        });
      })
    }));

    sections.push(App.createTagSection({
      id: "type",
      label: "Type",
      tags: SEARCH_TYPE_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_TYPE + option.id,
          label: option.label
        });
      })
    }));

    sections.push(App.createTagSection({
      id: "sort",
      label: "Sort",
      tags: SEARCH_SORT_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_SORT + option.id,
          label: option.label
        });
      })
    }));

    return sections;
  }

  function normalizeGenres(genres) {
    var deduped = {};

    (Array.isArray(genres) ? genres : []).forEach(function(genre) {
      var normalized = normalizeGenre(genre);
      if (!normalized) {
        return;
      }

      var key = normalized.label.toLowerCase();
      var existing = deduped[key];
      if (!existing || normalized.score > existing.score) {
        deduped[key] = normalized;
      }
    });

    return Object.keys(deduped).map(function(key) {
      return {
        id: deduped[key].id,
        label: deduped[key].label
      };
    }).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  function buildGenreTagLookup(genres) {
    var lookup = {};

    (Array.isArray(genres) ? genres : []).forEach(function(genre) {
      var tag = {
        id: SEARCH_TAG_PREFIX_GENRE + genre.id,
        label: genre.label
      };

      buildGenreLookupKeys(genre.id, genre.label).forEach(function(key) {
        if (!lookup[key]) {
          lookup[key] = tag;
        }
      });
    });

    return lookup;
  }

  function buildGenreLookupKeys(id, label) {
    var keys = {};
    var cleanId = cleanText(id || "").toLowerCase();
    var cleanLabel = cleanText(label || "").toLowerCase();
    var idWithoutNumericSuffix = cleanId.replace(/-\d+$/, "");

    if (cleanId.length > 0) {
      keys[cleanId] = true;
    }
    if (idWithoutNumericSuffix.length > 0) {
      keys[idWithoutNumericSuffix] = true;
    }
    if (cleanLabel.length > 0) {
      keys[cleanLabel] = true;
      keys[slugify(cleanLabel)] = true;
    }

    return Object.keys(keys);
  }

  function normalizeGenre(genre) {
    var id = cleanText(genre && (genre.slug || genre.id || ""));
    if (id.length === 0) {
      return null;
    }

    var rawLabel = cleanText(genre && genre.name || "");
    var label = formatGenreLabel(id, rawLabel);
    if (label.length === 0) {
      return null;
    }

    return {
      id: id,
      label: label,
      score: genrePreferenceScore(id, rawLabel, label)
    };
  }

  function genrePreferenceScore(id, rawLabel, label) {
    var score = 0;
    var cleanId = String(id || "");
    var cleanRaw = cleanText(rawLabel || "");

    if (!/-\d+$/.test(cleanId)) {
      score += 4;
    }
    if (cleanRaw === label) {
      score += 2;
    }
    if (cleanRaw.length > 0 && cleanRaw === toTitleCase(cleanRaw)) {
      score += 1;
    }

    return score;
  }

  function formatGenreLabel(id, rawLabel) {
    var key = String(id || "").toLowerCase();
    if (GENRE_LABEL_OVERRIDES[key]) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    var cleanLabel = cleanText(rawLabel || "");
    if (cleanLabel.length === 0) {
      cleanLabel = cleanText(String(id || "").replace(/-\d+$/, "").replace(/-/g, " "));
    }
    if (cleanLabel.length === 0) {
      return "";
    }

    if (cleanLabel === cleanLabel.toLowerCase() || /(^\s)|(\s$)/.test(String(rawLabel || ""))) {
      return toTitleCase(cleanLabel);
    }

    return cleanLabel;
  }

  function formatStatusLabel(value) {
    var cleanValue = cleanText(String(value || "").replace(/_/g, " "));
    if (cleanValue.length === 0) {
      return "";
    }
    if (cleanValue === cleanValue.toUpperCase() || cleanValue === cleanValue.toLowerCase()) {
      return toTitleCase(cleanValue);
    }
    return cleanValue;
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

  function extractSearchFilters(query) {
    var filters = {
      genre: void 0,
      status: void 0,
      type: void 0,
      sort: void 0
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];

    includedTags.forEach(function(tag) {
      var tagId = String(tag && tag.id || "");
      if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE) === 0 && filters.genre === void 0) {
        filters.genre = tagId.slice(SEARCH_TAG_PREFIX_GENRE.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0 && filters.status === void 0) {
        filters.status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0 && filters.type === void 0) {
        filters.type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
      } else if (tagId.indexOf(SEARCH_TAG_PREFIX_SORT) === 0 && filters.sort === void 0) {
        filters.sort = tagId.slice(SEARCH_TAG_PREFIX_SORT.length);
      }
    });

    return filters;
  }

  function matchesSeriesFilters(item, filters) {
    if (!isObject(item)) {
      return false;
    }

    if (filters.status && String(item.status || "").toUpperCase() !== String(filters.status).toUpperCase()) {
      return false;
    }

    if (filters.type && String(item.type || "").toUpperCase() !== String(filters.type).toUpperCase()) {
      return false;
    }

    return true;
  }

  function compareAlphabeticalSeries(left, right) {
    var leftTitle = normalizeSortableTitle(left && left.title);
    var rightTitle = normalizeSortableTitle(right && right.title);

    if (leftTitle < rightTitle) return -1;
    if (leftTitle > rightTitle) return 1;

    var leftSlug = String(left && left.slug || "");
    var rightSlug = String(right && right.slug || "");
    if (leftSlug < rightSlug) return -1;
    if (leftSlug > rightSlug) return 1;
    return 0;
  }

  function normalizeSortableTitle(value) {
    return cleanText(value || "").toLowerCase();
  }

  // Detail Helpers

  function buildDetailTagSections(details, genreTagLookup) {
    var sections = [];
    var genreTags = buildDetailGenreTags(details && details.genres, genreTagLookup);
    var metadataTags = buildDetailMetadataTags(details);

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

  function buildDetailGenreTags(genres, genreTagLookup) {
    var tags = [];
    var seen = {};

    (Array.isArray(genres) ? genres : []).forEach(function(genre) {
      var resolvedTag = resolveSearchableGenreTag(genre, genreTagLookup);
      if (!resolvedTag) {
        return;
      }

      var key = resolvedTag.label.toLowerCase();
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      tags.push(App.createTag(resolvedTag));
    });

    return tags;
  }

  function buildDetailMetadataTags(details) {
    var tags = [];
    var statusTag = resolveSearchableMetadataTag(details && details.status, SEARCH_STATUS_OPTIONS, SEARCH_TAG_PREFIX_STATUS, "Status");
    var typeTag = resolveSearchableMetadataTag(details && details.type, SEARCH_TYPE_OPTIONS, SEARCH_TAG_PREFIX_TYPE, "Type");

    if (statusTag) {
      tags.push(App.createTag(statusTag));
    }

    if (typeTag) {
      tags.push(App.createTag(typeTag));
    }

    return tags;
  }

  function resolveSearchableMetadataTag(value, options, prefix, labelPrefix) {
    var matchedOption = findSearchOption(value, options);

    if (!matchedOption) {
      return null;
    }

    return {
      id: prefix + matchedOption.id,
      label: labelPrefix + ": " + matchedOption.label
    };
  }

  function findSearchOption(value, options) {
    var normalizedValue = cleanText(value || "").toLowerCase();
    var normalizedSlug = slugify(normalizedValue);

    if (normalizedValue.length === 0) {
      return null;
    }

    for (var index = 0; index < options.length; index += 1) {
      var option = options[index];
      var optionId = cleanText(option && option.id || "").toLowerCase();
      var optionLabel = cleanText(option && option.label || "").toLowerCase();

      if (normalizedValue === optionId ||
          normalizedValue === optionLabel ||
          normalizedSlug === slugify(optionLabel)) {
        return option;
      }
    }

    return null;
  }

  function resolveSearchableGenreTag(genre, genreTagLookup) {
    var rawId = cleanText(genre && (genre.slug || genre.id || genre.name || genre.label));
    var rawLabel = formatGenreLabel(rawId, cleanText(genre && (genre.name || genre.label || "")));
    var resolvedTag = findGenreLookupEntry(rawId, rawLabel, genreTagLookup);

    if (resolvedTag) {
      return resolvedTag;
    }

    if (rawId.length === 0 || rawLabel.length === 0) {
      return null;
    }

    return buildDirectGenreTag(genre, rawLabel);
  }

  function findGenreLookupEntry(rawId, rawLabel, genreTagLookup) {
    var lookup = isObject(genreTagLookup) ? genreTagLookup : {};
    var keys = buildGenreLookupKeys(rawId, rawLabel);

    for (var index = 0; index < keys.length; index += 1) {
      if (lookup[keys[index]]) {
        return lookup[keys[index]];
      }
    }

    return null;
  }

  function requiresGenreTagLookup(genres) {
    return (Array.isArray(genres) ? genres : []).some(function(genre) {
      return !canBuildDirectGenreTag(genre);
    });
  }

  function canBuildDirectGenreTag(genre) {
    var directId = extractDirectGenreId(genre);
    var rawLabel = cleanText(genre && (genre.name || genre.label || ""));
    return directId.length > 0 && formatGenreLabel(directId, rawLabel).length > 0;
  }

  function buildDirectGenreTag(genre, rawLabel) {
    var directId = extractDirectGenreId(genre);
    if (directId.length === 0 || rawLabel.length === 0) {
      return null;
    }

    return {
      id: SEARCH_TAG_PREFIX_GENRE + directId,
      label: rawLabel
    };
  }

  // QiScans detail/html genres sometimes expose duplicate ids like "action-582"
  // while /series/genres uses canonical searchable ids like "action".
  function isStableDirectGenreId(value) {
    var cleanValue = cleanText(value || "");
    return cleanValue.length > 0 && !/^\d+$/.test(cleanValue) && !/-\d+$/.test(cleanValue);
  }

  function extractDirectGenreId(genre) {
    var slug = cleanText(genre && genre.slug || "");
    if (isStableDirectGenreId(slug)) {
      return slug;
    }

    var id = cleanText(genre && genre.id || "");
    if (isStableDirectGenreId(id)) {
      return id;
    }

    return "";
  }

  function extractHtmlGenres(html) {
    var genres = [];
    var seen = {};
    var genreRegex = /<a[^>]+href="[^"]*\/browse\?[^"]*genre=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    var match;

    while ((match = genreRegex.exec(String(html || ""))) !== null) {
      var id = decodeURIComponentSafe(match[1]).trim();
      var label = cleanText(match[2]);
      var key = label.toLowerCase();

      if (id.length === 0 || label.length === 0 || seen[key]) {
        continue;
      }

      seen[key] = true;
      genres.push({
        id: id,
        name: label
      });
    }

    return genres;
  }

  function extractSynopsisFromHtml(html) {
    var synopsis = sanitizeSynopsis(extractMatch(html, /<h[1-6][^>]*>\s*Synopsis\s*<\/h[1-6]>\s*([\s\S]*?)(?=<h[1-6][^>]*>\s*(?:Genres|Total Chapters|Chapters|Reviews|Discussion)\s*<\/h[1-6]>)/i, 1));
    if (synopsis.length > 0) {
      return synopsis;
    }

    var metaDescription = extractFirstMatch(html, [
      /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i,
      /<meta[^>]+name="twitter:description"[^>]+content="([^"]*)"/i,
      /<meta[^>]+name="description"[^>]+content="([^"]*)"/i
    ]);
    var cleanMetaDescription = sanitizeSynopsis(metaDescription);

    if (cleanMetaDescription.length > 0) {
      return cleanMetaDescription;
    }
    return "";
  }

  function shouldUseHtmlSynopsis(currentDescription, htmlDescription, rawApiDescription) {
    if (htmlDescription.length === 0) {
      return false;
    }

    if (currentDescription.length === 0 || hasSynopsisUiControls(rawApiDescription || "")) {
      return true;
    }

    return htmlDescription.length > currentDescription.length;
  }

  function buildTitles(title, alternativeTitles) {
    var titles = [];
    if (typeof title === "string" && title.trim().length > 0) {
      titles.push(title.trim());
    }

    splitAlternativeTitles(alternativeTitles).forEach(function(altTitle) {
      if (titles.indexOf(altTitle) === -1) {
        titles.push(altTitle);
      }
    });

    return titles;
  }

  function splitAlternativeTitles(value) {
    return String(value || "").split(/\s*[•;\n\r]+\s*/).map(function(title) {
      return cleanText(title);
    }).filter(function(title) {
      return title.length > 0;
    });
  }

  function mapStatus(status) {
    var value = String(status || "").toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function isChapterPayload(item) {
    return isObject(item) &&
      typeof item.slug === "string" &&
      "number" in item &&
      "createdAt" in item;
  }

  function isDisplayChapter(item) {
    return isObject(item) &&
      typeof item.slug === "string" &&
      "number" in item;
  }

  function buildChapterName(number, title) {
    var cleanTitle = cleanText(title || "");
    if (cleanTitle.length > 0) {
      return "Chapter " + number + ": " + cleanTitle;
    }
    return "Chapter " + number;
  }

  function buildReadableChapterLabel(chapter, fallbackNumber) {
    var chapterNumber = toChapterNumber(chapter && chapter.number, fallbackNumber);
    return buildChapterName(chapterNumber, chapter && chapter.title);
  }

  function buildLockedChapterLabel(chapter, fallbackNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapter, fallbackNumber);
  }

  function buildChapterListName(chapter, number) {
    return getChapterAccessState(chapter) === CHAPTER_ACCESS_LOCKED ?
      buildLockedChapterLabel(chapter, number) :
      buildReadableChapterLabel(chapter, number);
  }

  function findFirstChapterPreview(chapters) {
    var previewChapters = normalizePreviewChapters(chapters).sort(compareChapterEntriesDesc);
    return previewChapters.length > 0 ? previewChapters[0] : null;
  }

  function normalizePreviewChapters(chapters) {
    var ordered = [];
    var seen = {};

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      if (!isDisplayChapter(chapter)) {
        return;
      }

      var slug = cleanText(chapter && chapter.slug);
      if (slug.length === 0 || seen[slug]) {
        return;
      }

      seen[slug] = true;
      ordered.push(chapter);
    });

    return ordered;
  }

  function compareChapterEntriesDesc(left, right) {
    var leftNumber = toNumber(left && left.number, NaN);
    var rightNumber = toNumber(right && right.number, NaN);

    if (isFinite(leftNumber) && isFinite(rightNumber) && leftNumber !== rightNumber) {
      return rightNumber - leftNumber;
    }

    var rightTime = getChapterTimestamp(right);
    var leftTime = getChapterTimestamp(left);
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    var leftSlug = cleanText(left && left.slug);
    var rightSlug = cleanText(right && right.slug);
    if (leftSlug < rightSlug) return 1;
    if (leftSlug > rightSlug) return -1;
    return 0;
  }

  function getChapterTimestamp(chapter) {
    var timestamp = new Date(chapter && chapter.createdAt || 0).getTime();
    return isFinite(timestamp) ? timestamp : 0;
  }

  async function getShowLockedChapters(stateManager) {
    var stored = await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS);
    return stored === true;
  }

  function getChapterAccessState(chapter) {
    if (!isDisplayChapter(chapter)) {
      return CHAPTER_ACCESS_UNKNOWN;
    }

    if (chapter.requiresPurchase === true || chapter.isFree === false) {
      return CHAPTER_ACCESS_LOCKED;
    }

    var price = toNumber(chapter.price, NaN);
    if (isFinite(price)) {
      if (price > 0) {
        return CHAPTER_ACCESS_LOCKED;
      }
      if (price === 0) {
        return CHAPTER_ACCESS_READABLE;
      }
    }

    if (chapter.requiresPurchase === false || chapter.isFree === true) {
      return CHAPTER_ACCESS_READABLE;
    }

    return CHAPTER_ACCESS_UNKNOWN;
  }

  function shouldIncludeChapterForList(chapter, showLockedChapters) {
    if (!isChapterPayload(chapter)) {
      return false;
    }

    var accessState = getChapterAccessState(chapter);
    if (accessState === CHAPTER_ACCESS_READABLE) {
      return true;
    }

    return showLockedChapters && accessState === CHAPTER_ACCESS_LOCKED;
  }

  // Generic Utilities

  function cleanText(value) {
    var decoded = decodeEntities(String(value || ""));
    return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function sanitizeSynopsis(value) {
    return stripSynopsisUiControls(cleanText(value || ""));
  }

  function stripSynopsisUiControls(value) {
    return String(value || "").replace(/\s*(?:See more|See less)\s*$/i, "").trim();
  }

  function hasSynopsisUiControls(value) {
    return /\b(?:See more|See less)\b/i.test(cleanText(value || ""));
  }

  function extractFirstMatch(value, patterns) {
    for (var index = 0; index < patterns.length; index += 1) {
      var match = extractMatch(value, patterns[index], 1);
      if (match.length > 0) {
        return match;
      }
    }

    return "";
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

  function decodeURIComponentSafe(value) {
    var encoded = String(value || "").replace(/\+/g, "%20");

    try {
      return decodeURIComponent(encoded);
    } catch (_) {
      return String(value || "");
    }
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

  function getTotalPageCount(resultsPage) {
    return Math.max(1, toNumber(resultsPage && resultsPage.totalPages, resultsPage && resultsPage.next ? 2 : 1));
  }

  function getNextPageMetadata(resultsPage, currentPage) {
    var totalPages = toNumber(resultsPage && resultsPage.totalPages, NaN);
    if (isFinite(totalPages)) {
      return currentPage < totalPages ? { page: currentPage + 1 } : void 0;
    }

    return resultsPage && resultsPage.next ? { page: currentPage + 1 } : void 0;
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value || "");
    return clean.length > 0 ? clean : void 0;
  }

  function slugify(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  // Exports

  var exportedSources = {
    QiScansInfo: QiScansInfo,
    QiScans: QiScans
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
