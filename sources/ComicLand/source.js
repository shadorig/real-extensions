"use strict";

(function() {
  // Constants

  var DOMAIN = "https://comicland.org";
  var API_BASE = "https://api.comicland.org/api";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var BADGE_COLOR_WARNING = "warning";
  var CONTENT_RATING_MATURE = "MATURE";
  var HOME_PAGE_SIZE = 20;
  var SEARCH_PAGE_SIZE = 20;
  var SECTION_ID_NEWEST = "newest";
  var SECTION_ID_UNCENSORED = "uncensored";
  var SECTION_ID_RECOMMENDED = "recommended";
  var TAG_PREFIX_GENRE = "genre:";
  var TAG_PREFIX_AUTHOR = "author:";
  var TAG_PREFIX_ARTIST = "artist:";
  var STATE_SHOW_LATEST_CHAPTER_SUBTITLES = "show_latest_chapter_subtitles";
  var GENRE_LABEL_OVERRIDES = {
    "sci fi": "Sci-Fi"
  };

  // Source Info

  var ComicLandInfo = {
    version: "1.0.0",
    name: "ComicLand",
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

  function ComicLand() {
    this.cachedSeriesDetailsPromises = {};
    this.cachedSeriesCardSubtitlePromises = {};
    this.stateManager = App.createSourceStateManager();
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
  }

  // Paperback Interface Methods

  ComicLand.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  ComicLand.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  ComicLand.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/comic/" + encodePathSegment(seriesId);
  };

  ComicLand.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/chapter/" + encodePathSegment(chapterId);
  };

  ComicLand.prototype.getHomePageSections = async function(sectionCallback) {
    var results = await Promise.all([
      this.getNewestSectionItems(1),
      this.getUncensoredSectionItems(1),
      this.getRecommendedSectionItems(1)
    ]);

    [
      createHomeSection(SECTION_ID_NEWEST, "Newest", results[0]),
      createHomeSection(SECTION_ID_UNCENSORED, "Uncensored", results[1]),
      createHomeSection(SECTION_ID_RECOMMENDED, "Recommended", results[2])
    ].forEach(function(section) {
      if (Array.isArray(section.items) && section.items.length > 0) {
        sectionCallback(section);
      }
    });
  };

  ComicLand.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);

    if (homepageSectionId === SECTION_ID_NEWEST) {
      return this.getNewestSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_UNCENSORED) {
      return this.getUncensoredSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_RECOMMENDED) {
      return this.getRecommendedSectionItems(page);
    }

    return App.createPagedResults({
      results: []
    });
  };

  ComicLand.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  ComicLand.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;

    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      footer: "May slow homepage loading as latest chapters require extra title requests.",
      rows: async function() {
        return [
          App.createDUISwitch({
            id: STATE_SHOW_LATEST_CHAPTER_SUBTITLES,
            label: "Show Latest Chapter on Cards",
            value: App.createDUIBinding({
              get: async function() {
                return getShowLatestChapterSubtitles(stateManager);
              },
              set: async function(newValue) {
                await stateManager.store(STATE_SHOW_LATEST_CHAPTER_SUBTITLES, newValue === true);
              }
            })
          })
        ];
      }
    });
  };

  ComicLand.prototype.getMangaDetails = async function(seriesId) {
    var details = await this.fetchSeriesDetails(seriesId);

    return App.createSourceManga({
      id: seriesId,
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title, details.alt_titles),
        image: String(details.cover_url || ""),
        desc: cleanText(details.description || ""),
        author: emptyToUndefined(joinContributorNames(details.authors)),
        artist: emptyToUndefined(joinContributorNames(details.artists)),
        status: mapStatus(details.status),
        rating: toNumber(details.rating, 0),
        tags: buildDetailTagSections(details),
        hentai: false
      })
    });
  };

  ComicLand.prototype.getChapters = async function(seriesId) {
    var details = await this.fetchSeriesDetails(seriesId);
    var chapters = normalizeChapterEntries(details && details.chapters);

    if (chapters.length === 0) {
      throw new Error("ComicLand did not return any chapters for " + seriesId + ".");
    }

    chapters.sort(compareChapterEntriesDesc);

    return chapters.map(function(chapter, index) {
      var chapterNumber = toNumber(chapter.chapter_index, chapters.length - index);
      return App.createChapter({
        id: String(chapter.chapter_index),
        name: buildChapterName(chapter, chapterNumber),
        chapNum: chapterNumber,
        langCode: "en"
      });
    });
  };

  ComicLand.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var chapterData = await this.fetchChapterPages(seriesId, chapterId);
    var pages = (Array.isArray(chapterData && chapterData.pages) ? chapterData.pages : []).map(function(page) {
      return cleanText(page || "");
    }).filter(function(page) {
      return page.length > 0;
    });

    if (pages.length === 0) {
      throw new Error("ComicLand did not return readable pages for chapter " + chapterId + ".");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  ComicLand.prototype.getSearchResults = async function(query, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var title = cleanText(query && query.title || "");
    var filters = extractSearchFilters(query);
    var pageData;

    if (title.length === 0 && filters.taxonomyKind === "genre") {
      return this.browseGenreSeries(filters.taxonomyValue, page);
    }

    if (title.length === 0 && (filters.taxonomyKind === "author" || filters.taxonomyKind === "artist")) {
      return this.browseCreatorSeries(filters.taxonomyKind, filters.taxonomyValue, page);
    }

    if (title.length > 0) {
      pageData = await this.fetchSearchPage(title, page, SEARCH_PAGE_SIZE);
    } else {
      pageData = await this.fetchRecommendedPage(page);
    }

    return createPagedSeriesResults(this, pageData.items, pageData.hasMore, page);
  };

  // Source-Specific Fetch Helpers

  ComicLand.prototype.getNewestSectionItems = async function(page) {
    var pageData = await this.fetchNewestPage(page);
    return createPagedSeriesResults(this, pageData.items, pageData.hasMore, page);
  };

  ComicLand.prototype.getUncensoredSectionItems = async function(page) {
    var pageData = await this.fetchUncensoredPage(page);
    return createPagedSeriesResults(this, pageData.items, pageData.hasMore, page);
  };

  ComicLand.prototype.getRecommendedSectionItems = async function(page) {
    var pageData = await this.fetchRecommendedPage(page);
    return createPagedSeriesResults(this, pageData.items, pageData.hasMore, page);
  };

  ComicLand.prototype.fetchRecommendedPage = async function(page) {
    return this.fetchSeriesListPage(buildApiUrl("/comics", {
      offset: pageOffset(page, HOME_PAGE_SIZE),
      limit: HOME_PAGE_SIZE
    }), "list", HOME_PAGE_SIZE);
  };

  ComicLand.prototype.fetchNewestPage = async function(page) {
    return this.fetchSeriesListPage(buildApiUrl("/comics", {
      offset: pageOffset(page, HOME_PAGE_SIZE),
      limit: HOME_PAGE_SIZE,
      status: "ongoing"
    }), "list", HOME_PAGE_SIZE);
  };

  ComicLand.prototype.fetchUncensoredPage = async function(page) {
    return this.fetchSearchPage("uncensored", page, HOME_PAGE_SIZE);
  };

  ComicLand.prototype.fetchSearchPage = async function(queryValue, page, pageSize) {
    var payload = extractApiData(
      await this.fetchJson(buildApiUrl("/comic/search", {
        q: queryValue,
        offset: pageOffset(page, pageSize),
        limit: pageSize
      })),
      "/comic/search"
    );
    var items = Array.isArray(payload && payload.items) ? payload.items : [];

    return {
      items: items,
      hasMore: payload && payload.has_more === true || items.length >= toPositiveInteger(pageSize, SEARCH_PAGE_SIZE)
    };
  };

  ComicLand.prototype.browseGenreSeries = async function(genreName, page) {
    var payload = extractApiData(
      await this.fetchJson(buildApiUrl("/comics_by_genre", {
        name: genreName,
        offset: pageOffset(page, SEARCH_PAGE_SIZE),
        limit: SEARCH_PAGE_SIZE
      })),
      "/comics_by_genre"
    );
    var items = Array.isArray(payload && payload.list) ? payload.list : [];

    return createPagedSeriesResults(this, items, items.length >= SEARCH_PAGE_SIZE, page);
  };

  ComicLand.prototype.browseCreatorSeries = async function(taxonomyKind, creatorName, page) {
    // ComicLand distinguishes authors and artists in detail payloads/UI labels,
    // but both route through the same /creator/... page and API endpoint.
    if (taxonomyKind !== "author" && taxonomyKind !== "artist") {
      throw new Error("ComicLand received an unsupported creator taxonomy: " + taxonomyKind + ".");
    }

    var payload = extractApiData(
      await this.fetchJson(buildApiUrl("/comics_by_creator", {
        name: creatorName
      })),
      "/comics_by_creator"
    );
    var items = normalizeSeriesItems(payload && payload.list);
    var start = pageOffset(page, SEARCH_PAGE_SIZE);
    var end = start + SEARCH_PAGE_SIZE;

    return createPagedSeriesResults(this, items.slice(start, end), end < items.length, page);
  };

  ComicLand.prototype.fetchSeriesListPage = async function(url, listField, pageSize) {
    var payload = extractApiData(await this.fetchJson(url), "/comics");
    var items = Array.isArray(payload && payload[listField]) ? payload[listField] : [];

    return {
      items: items,
      hasMore: items.length >= toPositiveInteger(pageSize, HOME_PAGE_SIZE)
    };
  };

  ComicLand.prototype.fetchSeriesDetails = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "").toLowerCase();

    if (cacheKey.length === 0) {
      throw new Error("ComicLand received an empty series id.");
    }

    if (!this.cachedSeriesDetailsPromises[cacheKey]) {
      this.cachedSeriesDetailsPromises[cacheKey] = (async function() {
        var details = extractApiData(
          await this.fetchJson(buildApiUrl("/comic/detail", {
            slug: seriesId
          })),
          "/comic/detail"
        );

        if (!isSeriesDetails(details)) {
          throw new Error("ComicLand did not return a readable series payload for " + seriesId + ".");
        }

        return details;
      }.bind(this))();
    }

    try {
      return await this.cachedSeriesDetailsPromises[cacheKey];
    } catch (error) {
      delete this.cachedSeriesDetailsPromises[cacheKey];
      throw error;
    }
  };

  ComicLand.prototype.getSeriesCardSubtitle = async function(item, showLatestChapterSubtitles) {
    var subtitle = buildSeriesSubtitle(item, showLatestChapterSubtitles);
    var slug = cleanText(item && item.slug || "");
    var cacheKey = slug.toLowerCase();

    if (subtitle !== void 0 || cacheKey.length === 0 || showLatestChapterSubtitles !== true) {
      return subtitle;
    }

    if (!this.cachedSeriesCardSubtitlePromises[cacheKey]) {
      this.cachedSeriesCardSubtitlePromises[cacheKey] = this.fetchSeriesDetails(slug).then(function(details) {
        return buildSeriesSubtitle(details, true);
      }).catch(function() {
        delete this.cachedSeriesCardSubtitlePromises[cacheKey];
        return buildLegacySeriesSubtitle(item);
      }.bind(this));
    }

    return this.cachedSeriesCardSubtitlePromises[cacheKey];
  };

  ComicLand.prototype.fetchChapterPages = async function(seriesId, chapterId) {
    return extractApiData(
      await this.fetchJson(buildApiUrl("/chapter/pages_by_index", {
        slug: seriesId,
        index: chapterId
      })),
      "/chapter/pages_by_index"
    );
  };

  ComicLand.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
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
      throw new Error("ComicLand returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("ComicLand returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested ComicLand page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("ComicLand returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
    }
  }

  function extractApiData(payload, label) {
    if (!isObject(payload)) {
      throw new Error("ComicLand returned an invalid API payload from " + label + ".");
    }

    if ("code" in payload && toNumber(payload.code, -1) !== 0) {
      throw new Error("ComicLand API error from " + label + ": " + cleanText(payload.message || "Unknown error") + ".");
    }

    return payload.data;
  }

  function isChallengePage(body) {
    var lower = String(body || "").toLowerCase();
    return lower.indexOf("<html") !== -1 &&
      lower.indexOf("cloudflare") !== -1 &&
      lower.indexOf("challenge") !== -1;
  }

  function buildDiagnosticPreview(body) {
    var preview = cleanText(String(body || "").slice(0, 120));
    if (preview.length === 0) {
      return "";
    }
    return ' Preview: "' + preview.replace(/"/g, "'") + '"';
  }

  // Series / Card Helpers

  function createPartialSeries(item, subtitle) {
    return App.createPartialSourceManga({
      mangaId: String(item.slug || ""),
      title: cleanText(item.title || ""),
      image: String(item.cover_url || ""),
      subtitle: emptyToUndefined(subtitle)
    });
  }

  async function mapSeriesItems(source, items, showLatestChapterSubtitles) {
    return Promise.all(normalizeSeriesItems(items).map(async function(item) {
      return createPartialSeries(item, await source.getSeriesCardSubtitle(item, showLatestChapterSubtitles));
    }));
  }

  async function createPagedSeriesResults(source, items, hasMore, page) {
    var showLatestChapterSubtitles = await getShowLatestChapterSubtitles(source.stateManager);

    return App.createPagedResults({
      results: await mapSeriesItems(source, items, showLatestChapterSubtitles),
      metadata: hasMore ? { page: toPositiveInteger(page, 1) + 1 } : void 0
    });
  }

  function normalizeSeriesItems(items) {
    var seen = {};
    var ordered = [];

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var slug;

      if (!isObject(item)) {
        return;
      }

      slug = cleanText(item.slug || "");
      if (slug.length === 0 || cleanText(item.title || "").length === 0 || seen[slug.toLowerCase()]) {
        return;
      }

      seen[slug.toLowerCase()] = true;
      ordered.push(item);
    });

    return ordered;
  }

  function buildSeriesSubtitle(item, showLatestChapterSubtitles) {
    if (showLatestChapterSubtitles === true) {
      var latestChapter = getLatestChapterEntry(item && item.chapters);
      if (latestChapter) {
        return buildChapterName(latestChapter, toNumber(latestChapter.chapter_index, 0));
      }

      var chapterCount = toPositiveInteger(item && item.chapter_count, 0);
      if (chapterCount > 0) {
        return buildChapterNumberLabel(chapterCount);
      }

      return void 0;
    }

    return buildLegacySeriesSubtitle(item);
  }

  function buildLegacySeriesSubtitle(item) {
    var chapterCount = toPositiveInteger(item && item.chapter_count, 0);
    if (chapterCount > 0) {
      return chapterCount + (chapterCount === 1 ? " chapter" : " chapters");
    }

    var rating = toNumber(item && item.rating, NaN);
    if (isFinite(rating) && rating > 0) {
      return rating.toFixed(2) + "/5";
    }

    return emptyToUndefined(item && item.source);
  }

  // Homepage Helpers

  function createHomeSection(id, title, pagedResults) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: "singleRowNormal",
      items: Array.isArray(pagedResults && pagedResults.results) ? pagedResults.results : [],
      containsMoreItems: pagedResults && pagedResults.metadata !== void 0
    });
  }

  // Search / Filter Helpers

  function extractSearchFilters(query) {
    var filters = {
      taxonomyKind: void 0,
      taxonomyValue: void 0
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];

    includedTags.some(function(tag) {
      var tagId = String(tag && tag.id || "");

      if (tagId.indexOf(TAG_PREFIX_GENRE) === 0) {
        filters.taxonomyKind = "genre";
        filters.taxonomyValue = decodeTagValue(tagId.slice(TAG_PREFIX_GENRE.length));
        return filters.taxonomyValue.length > 0;
      }

      if (tagId.indexOf(TAG_PREFIX_AUTHOR) === 0) {
        filters.taxonomyKind = "author";
        filters.taxonomyValue = decodeTagValue(tagId.slice(TAG_PREFIX_AUTHOR.length));
        return filters.taxonomyValue.length > 0;
      }

      if (tagId.indexOf(TAG_PREFIX_ARTIST) === 0) {
        filters.taxonomyKind = "artist";
        filters.taxonomyValue = decodeTagValue(tagId.slice(TAG_PREFIX_ARTIST.length));
        return filters.taxonomyValue.length > 0;
      }

      return false;
    });

    if (cleanText(filters.taxonomyValue).length === 0) {
      filters.taxonomyKind = void 0;
      filters.taxonomyValue = void 0;
    }

    return filters;
  }

  function decodeTagValue(value) {
    var raw = String(value || "");
    if (raw.length === 0) {
      return "";
    }

    try {
      return cleanText(decodeURIComponent(raw));
    } catch (error) {
      return cleanText(raw);
    }
  }

  // Detail Helpers

  function buildTitles(title, alternativeTitles) {
    var titles = [];

    appendUniqueTitle(titles, title);

    (Array.isArray(alternativeTitles) ? alternativeTitles : []).forEach(function(alternativeTitle) {
      appendUniqueTitle(titles, alternativeTitle);
    });

    return titles.length > 0 ? titles : [""];
  }

  function appendUniqueTitle(titles, value) {
    var clean = cleanText(value || "");
    if (clean.length > 0 && titles.indexOf(clean) === -1) {
      titles.push(clean);
    }
  }

  function buildDetailTagSections(details) {
    var sections = [];
    var genres = normalizeGenreTagEntries(details && details.genres);
    var authors = normalizeTagEntries(details && details.authors);
    var artists = normalizeTagEntries(details && details.artists);

    if (genres.length > 0) {
      sections.push(createTagSection("genres", "Genres", TAG_PREFIX_GENRE, genres));
    }

    if (authors.length > 0) {
      sections.push(createTagSection("authors", "Authors", TAG_PREFIX_AUTHOR, authors, "Author"));
    }

    if (artists.length > 0) {
      sections.push(createTagSection("artists", "Artists", TAG_PREFIX_ARTIST, artists, "Artist"));
    }

    return sections;
  }

  function createTagSection(id, label, prefix, tags, tagLabelPrefix) {
    return App.createTagSection({
      id: id,
      label: label,
      tags: tags.map(function(tag) {
        return App.createTag({
          id: prefix + tag.id,
          label: formatTagLabel(tag.label, tagLabelPrefix)
        });
      })
    });
  }

  function formatTagLabel(label, prefix) {
    var cleanLabel = cleanText(label || "");
    var cleanPrefix = cleanText(prefix || "");

    if (cleanLabel.length === 0) {
      return "";
    }

    if (cleanPrefix.length === 0) {
      return cleanLabel;
    }

    return cleanPrefix + ": " + cleanLabel;
  }

  function normalizeTagEntries(entries) {
    var deduped = {};

    (Array.isArray(entries) ? entries : []).forEach(function(entry) {
      if (!isObject(entry)) {
        return;
      }

      var id = cleanText(entry.slug || entry.name || entry.id || "");
      var label = cleanText(entry.name || entry.label || entry.slug || "");
      if (id.length === 0 || label.length === 0) {
        return;
      }

      deduped[id.toLowerCase()] = {
        id: id,
        label: label
      };
    });

    return Object.keys(deduped).map(function(key) {
      return deduped[key];
    }).sort(function(left, right) {
      return left.label.localeCompare(right.label);
    });
  }

  function normalizeGenreTagEntries(entries) {
    return normalizeTagEntries(entries).map(function(entry) {
      var label = normalizeGenreLabel(entry && entry.label);
      if (label.length === 0) {
        return null;
      }

      return {
        id: entry.id,
        label: label
      };
    }).filter(Boolean);
  }

  function normalizeGenreLabel(value) {
    var rawLabel = cleanText(String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, ""));
    var key;

    if (rawLabel.length === 0) {
      return "";
    }

    key = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (Object.prototype.hasOwnProperty.call(GENRE_LABEL_OVERRIDES, key)) {
      return GENRE_LABEL_OVERRIDES[key];
    }

    return rawLabel;
  }

  function joinContributorNames(entries) {
    return normalizeTagEntries(entries).map(function(entry) {
      return entry.label;
    }).join(", ");
  }

  function mapStatus(status) {
    var value = cleanText(status || "").toUpperCase();
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  function isSeriesDetails(details) {
    return isObject(details) &&
      cleanText(details.slug || "").length > 0 &&
      cleanText(details.title || "").length > 0;
  }

  // Chapter Helpers

  function normalizeChapterEntries(chapters) {
    var seen = {};
    var ordered = [];

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      var chapterIndex = toPositiveInteger(chapter && chapter.chapter_index, 0);

      if (!isObject(chapter) || chapterIndex === 0 || seen[chapterIndex]) {
        return;
      }

      seen[chapterIndex] = true;
      ordered.push(chapter);
    });

    return ordered;
  }

  function compareChapterEntriesDesc(left, right) {
    return toNumber(right && right.chapter_index, 0) - toNumber(left && left.chapter_index, 0);
  }

  function getLatestChapterEntry(chapters) {
    var latestChapter = void 0;
    var latestChapterNumber = 0;

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      var chapterNumber = toNumber(chapter && chapter.chapter_index, 0);

      if (!isObject(chapter) || chapterNumber <= latestChapterNumber) {
        return;
      }

      latestChapter = chapter;
      latestChapterNumber = chapterNumber;
    });

    return latestChapter;
  }

  function buildChapterNumberLabel(chapterNumber) {
    var number = toNumber(chapterNumber, 0);
    return number > 0 ? "Chapter " + number : void 0;
  }

  async function getShowLatestChapterSubtitles(stateManager) {
    if (!stateManager) {
      return false;
    }

    return (await stateManager.retrieve(STATE_SHOW_LATEST_CHAPTER_SUBTITLES)) === true;
  }

  function buildChapterName(chapter, chapterNumber) {
    var title = cleanText(chapter && chapter.title || "");
    if (title.length > 0) {
      return title;
    }
    return "Chapter " + chapterNumber;
  }

  // Generic Utilities

  function buildApiUrl(path, params) {
    return API_BASE + path + buildQueryString(params);
  }

  function buildQueryString(params) {
    var queryParts = [];

    Object.keys(params || {}).forEach(function(key) {
      var value = params[key];
      if (value === void 0 || value === null || value === "") {
        return;
      }
      queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });

    return queryParts.length > 0 ? "?" + queryParts.join("&") : "";
  }

  function pageOffset(page, pageSize) {
    return Math.max(0, (toPositiveInteger(page, 1) - 1) * toPositiveInteger(pageSize, HOME_PAGE_SIZE));
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

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || ""));
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : fallback;
  }

  function toPositiveInteger(value, fallback) {
    var parsed = Math.floor(toNumber(value, fallback));
    return parsed > 0 ? parsed : fallback;
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
    ComicLandInfo: ComicLandInfo,
    ComicLand: ComicLand
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
