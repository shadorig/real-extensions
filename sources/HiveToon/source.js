"use strict";

(function() {
  // Constants

  var DOMAIN = "https://hivetoons.org";
  var API_BASE = "https://api.hivetoons.org/api";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var SEARCH_PER_PAGE = 24;
  var HOME_FEATURED_PER_PAGE = 12;
  var HOME_FEATURED_GENRE_LIMIT = 5;
  var HOME_POPULAR_PER_PAGE = 12;
  var HOME_LATEST_PER_PAGE = 24;
  var FILTER_DATA_CACHE_MS = 5 * 60 * 1000;
  var SERIES_PAYLOAD_CACHE_MS = 60 * 1000;
  var SERIES_PAYLOAD_CACHE_LIMIT = 16;
  var ARCHIVE_DEFAULT_SERIES_TYPES = "MANGA,MANHWA,MANHUA";
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_releases";
  var STATE_LATEST_RELEASES_VIEW = "latest_releases_view";
  var LATEST_RELEASES_VIEW_LATEST = "latest";
  var LATEST_RELEASES_VIEW_NEW = "new";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var SEARCH_FIELD_MAX_CHAPTERS = "max_chapters";
  var SEARCH_FIELD_CREATED_AFTER = "created_after";
  var SEARCH_FIELD_CREATED_BEFORE = "created_before";
  var SEARCH_TAG_PREFIX_GENRE = "genre:";
  var SEARCH_TAG_PREFIX_STATUS = "status:";
  var SEARCH_TAG_PREFIX_TYPE = "type:";
  var SEARCH_TAG_PREFIX_SALE = "sale:";
  var SEARCH_TAG_PREFIX_SORT = "sort:";
  var SEARCH_TAG_PREFIX_ORDER = "order:";
  var LATEST_RELEASES_VIEW_OPTIONS = [
    { id: LATEST_RELEASES_VIEW_LATEST, label: "Latest" },
    { id: LATEST_RELEASES_VIEW_NEW, label: "New" }
  ];
  var SEARCH_STATUS_OPTIONS = [
    { id: "ONGOING", label: "Ongoing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "DROPPED", label: "Dropped" },
    { id: "MASS_RELEASED", label: "Mass Released" },
    { id: "COMING_SOON", label: "Coming Soon" },
    { id: "ONE_SHOT", label: "One Shot" },
    { id: "HIATUS", label: "Hiatus" }
  ];
  var SEARCH_TYPE_OPTIONS = [
    { id: "MANGA", label: "Manga" },
    { id: "MANHWA", label: "Manhwa" },
    { id: "MANHUA", label: "Manhua" }
  ];
  var SEARCH_SALE_OPTIONS = [
    { id: "active", label: "On Sale" },
    { id: "inactive", label: "Full Price" }
  ];
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
    "actionfantasy": "Action Fantasy",
    "archer": "Archer",
    "demon king shit": "Demon King"
  };

  // Source Info

  var HiveToonInfo = {
    version: "1.1.0",
    name: "HiveToon",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function HiveToon() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
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
    this.cachedSeriesPayloads = {};
    this.cachedSeriesPayloadOrder = [];
    this.cachedSeriesPayloadRequests = {};
  }

  // Paperback Interface Methods

  HiveToon.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  HiveToon.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  HiveToon.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodePathSegment(seriesId);
  };

  HiveToon.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/" + encodePathSegment(chapterId);
  };

  HiveToon.prototype.getHomePageSections = async function(sectionCallback) {
    var latestReleasesView = await getLatestReleasesView(this.stateManager);
    var results = await Promise.allSettled([
      this.fetchText(DOMAIN),
      this.getLatestSectionItems(1, latestReleasesView)
    ]);
    var homeData = {
      featured: [],
      popularToday: []
    };
    var latestResults = App.createPagedResults({ results: [] });
    var latestError;

    if (results[0] && results[0].status === "fulfilled") {
      homeData = extractHomePageData(results[0].value);
    }

    if (results[1] && results[1].status === "fulfilled") {
      latestResults = results[1].value;
    } else {
      latestError = results[1] && results[1].reason;
    }
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
        "Most Popular",
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
      )
    ];

    var visibleSections = sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    });

    visibleSections.forEach(function(section) {
      sectionCallback(section);
    });

    if (visibleSections.length === 0) {
      throw latestError || (results[0] && results[0].reason) || new Error("Unable to load HiveToon homepage sections.");
    }
  };

  HiveToon.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(
      toPositiveInteger(metadata && metadata.page, 1),
      await getLatestReleasesView(this.stateManager)
    );
  };

  HiveToon.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  HiveToon.prototype.getSourceMenu = async function() {
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
          App.createDUISelect({
            id: STATE_LATEST_RELEASES_VIEW,
            label: "Latest Releases View",
            options: LATEST_RELEASES_VIEW_OPTIONS.map(function(option) {
              return option.id;
            }),
            allowsMultiselect: false,
            labelResolver: async function(value) {
              return getLatestReleasesViewLabel(value);
            },
            value: App.createDUIBinding({
              get: async function() {
                return getLatestReleasesViewSelection(await getLatestReleasesView(stateManager));
              },
              set: async function(newValue) {
                await stateManager.store(STATE_LATEST_RELEASES_VIEW, normalizeLatestReleasesView(newValue));
              }
            })
          })
        ];
      }
    });
  };

  HiveToon.prototype.supportsTagExclusion = async function() {
    // Paperback exposes exclusion source-wide. HiveToon only provides a real
    // excludedGenreIds backend filter, so non-genre exclusions are ignored.
    return true;
  };

  HiveToon.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchFilterData());
  };

  HiveToon.prototype.getSearchFields = async function() {
    return [
      createSearchField(SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters", "e.g. 10"),
      createSearchField(SEARCH_FIELD_MAX_CHAPTERS, "Maximum Chapters", "e.g. 100"),
      createSearchField(SEARCH_FIELD_CREATED_AFTER, "Created After", "YYYY-MM-DD"),
      createSearchField(SEARCH_FIELD_CREATED_BEFORE, "Created Before", "YYYY-MM-DD")
    ];
  };

  HiveToon.prototype.getMangaDetails = async function(seriesId) {
    var series = await this.fetchSeriesPayload(seriesId);

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

  HiveToon.prototype.getChapters = async function(seriesId) {
    var series = await this.fetchSeriesPayload(seriesId);
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
        time: getChapterDisplayDate(chapter),
        langCode: "en"
      });
    });

    if (visibleChapters.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return visibleChapters;
  };

  HiveToon.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var payload = await this.fetchJson(buildApiUrl("/chapter/content", {
      mangaslug: seriesId,
      chapterslug: chapterId
    }));

    if (!isObject(payload) || payload.isAccessible !== true) {
      throw new Error("This chapter is locked on HiveToon and cannot be loaded in Paperback.");
    }

    var images = Array.isArray(payload.images) ? payload.images.slice() : [];
    images.sort(function(left, right) {
      return toNumber(left && left.order, 0) - toNumber(right && right.order, 0);
    });

    var pages = images.map(function(image) {
      return cleanText(image && image.url || "");
    }).filter(function(url) {
      return url.length > 0;
    });

    if (pages.length === 0) {
      throw new Error("HiveToon did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  HiveToon.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var filters = extractSearchFilters(query);

    if (hasActiveSearchFilters(filters)) {
      return this.getArchiveSearchResults(title, filters, page);
    }

    return this.getTitleSearchResults(title, page);
  };

  // Source-Specific Fetch Helpers

  HiveToon.prototype.getLatestSectionItems = async function(page, view) {
    var resolvedPage = toPositiveInteger(page, 1);
    var latestPage = await this.fetchSectionPage(getLatestReleasesViewTag(view), resolvedPage, HOME_LATEST_PER_PAGE);
    return App.createPagedResults({
      results: mapHomeItems(latestPage.series),
      metadata: getNextPageMetadataFromCount(latestPage.totalCount, resolvedPage, HOME_LATEST_PER_PAGE, latestPage.pageCount)
    });
  };

  HiveToon.prototype.fetchFilterData = async function() {
    if (this.cachedFilterData && Date.now() < this.cachedFilterData.expiresAt) {
      return this.cachedFilterData.value;
    }

    var genres = await this.fetchJson(buildApiUrl("/genres"));
    var filterData = {
      genres: extractGenreOptions(genres),
      statuses: SEARCH_STATUS_OPTIONS,
      types: SEARCH_TYPE_OPTIONS
    };
    this.cachedFilterData = {
      value: filterData,
      expiresAt: Date.now() + FILTER_DATA_CACHE_MS
    };
    return filterData;
  };

  HiveToon.prototype.fetchSectionPage = async function(tag, page, perPage) {
    var response = await this.fetchJson(buildApiUrl("/posts", {
      page: toPositiveInteger(page, 1),
      perPage: toPositiveInteger(perPage, SEARCH_PER_PAGE),
      searchTerm: "",
      isNovel: false,
      tag: cleanText(tag || "")
    }));

    return {
      series: normalizeSeriesPayloads(response && response.posts),
      totalCount: toPositiveInteger(response && response.totalCount, 0),
      pageCount: Array.isArray(response && response.posts) ? response.posts.length : 0
    };
  };

  HiveToon.prototype.getTitleSearchResults = async function(title, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var response = await this.fetchJson(buildApiUrl("/posts", {
      page: resolvedPage,
      perPage: SEARCH_PER_PAGE,
      searchTerm: cleanText(title || ""),
      isNovel: false,
      tag: ""
    }));
    var pagePosts = Array.isArray(response && response.posts) ? response.posts : [];
    var series = normalizeSeriesPayloads(pagePosts);

    return App.createPagedResults({
      results: series.map(function(item) {
        return createPartialSeries(item, buildHomeSubtitle(item));
      }),
      metadata: getNextPageMetadataFromCount(response && response.totalCount, resolvedPage, SEARCH_PER_PAGE, pagePosts.length)
    });
  };

  HiveToon.prototype.getArchiveSearchResults = async function(title, filters, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var response = await this.fetchJson(buildApiUrl("/query", buildArchiveQueryParams(title, filters, resolvedPage, SEARCH_PER_PAGE)));
    var pagePosts = Array.isArray(response && response.posts) ? response.posts : [];
    var series = normalizeSeriesPayloads(pagePosts);

    return App.createPagedResults({
      results: series.map(function(item) {
        return createPartialSeries(item, buildHomeSubtitle(item));
      }),
      metadata: getNextPageMetadataFromCount(response && response.totalCount, resolvedPage, SEARCH_PER_PAGE, pagePosts.length)
    });
  };

  HiveToon.prototype.fetchSeriesPayload = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");
    if (cacheKey.length === 0) {
      throw new Error("HiveToon requires a series id.");
    }
    var cached = this.cachedSeriesPayloads[cacheKey];
    if (cached && Date.now() < cached.expiresAt && isObject(cached.value)) {
      touchCacheKey(this.cachedSeriesPayloadOrder, cacheKey);
      return cached.value;
    }

    if (!this.cachedSeriesPayloadRequests[cacheKey]) {
      this.cachedSeriesPayloadRequests[cacheKey] = (async function() {
        var payload = await this.fetchJson(buildApiUrl("/post", {
          postSlug: cacheKey
        }));
        var seriesPayload = isObject(payload && payload.post) ? payload.post : null;
        if (!isSeriesPayload(seriesPayload)) {
          throw new Error("Unable to decode the HiveToon series payload for " + seriesId + ".");
        }

        storeBoundedCacheEntry(
          this.cachedSeriesPayloads,
          this.cachedSeriesPayloadOrder,
          cacheKey,
          { value: seriesPayload, expiresAt: Date.now() + SERIES_PAYLOAD_CACHE_MS },
          SERIES_PAYLOAD_CACHE_LIMIT
        );
        return seriesPayload;
      }.bind(this))();
    }

    var request = this.cachedSeriesPayloadRequests[cacheKey];
    try {
      return await request;
    } finally {
      if (this.cachedSeriesPayloadRequests[cacheKey] === request) {
        delete this.cachedSeriesPayloadRequests[cacheKey];
      }
    }
  };

  HiveToon.prototype.fetchSeriesChapters = async function(series) {
    var seriesId = cleanText(series && series.slug);
    var seriesApiId = toPositiveInteger(series && series.id, 0);

    if (seriesId.length === 0 || seriesApiId <= 0) {
      throw new Error("HiveToon did not expose a valid series record for the chapter list.");
    }

    var payload = await this.fetchJson(buildApiUrl("/chapters", {
      postId: seriesApiId,
      skip: 0,
      take: "all",
      order: "desc"
    }));
    var chapters = payload && payload.post && payload.post.chapters;
    if (!Array.isArray(chapters)) {
      throw new Error("HiveToon did not expose a valid chapter payload for " + seriesId + ".");
    }

    return normalizeChapterEntries(chapters);
  };

  HiveToon.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  };

  HiveToon.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  // Site Parsing Helpers

  // HiveToon's current homepage mixes a custom featured-series payload with
  // server-rendered cards. Keep older Astro and Next payload paths as fallbacks
  // so a frontend rollback does not immediately remove homepage rows.
  function extractCurrentHeroPosts(html) {
    var source = String(html || "");
    var markerMatch = /\b(?:const|let|var)\s+hvtXHeroLibrary\s*=\s*/.exec(source);
    if (!markerMatch) {
      return [];
    }

    var items = extractJsonValueAtIndex(source, markerMatch.index + markerMatch[0].length);
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(function(item) {
      var slug = extractSeriesSlug(item && item.seriesUrl);
      var title = cleanText(item && (item.seriesTitle || item.title || item.name));
      if (slug.length === 0 || title.length === 0) {
        return null;
      }

      return {
        slug: slug,
        postTitle: title,
        featuredImage: cleanText(item.thumbnail || item.mobileImage || item.desktopImage || ""),
        seriesType: "MANHWA",
        genres: (Array.isArray(item.genres) ? item.genres : []).map(function(genre) {
          var name = cleanText(genre);
          return {
            id: normalizeSearchText(name).replace(/[^a-z0-9]+/g, "-"),
            name: name
          };
        }).filter(function(genre) {
          return genre.name.length > 0;
        })
      };
    }).filter(Boolean);
  }

  function extractCurrentMostPopularPosts(html) {
    var source = String(html || "");
    var headingMatch = /<h2\b[^>]*>\s*Most Popular\s*<\/h2>/i.exec(source);
    if (!headingMatch) {
      return [];
    }

    var headingIndex = headingMatch.index;
    var sectionStart = source.lastIndexOf("<section", headingIndex);
    var sectionEnd = source.indexOf("</section>", headingIndex);
    if (sectionStart === -1 || sectionEnd === -1 || sectionEnd <= sectionStart) {
      return [];
    }

    var sectionHtml = source.slice(sectionStart, sectionEnd + 10);
    var linkRegex = /<a\b[^>]*\bhref="\/series\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var posts = [];
    var match;

    while ((match = linkRegex.exec(sectionHtml)) !== null) {
      var slug = extractSeriesSlug("/series/" + decodeAstroPropsJson(match[1]));
      var imageTagMatch = match[2].match(/<img\b[^>]*>/i);
      var imageTag = imageTagMatch ? imageTagMatch[0] : "";
      var title = cleanText(decodeAstroPropsJson(extractHtmlAttribute(imageTag, "alt")));
      var image = cleanText(decodeAstroPropsJson(extractHtmlAttribute(imageTag, "src")));

      if (slug.length === 0 || title.length === 0) {
        continue;
      }

      posts.push({
        slug: slug,
        postTitle: title,
        featuredImage: image
      });
    }

    return normalizeSeriesPayloads(posts);
  }

  function extractHtmlAttribute(tag, attributeName) {
    var pattern = new RegExp("\\b" + attributeName + "=\\\"([^\\\"]*)\\\"", "i");
    var match = pattern.exec(String(tag || ""));
    return match ? match[1] : "";
  }

  function extractSeriesSlug(value) {
    var url = cleanText(decodeAstroPropsJson(value || ""));
    var marker = "/series/";
    var markerIndex = url.toLowerCase().indexOf(marker);
    var slug = markerIndex >= 0 ? url.slice(markerIndex + marker.length) : url;
    slug = slug.split(/[/?#]/)[0];
    if (slug.length === 0 || slug.indexOf(":") !== -1) {
      return "";
    }

    try {
      return decodeURIComponent(slug);
    } catch (error) {
      return slug;
    }
  }

  function extractAstroPropsObjects(html) {
    var propsObjects = [];
    var propsRegex = /<astro-island\b[^>]*\sprops="([^"]*)"/g;
    var match;

    while ((match = propsRegex.exec(String(html || ""))) !== null) {
      try {
        propsObjects.push(decodeAstroObject(JSON.parse(decodeAstroPropsJson(match[1]))));
      } catch (error) {
      }
    }

    return propsObjects;
  }

  function findAstroPropsArray(propsObjects, key) {
    for (var index = 0; index < propsObjects.length; index += 1) {
      var value = propsObjects[index] && propsObjects[index][key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  function decodeAstroPropsJson(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, function(match, code) {
        return safeCodePoint(parseInt(code, 10));
      })
      .replace(/&#x([0-9a-f]+);/gi, function(match, code) {
        return safeCodePoint(parseInt(code, 16));
      })
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function decodeAstroObject(value) {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(decodeAstroSerializedValue);
    }

    var decoded = {};
    Object.keys(value).forEach(function(key) {
      decoded[key] = decodeAstroSerializedValue(value[key]);
    });
    return decoded;
  }

  function decodeAstroSerializedValue(value) {
    if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== "number") {
      return decodeAstroObject(value);
    }

    var tag = value[0];
    var payload = value[1];

    if (tag === 0) {
      return decodeAstroObject(payload);
    }
    if (tag === 1) {
      return Array.isArray(payload) ? payload.map(decodeAstroSerializedValue) : [];
    }
    if (tag === 3) {
      return new Date(payload);
    }

    return value.map(decodeAstroSerializedValue);
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

  function decodeNextFlightChunks(html) {
    var chunks = [];
    var scriptRegex = /self\.__next_f\.push\(\[1,("(?:(?:\\.|[^"\\])*)")\]\)<\/script>/g;
    var match;

    while ((match = scriptRegex.exec(String(html || ""))) !== null) {
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
        } else if (character === "\"") {
          inString = false;
        }
        continue;
      }

      if (character === "\"") {
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

  // Response Helpers

  function parseJsonResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : "";
    ensureSuccessfulResponse(response, raw, url);

    if (isObject(response.data)) {
      return response.data;
    }

    try {
      return JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("HiveToon returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureSuccessfulResponse(response, raw, url);
    return raw;
  }

  function ensureSuccessfulResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("HiveToon returned an invalid response from " + formatRequestLabel(url) + ".");
    }
    if (response.status === 403 || response.status === 503 || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }
    if (response.status === 404) {
      throw new Error("The requested HiveToon page was not found.");
    }
    if (response.status >= 400) {
      throw new Error("HiveToon returned HTTP " + response.status + " from " + formatRequestLabel(url) + ".");
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

  function getNextPageMetadataFromCount(totalCount, currentPage, perPage, currentCount) {
    var resolvedTotalCount = toPositiveInteger(totalCount, 0);
    var resolvedCurrentCount = toPositiveInteger(currentCount, 0);
    var resolvedPerPage = toPositiveInteger(perPage, 0);
    if (resolvedPerPage === 0 || resolvedCurrentCount < resolvedPerPage) {
      return void 0;
    }

    if (resolvedTotalCount === 0 || resolvedTotalCount > currentPage * resolvedPerPage) {
      return {
        page: currentPage + 1
      };
    }

    return void 0;
  }

  // Homepage Helpers

  function extractHomePageData(html) {
    var currentFeaturedPosts = extractCurrentHeroPosts(html);
    var currentPopularPosts = extractCurrentMostPopularPosts(html);
    var astroPropsObjects = extractAstroPropsObjects(html);
    var featuredPosts = findAstroPropsArray(astroPropsObjects, "sliderPosts");
    var popularPosts = findAstroPropsArray(astroPropsObjects, "posts");
    var flightChunks;

    if (featuredPosts.length === 0 || popularPosts.length === 0) {
      flightChunks = decodeNextFlightChunks(html);
    }

    if (featuredPosts.length === 0) {
      featuredPosts = extractFlightArrayValue(flightChunks || [], "sliderPosts");
    }
    if (popularPosts.length === 0) {
      popularPosts = extractFlightArrayValue(flightChunks || [], "popularPosts");
    }

    return {
      featured: mapFeaturedHomeItems(currentFeaturedPosts.length > 0 ? currentFeaturedPosts : featuredPosts),
      popularToday: mapHomeItems(currentPopularPosts.length > 0 ? currentPopularPosts : popularPosts, false)
    };
  }

  function createHomeSection(id, title, type, items, containsMoreItems) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: type,
      items: items,
      containsMoreItems: containsMoreItems
    });
  }

  function mapHomeItems(seriesList, includeSubtitle) {
    var shouldIncludeSubtitle = includeSubtitle !== false;
    return normalizeSeriesPayloads(seriesList).map(function(series) {
      return createPartialSeries(series, shouldIncludeSubtitle ? buildHomeSubtitle(series) : void 0);
    });
  }

  function mapFeaturedHomeItems(seriesList) {
    return normalizeSeriesPayloads(seriesList).map(function(series) {
      return createPartialSeries(series, buildFeaturedGenreSubtitle(series));
    });
  }

  function buildFeaturedGenreSubtitle(series) {
    var labels = [];
    var seen = {};

    (Array.isArray(series && series.genres) ? series.genres : []).forEach(function(genre) {
      var label = formatGenreLabel(isObject(genre) ? genre.name || genre.label || "" : genre);
      var key = normalizeSearchText(label);

      if (label.length === 0 || key.length === 0 || seen[key] || labels.length >= HOME_FEATURED_GENRE_LIMIT) {
        return;
      }

      seen[key] = true;
      labels.push(label);
    });

    return labels.join(" \u00b7 ");
  }

  function buildHomeSubtitle(series) {
    var latestChapter = findFirstChapterPreview(series && series.chapters);
    if (latestChapter) {
      return buildChapterListName(latestChapter, toChapterNumber(latestChapter.number, 0));
    }

    var statusLabel = formatOptionLabel(series && series.seriesStatus);
    return statusLabel.length > 0 ? statusLabel : void 0;
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

    sections.push(App.createTagSection({
      id: "availability",
      label: "Availability",
      tags: SEARCH_SALE_OPTIONS.map(function(option) {
        return App.createTag({
          id: SEARCH_TAG_PREFIX_SALE + option.id,
          label: option.label
        });
      })
    }));

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
      excludedGenres: [],
      status: void 0,
      type: void 0,
      saleFilter: void 0,
      minChapters: extractPositiveIntegerSearchFieldValue(query, SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters"),
      maxChapters: extractPositiveIntegerSearchFieldValue(query, SEARCH_FIELD_MAX_CHAPTERS, "Maximum Chapters"),
      createdAfter: extractDateSearchFieldValue(query, SEARCH_FIELD_CREATED_AFTER, "Created After"),
      createdBefore: extractDateSearchFieldValue(query, SEARCH_FIELD_CREATED_BEFORE, "Created Before"),
      sortBy: void 0,
      sortDirection: void 0
    };
    var seenGenres = {};
    var seenExcludedGenres = {};
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];
    var excludedTags = Array.isArray(query && query.excludedTags) ? query.excludedTags : [];

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
        var status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
        if (hasFilterOption(SEARCH_STATUS_OPTIONS, status)) {
          filters.status = status;
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0 && filters.type === void 0) {
        var type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
        if (hasFilterOption(SEARCH_TYPE_OPTIONS, type)) {
          filters.type = type;
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_SALE) === 0 && filters.saleFilter === void 0) {
        var saleFilter = tagId.slice(SEARCH_TAG_PREFIX_SALE.length);
        if (hasFilterOption(SEARCH_SALE_OPTIONS, saleFilter)) {
          filters.saleFilter = saleFilter;
        }
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

    excludedTags.forEach(function(tag) {
      var tagId = String(tag && tag.id || "");
      if (tagId.indexOf(SEARCH_TAG_PREFIX_GENRE) !== 0) {
        return;
      }

      var genreId = tagId.slice(SEARCH_TAG_PREFIX_GENRE.length);
      if (genreId.length > 0 && !seenExcludedGenres[genreId]) {
        seenExcludedGenres[genreId] = true;
        filters.excludedGenres.push(genreId);
      }
    });

    if (filters.minChapters !== void 0 && filters.maxChapters !== void 0 && filters.minChapters > filters.maxChapters) {
      throw new Error("Minimum Chapters cannot be greater than Maximum Chapters.");
    }
    if (filters.createdAfter && filters.createdBefore && filters.createdAfter > filters.createdBefore) {
      throw new Error("Created After cannot be later than Created Before.");
    }

    return filters;
  }

  function hasActiveSearchFilters(filters) {
    if (!filters || !isObject(filters)) {
      return false;
    }

    return (Array.isArray(filters.genres) && filters.genres.length > 0) ||
      (Array.isArray(filters.excludedGenres) && filters.excludedGenres.length > 0) ||
      cleanText(filters.status).length > 0 ||
      cleanText(filters.type).length > 0 ||
      cleanText(filters.saleFilter).length > 0 ||
      toPositiveInteger(filters.minChapters, 0) > 0 ||
      toPositiveInteger(filters.maxChapters, 0) > 0 ||
      cleanText(filters.createdAfter).length > 0 ||
      cleanText(filters.createdBefore).length > 0 ||
      hasArchiveSort(filters);
  }

  function hasArchiveSort(filters) {
    return cleanText(filters && filters.sortBy).length > 0 ||
      cleanText(filters && filters.sortDirection).length > 0;
  }

  function buildArchiveQueryParams(title, filters, page, perPage) {
    var sortOption = getArchiveSortOption(filters && filters.sortBy) || getArchiveSortOption("latest_chapters");
    var minChapters = toPositiveInteger(filters && filters.minChapters, 0);
    var maxChapters = toPositiveInteger(filters && filters.maxChapters, 0);
    var params = {
      page: toPositiveInteger(page, 1),
      perPage: toPositiveInteger(perPage, SEARCH_PER_PAGE),
      view: "archive",
      seriesType: cleanText(filters && filters.type) || ARCHIVE_DEFAULT_SERIES_TYPES,
      orderBy: sortOption.orderBy,
      orderDirection: getArchiveOrderDirection(filters && filters.sortDirection, sortOption.defaultDirection)
    };
    var searchTerm = cleanText(title || "");
    var genreIds = Array.isArray(filters && filters.genres) ? filters.genres : [];
    var excludedGenreIds = Array.isArray(filters && filters.excludedGenres) ? filters.excludedGenres : [];
    var seriesStatus = cleanText(filters && filters.status);
    var saleFilter = cleanText(filters && filters.saleFilter);
    var createdAfter = cleanText(filters && filters.createdAfter);
    var createdBefore = cleanText(filters && filters.createdBefore);

    if (searchTerm.length > 0) {
      params.searchTerm = searchTerm;
    }
    if (genreIds.length > 0) {
      params.genreIds = genreIds.join(",");
    }
    if (excludedGenreIds.length > 0) {
      params.excludedGenreIds = excludedGenreIds.join(",");
    }
    if (seriesStatus.length > 0) {
      params.seriesStatus = seriesStatus;
    }
    if (saleFilter.length > 0) {
      params.saleFilter = saleFilter;
    }
    if (minChapters > 0) {
      params.minChapters = minChapters;
    }
    if (maxChapters > 0) {
      params.maxChapters = maxChapters;
    }
    if (createdAfter.length > 0) {
      params.createdAfter = createdAfter;
    }
    if (createdBefore.length > 0) {
      params.createdBefore = createdBefore;
    }

    return params;
  }

  function createSearchField(id, name, placeholder) {
    var field = {
      id: id,
      name: name,
      placeholder: placeholder
    };
    return typeof App !== "undefined" && App && typeof App.createSearchField === "function" ? App.createSearchField(field) : field;
  }

  function extractSearchFieldValue(query, fieldId) {
    var parameters = isObject(query && query.parameters) ? query.parameters : {};
    var values = Array.isArray(parameters[fieldId]) ? parameters[fieldId] : [];
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
    return rawValue;
  }

  function extractPositiveIntegerSearchFieldValue(query, fieldId, fieldLabel) {
    var rawValue = extractSearchFieldValue(query, fieldId);
    if (rawValue === void 0) {
      return void 0;
    }
    if (!/^\d+$/.test(rawValue)) {
      throw new Error(fieldLabel + " must be a positive whole number.");
    }

    var value = parseInt(rawValue, 10);
    if (!isFinite(value) || value <= 0) {
      throw new Error(fieldLabel + " must be a positive whole number.");
    }

    return value;
  }

  function extractDateSearchFieldValue(query, fieldId, fieldLabel) {
    var rawValue = extractSearchFieldValue(query, fieldId);
    if (rawValue === void 0) {
      return void 0;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      throw new Error(fieldLabel + " must use YYYY-MM-DD format.");
    }

    var parsed = new Date(rawValue + "T00:00:00.000Z");
    if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== rawValue) {
      throw new Error(fieldLabel + " must be a valid date in YYYY-MM-DD format.");
    }

    return rawValue;
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

  function extractGenreOptions(genres) {
    var deduped = {};

    (Array.isArray(genres) ? genres : []).forEach(function(genre) {
      var id = cleanText(genre && genre.id);
      var label = cleanText(genre && genre.name);
      if (id.length === 0 || label.length === 0) {
        return;
      }
      if (!deduped[id]) {
        deduped[id] = {
          id: id,
          label: formatGenreLabel(label)
        };
      }
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

  function hasFilterOption(options, id) {
    return (Array.isArray(options) ? options : []).some(function(option) {
      return cleanText(option && option.id) === id;
    });
  }

  // Detail Helpers

  function buildDetailTagSections(series) {
    var sections = [];
    var deduped = {};
    var genreTags = [];
    var metadataTags = [];
    var statusId = cleanText(series && series.seriesStatus).toUpperCase();
    var statusLabel = formatOptionLabel(statusId);
    var typeId = cleanText(series && series.seriesType).toUpperCase();
    var typeLabel = formatOptionLabel(typeId);

    if (statusId.length > 0 && statusLabel.length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_STATUS + statusId,
        label: "Status: " + statusLabel
      }));
    }

    if (typeId.length > 0 && typeLabel.length > 0) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_TYPE + typeId,
        label: "Type: " + typeLabel
      }));
    }

    addDetailMetadataTag(metadataTags, "released", "Released", series && series.releaseDate);
    addDetailMetadataTag(metadataTags, "studio", "Studio", series && series.studio);
    addDetailMetadataTag(metadataTags, "chapters", "Chapters", formatCount(series && series._count && series._count.chapters));
    addDetailMetadataTag(metadataTags, "added", "Added", formatDateMetadata(series && series.createdAt));
    addDetailMetadataTag(metadataTags, "last-chapter", "Last Chapter", formatDateMetadata(series && series.lastChapterAddedAt));
    addDetailMetadataTag(metadataTags, "views", "Views", formatCount(series && series.totalViews));
    addDetailMetadataTag(metadataTags, "bookmarks", "Bookmarks", formatCount(series && series._count && series._count.bookmarks));
    addDetailMetadataTag(metadataTags, "sale", "Sale", formatSaleMetadata(series));

    (Array.isArray(series && series.genres) ? series.genres : []).forEach(function(genre) {
      var id = cleanText(genre && genre.id);
      var label = formatGenreLabel(genre && genre.name);
      if (id.length === 0 || label.length === 0 || deduped[id]) {
        return;
      }

      deduped[id] = true;
      genreTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_GENRE + id,
        label: label
      }));
    });

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

  function addDetailMetadataTag(tags, id, label, value) {
    var clean = cleanText(value);
    if (clean.length === 0) {
      return;
    }
    tags.push(App.createTag({
      id: id + ":" + normalizeSearchText(clean).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      label: label + ": " + clean
    }));
  }

  function formatCount(value) {
    if (value === null || value === void 0 || cleanText(value).length === 0) {
      return "";
    }
    var count = toNumber(value, NaN);
    if (!isFinite(count) || count < 0) {
      return "";
    }
    return String(Math.floor(count));
  }

  function formatDateMetadata(value) {
    var raw = cleanText(value);
    if (raw.length === 0) {
      return "";
    }
    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
  }

  function formatSaleMetadata(series) {
    if (!series || series.saleActive !== true) {
      return "";
    }
    var saleEndDate = parseOptionalDate(series.saleEndDate);
    if (saleEndDate !== null && saleEndDate.getTime() <= Date.now()) {
      return "";
    }
    var percentage = toNumber(series.salePercentage, 0);
    var label = percentage > 0 ? String(Math.floor(percentage)) + "% off" : "Active";
    var endDate = formatDateMetadata(series.saleEndDate);
    return endDate.length > 0 ? label + " until " + endDate : label;
  }

  function resolveSeriesImage(series) {
    var candidates = [
      series && series.featuredImage,
      series && series.featuredImageCL,
      series && series.featuredLogo,
      series && series.bannerHero,
      series && series.banner
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      var image = cleanText(candidates[index] || "");
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
    var status = cleanText(chapter && chapter.chapterStatus).toUpperCase();
    return isObject(chapter) &&
      typeof chapter.slug === "string" &&
      chapter.slug.length > 0 &&
      chapter.number !== void 0 &&
      (status.length === 0 || status === "PUBLIC");
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

    var unlockAt = parseOptionalDate(chapter.unlockAt);
    var unlockPassed = unlockAt !== null && unlockAt.getTime() <= Date.now() && chapter.isPermanentlyLocked !== true;
    if (chapter.isAccessible === true ||
      chapter.chapterPurchased === true ||
      chapter.isPurchased === true ||
      chapter.hasPurchased === true ||
      unlockPassed ||
      chapter.isLocked === false) {
      return CHAPTER_ACCESS_READABLE;
    }

    if (chapter.isAccessible === false ||
      chapter.isLocked === true ||
      chapter.isLockedByCoins === true ||
      chapter.isShortLinkLocked === true ||
      chapter.isPermanentlyLocked === true ||
      (unlockAt !== null && unlockAt.getTime() > Date.now()) ||
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
    if (title.length > 0) {
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

  async function getLatestReleasesView(stateManager) {
    return normalizeLatestReleasesView(await stateManager.retrieve(STATE_LATEST_RELEASES_VIEW));
  }

  function normalizeLatestReleasesView(value) {
    var rawValue = Array.isArray(value) ? value[0] : value;
    return cleanText(rawValue).toLowerCase() === LATEST_RELEASES_VIEW_NEW ? LATEST_RELEASES_VIEW_NEW : LATEST_RELEASES_VIEW_LATEST;
  }

  function getLatestReleasesViewSelection(value) {
    return [normalizeLatestReleasesView(value)];
  }

  function getLatestReleasesViewLabel(value) {
    var view = normalizeLatestReleasesView(value);
    for (var index = 0; index < LATEST_RELEASES_VIEW_OPTIONS.length; index += 1) {
      if (LATEST_RELEASES_VIEW_OPTIONS[index].id === view) {
        return LATEST_RELEASES_VIEW_OPTIONS[index].label;
      }
    }
    return "Latest";
  }

  function getLatestReleasesViewTag(value) {
    return normalizeLatestReleasesView(value) === LATEST_RELEASES_VIEW_NEW ? "new" : "latestUpdate";
  }

  function getChapterDisplayDate(chapter) {
    var accessState = getChapterAccessState(chapter);
    if (accessState === CHAPTER_ACCESS_READABLE && cleanText(chapter && chapter.becameFreeAt).length > 0) {
      return parseDate(chapter.becameFreeAt);
    }
    if (accessState === CHAPTER_ACCESS_LOCKED && cleanText(chapter && chapter.unlockAt).length > 0) {
      return parseDate(chapter.unlockAt);
    }
    return parseDate(chapter && (chapter.updatedAt || chapter.createdAt));
  }

  // Generic Utilities

  function parseDate(value) {
    var parsed = new Date(String(value || ""));
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function parseOptionalDate(value) {
    var raw = cleanText(value);
    if (raw.length === 0) {
      return null;
    }
    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function cleanText(value) {
    return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeSearchText(value) {
    return cleanText(value || "").toLowerCase();
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

  function formatGenreLabel(value) {
    var label = formatOptionLabel(value);
    var override = GENRE_LABEL_OVERRIDES[label.toLowerCase()];
    return override || label;
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

  // Exports

  var exportedSources = {
    HiveToonInfo: HiveToonInfo,
    HiveToon: HiveToon
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
