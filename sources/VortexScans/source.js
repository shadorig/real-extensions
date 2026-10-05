"use strict";

(function() {
  // Constants

  var DOMAIN = "https://vortexscans.org";
  var API_BASE = "https://api.vortexscans.org/api";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  var SEARCH_PER_PAGE = 24;
  var HOME_FEATURED_PER_PAGE = 12;
  var HOME_POPULAR_PER_PAGE = 20;
  var HOME_LATEST_PER_PAGE = 24;
  var HOME_MOST_POPULAR_PER_PAGE = 12;
  var FILTER_DATA_CACHE_MS = 5 * 60 * 1000;
  var SERIES_DETAILS_CACHE_MS = 60 * 1000;
  var SERIES_DETAILS_CACHE_LIMIT = 16;
  var ARCHIVE_DEFAULT_SERIES_TYPES = "MANGA,MANHWA,MANHUA";
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_POPULAR = "popular_today";
  var SECTION_ID_LATEST = "latest_releases";
  var SECTION_ID_MOST_POPULAR = "most_popular";
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
  var LATEST_RELEASES_VIEW_LATEST = "latest";
  var LATEST_RELEASES_VIEW_NEW = "new";
  var STATE_LATEST_RELEASES_VIEW = "latest_releases_view";
  var STATE_SHOW_LOCKED_CHAPTERS = "show_locked_chapters";
  var LOCKED_CHAPTER_LABEL_PREFIX = "[Locked] ";
  var CHAPTER_ACCESS_READABLE = "readable";
  var CHAPTER_ACCESS_LOCKED = "locked";
  var CHAPTER_ACCESS_UNKNOWN = "unknown";
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
    { id: "on_sale", label: "On Sale" },
    { id: "not_on_sale", label: "Full Price" }
  ];
  var ARCHIVE_SORT_OPTIONS = [
    { id: "latest_chapters", label: "Latest Chapters", orderBy: "lastChapterAddedAt", defaultDirection: "desc" },
    { id: "recently_updated", label: "Recently Updated", orderBy: "updatedAt", defaultDirection: "desc" },
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
  var GENRE_LABEL_OVERRIDES = {
    "jack of all trades": "Jack of All Trades",
    "slice of life": "Slice of Life",
    "magic and sword": "Magic and Sword"
  };

  // Source Info

  var VortexScansInfo = {
    version: "1.1.0",
    name: "VortexScans",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function VortexScans() {
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
      requestTimeout: 20000,
      interceptor: {
        interceptRequest: async function(request) {
          request.headers = Object.assign({}, request.headers || {}, {
            referer: DOMAIN + "/",
            origin: DOMAIN,
            accept: "application/json, text/plain, text/html, */*",
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
    this.cachedSeriesDetails = {};
    this.cachedSeriesDetailOrder = [];
    this.cachedSeriesDetailRequests = {};
    this.chapterListRequests = {};
  }

  // Paperback Interface Methods

  VortexScans.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  VortexScans.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  VortexScans.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/series/" + encodePathSegment(seriesId);
  };

  VortexScans.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    return this.getMangaShareUrl(seriesId) + "/" + encodePathSegment(chapterId);
  };

  VortexScans.prototype.getHomePageSections = async function(sectionCallback) {
    var latestReleasesView = await getLatestReleasesView(this.stateManager);
    var results = await Promise.allSettled([
      this.fetchText(DOMAIN),
      this.fetchPostsPage(1, HOME_LATEST_PER_PAGE, {
        tag: getLatestReleasesViewTag(latestReleasesView)
      })
    ]);
    var homeData = {
      featured: [],
      featuredCandidates: [],
      popularToday: [],
      mostPopular: []
    };
    var latestResults = App.createPagedResults({ results: [] });
    var latestPage;
    var homepageError;
    var latestError;

    if (results[0] && results[0].status === "fulfilled") {
      homeData = extractHomePageData(results[0].value);
    } else {
      homepageError = results[0] && results[0].reason;
    }

    if (results[1] && results[1].status === "fulfilled") {
      latestPage = results[1].value;
      latestResults = createLatestPagedResults(latestPage);
      if (Array.isArray(homeData.featuredCandidates) && homeData.featuredCandidates.length > 0) {
        homeData.featured = mapFeaturedHomeItems(enrichFeaturedPosts(homeData.featuredCandidates, latestPage.series));
      }
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
      )
    ];

    var visibleSections = sections.filter(function(section) {
      return Array.isArray(section.items) && section.items.length > 0;
    });

    visibleSections.forEach(function(section) {
      sectionCallback(section);
    });

    if (visibleSections.length === 0) {
      throw latestError || homepageError || new Error("Unable to load VortexScans homepage sections.");
    }
  };

  VortexScans.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    if (homepageSectionId !== SECTION_ID_LATEST) {
      return App.createPagedResults({
        results: []
      });
    }

    return this.getLatestSectionItems(toPositiveInteger(metadata && metadata.page, 1));
  };

  VortexScans.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  VortexScans.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;
    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      rows: async function() {
        return [
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

  VortexScans.prototype.supportsTagExclusion = async function() {
    // Vortex only exposes exclusion for genres. Paperback enables exclusion
    // source-wide, so exclusions from the other sections are ignored.
    return true;
  };

  VortexScans.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.fetchFilterData());
  };

  VortexScans.prototype.getSearchFields = async function() {
    return [
      createSearchField(SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters", "e.g. 10"),
      createSearchField(SEARCH_FIELD_MAX_CHAPTERS, "Maximum Chapters", "e.g. 100"),
      createSearchField(SEARCH_FIELD_CREATED_AFTER, "Created After", "YYYY-MM-DD"),
      createSearchField(SEARCH_FIELD_CREATED_BEFORE, "Created Before", "YYYY-MM-DD")
    ];
  };

  VortexScans.prototype.getMangaDetails = async function(seriesId) {
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

  VortexScans.prototype.getChapters = async function(seriesId) {
    var series = await this.fetchSeriesDetails(seriesId);
    var showLockedChapters = await getShowLockedChapters(this.stateManager);
    var chapters = (await this.fetchSeriesChapters(series))
      .filter(isDisplayChapter)
      .sort(compareChapterEntriesDesc);

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
    }).filter(function(chapter) {
      return cleanText(chapter && chapter.id).length > 0;
    });

    if (visibleChapters.length === 0) {
      throw new Error("No readable chapters were found for " + seriesId + ".");
    }

    return visibleChapters;
  };

  VortexScans.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var payload = await this.fetchJson(buildApiUrl("/chapter/content", {
      mangaslug: seriesId,
      chapterslug: chapterId
    }));

    if (!isObject(payload) || payload.isAccessible !== true) {
      throw new Error("This chapter is locked on VortexScans and cannot be loaded in Paperback.");
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
      throw new Error("VortexScans did not expose readable pages for this chapter.");
    }

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  VortexScans.prototype.getSearchResults = async function(query, metadata) {
    var title = cleanText(query && query.title || "");
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var filters = extractSearchFilters(query);

    return this.getArchiveSearchResults(title, filters, page);
  };

  // Source-Specific Fetch Helpers

  VortexScans.prototype.getLatestSectionItems = async function(page) {
    var latestReleasesView = await getLatestReleasesView(this.stateManager);
    var resultsPage = await this.fetchPostsPage(page, HOME_LATEST_PER_PAGE, {
      tag: getLatestReleasesViewTag(latestReleasesView)
    });

    return createLatestPagedResults(resultsPage);
  };

  function createLatestPagedResults(resultsPage) {
    return App.createPagedResults({
      results: mapHomeItems(resultsPage && resultsPage.series),
      metadata: getNextPageMetadataFromCount(
        resultsPage && resultsPage.totalCount,
        resultsPage && resultsPage.page,
        resultsPage && resultsPage.perPage,
        resultsPage && resultsPage.pageCount
      )
    });
  }

  VortexScans.prototype.fetchFilterData = async function() {
    if (this.cachedFilterData && Date.now() < this.cachedFilterData.expiresAt) {
      return this.cachedFilterData.value;
    }

    if (!this.cachedFilterDataRequest) {
      this.cachedFilterDataRequest = (async function() {
        var genres = extractGenreOptions(await this.fetchJson(buildApiUrl("/genres")));
        var value = {
          genres: genres,
          statuses: SEARCH_STATUS_OPTIONS.slice(),
          types: SEARCH_TYPE_OPTIONS.slice()
        };
        this.cachedFilterData = {
          value: value,
          expiresAt: Date.now() + FILTER_DATA_CACHE_MS
        };
        return value;
      }.bind(this))();
    }

    var request = this.cachedFilterDataRequest;
    try {
      return await request;
    } finally {
      if (this.cachedFilterDataRequest === request) {
        this.cachedFilterDataRequest = null;
      }
    }
  };

  VortexScans.prototype.fetchPostsPage = async function(page, perPage, options) {
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

  VortexScans.prototype.getArchiveSearchResults = async function(title, filters, page) {
    var resolvedPage = toPositiveInteger(page, 1);
    var response = await this.fetchJson(buildApiUrl("/query", buildArchiveQueryParams(title, filters, resolvedPage, SEARCH_PER_PAGE)));
    var pagePosts = Array.isArray(response && response.posts) ? response.posts : [];
    var series = normalizeSeriesPayloads(pagePosts);

    return App.createPagedResults({
      results: mapHomeItems(series),
      metadata: getNextPageMetadataFromCount(response && response.totalCount, resolvedPage, SEARCH_PER_PAGE, pagePosts.length)
    });
  };

  VortexScans.prototype.fetchSeriesDetails = async function(seriesId) {
    var cacheKey = cleanText(seriesId || "");
    if (cacheKey.length === 0) {
      throw new Error("VortexScans requires a series id.");
    }
    var cached = this.cachedSeriesDetails[cacheKey];
    if (cached && Date.now() < cached.expiresAt && isObject(cached.value)) {
      touchCacheKey(this.cachedSeriesDetailOrder, cacheKey);
      return cached.value;
    }

    if (!this.cachedSeriesDetailRequests[cacheKey]) {
      this.cachedSeriesDetailRequests[cacheKey] = (async function() {
        var response = await this.fetchJson(buildApiUrl("/post", {
          postSlug: cacheKey
        }));
        var series = isObject(response && response.post) ? response.post : null;

        if (!isSeriesPayload(series)) {
          throw new Error("Unable to decode the VortexScans series payload for " + seriesId + ".");
        }

        storeBoundedCacheEntry(
          this.cachedSeriesDetails,
          this.cachedSeriesDetailOrder,
          cacheKey,
          { value: series, expiresAt: Date.now() + SERIES_DETAILS_CACHE_MS },
          SERIES_DETAILS_CACHE_LIMIT
        );
        return series;
      }.bind(this))();
    }

    var request = this.cachedSeriesDetailRequests[cacheKey];
    try {
      return await request;
    } finally {
      if (this.cachedSeriesDetailRequests[cacheKey] === request) {
        delete this.cachedSeriesDetailRequests[cacheKey];
      }
    }
  };

  VortexScans.prototype.fetchSeriesChapters = async function(series) {
    var seriesId = cleanText(series && series.slug);
    var seriesApiId = toPositiveInteger(series && series.id, 0);

    if (seriesId.length === 0 || seriesApiId <= 0) {
      throw new Error("VortexScans did not expose a valid series record for the chapter list.");
    }

    var requestKey = String(seriesApiId);
    if (!this.chapterListRequests[requestKey]) {
      this.chapterListRequests[requestKey] = (async function() {
        var payload = await this.fetchJson(buildApiUrl("/chapters", {
          postId: seriesApiId,
          skip: 0,
          take: "all",
          order: "desc"
        }));
        var chapters = payload && payload.post && payload.post.chapters;
        if (!Array.isArray(chapters)) {
          throw new Error("VortexScans did not expose a valid chapter payload for " + seriesId + ".");
        }

        return normalizeChapterEntries(chapters);
      }.bind(this))();
    }

    var request = this.chapterListRequests[requestKey];
    try {
      return await request;
    } finally {
      if (this.chapterListRequests[requestKey] === request) {
        delete this.chapterListRequests[requestKey];
      }
    }
  };

  VortexScans.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  };

  VortexScans.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  // Site Parsing Helpers

  // Vortex currently server-renders its homepage cards. Keep the older Astro
  // payload decoder as a fallback so a frontend rollback does not remove rows.
  function extractHomePageData(html) {
    var currentPopularToday = extractCurrentSectionPosts(html, "Popular Today");
    var currentMostPopular = extractCurrentSectionPosts(html, "Most Popular");
    var currentFeatured = enrichFeaturedPosts(
      extractCurrentFeaturedPosts(html),
      currentPopularToday.concat(currentMostPopular)
    );
    var needsLegacyFallback = currentFeatured.length === 0 || currentPopularToday.length === 0 || currentMostPopular.length === 0;
    var astroPropsObjects = needsLegacyFallback ? extractAstroPropsObjects(html) : [];
    var featuredCandidates = currentFeatured.length > 0 ? currentFeatured : findAstroPropsArray(astroPropsObjects, "sliderPosts");

    return {
      featuredCandidates: featuredCandidates,
      featured: mapFeaturedHomeItems(featuredCandidates),
      popularToday: mapPopularTodayHomeItems(currentPopularToday.length > 0 ? currentPopularToday : findAstroPropsArray(astroPropsObjects, "posts")),
      mostPopular: mapMostPopularHomeItems(currentMostPopular.length > 0 ? currentMostPopular : findAstroPropsArray(astroPropsObjects, "series"))
    };
  }

  function extractCurrentFeaturedPosts(html) {
    var source = String(html || "");
    var marker = /\baria-label="Featured series"/i.exec(source);
    if (!marker) {
      return [];
    }

    return extractSeriesCardsFromSection(source, marker.index, true);
  }

  function extractCurrentSectionPosts(html, heading) {
    var source = String(html || "");
    var headingPattern = new RegExp("<h2\\b[^>]*>\\s*" + escapeRegExp(heading) + "\\s*</h2>", "i");
    var marker = headingPattern.exec(source);
    if (!marker) {
      return [];
    }

    return extractSeriesCardsFromSection(source, marker.index, false);
  }

  function extractSeriesCardsFromSection(source, markerIndex, allowMissingImage) {
    var sectionStart = source.lastIndexOf("<section", markerIndex);
    var sectionEnd = source.indexOf("</section>", markerIndex);
    if (sectionStart === -1 || sectionEnd === -1 || sectionEnd <= sectionStart) {
      return [];
    }

    var sectionHtml = source.slice(sectionStart, sectionEnd + 10);
    var linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    var posts = [];
    var match;

    while ((match = linkRegex.exec(sectionHtml)) !== null) {
      var anchorTag = "<a" + match[1] + ">";
      var href = decodeAstroPropsJson(extractHtmlAttribute(anchorTag, "href"));
      if (href.toLowerCase().indexOf("/series/") !== 0) {
        continue;
      }

      var slug = extractSeriesSlug(href);
      var imageMatch = match[2].match(/<img\b[^>]*>/i);
      var imageTag = imageMatch ? imageMatch[0] : "";
      var title = cleanText(decodeAstroPropsJson(extractHtmlAttribute(imageTag, "alt"))).replace(/^Cover of\s+/i, "");
      if (title.length === 0) {
        title = cleanText(decodeAstroPropsJson(extractHtmlAttribute(anchorTag, "aria-label"))).replace(/^Open\s+/i, "");
      }
      var image = allowMissingImage ? normalizeUrl(decodeAstroPropsJson(extractHtmlAttribute(imageTag, "data-fallback-src"))) : "";
      if (image.length === 0) {
        image = normalizeUrl(decodeAstroPropsJson(extractHtmlAttribute(imageTag, "src")));
      }

      if (slug.length === 0 || title.length === 0 || (!allowMissingImage && image.length === 0)) {
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

  function enrichFeaturedPosts(featuredPosts, fallbackPosts) {
    var fallbackBySlug = {};
    normalizeSeriesPayloads(fallbackPosts).forEach(function(post) {
      fallbackBySlug[cleanText(post.slug)] = post;
    });

    return normalizeSeriesPayloads(featuredPosts).map(function(post) {
      var fallback = fallbackBySlug[cleanText(post.slug)];
      if (!fallback) {
        return post;
      }

      return Object.assign({}, fallback, post, {
        postTitle: cleanText(post.postTitle) || cleanText(fallback.postTitle),
        featuredImage: resolveSeriesImage(post) || resolveSeriesImage(fallback)
      });
    });
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

  function findAstroPropsArray(propsObjects, key) {
    for (var index = 0; index < propsObjects.length; index += 1) {
      var value = propsObjects[index] && propsObjects[index][key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
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

  function decodeAstroPropsJson(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, function(_, code) {
        return safeCodePoint(code, 10);
      })
      .replace(/&#x([0-9a-f]+);/gi, function(_, code) {
        return safeCodePoint(code, 16);
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

    return payload;
  }

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
      throw new Error("VortexScans returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }
  }

  function parseTextResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : String(response && response.data || "");
    ensureSuccessfulResponse(response, raw, url);
    return raw;
  }

  function ensureSuccessfulResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("VortexScans returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    // Vortex can return plain 503/504 edge failures. Only explicit challenge
    // pages should trigger bypass.
    if (isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested VortexScans page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("VortexScans returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
    }
  }

  function isChallengePage(html) {
    var lower = String(html || "").toLowerCase();
    var hasHtmlShell = lower.indexOf("<html") !== -1 || lower.indexOf("<!doctype html") !== -1;
    var hasCloudflareMarker = lower.includes("cloudflare") ||
      lower.includes("cf-ray") ||
      lower.includes("cf_chl_") ||
      lower.includes("cf-browser-verification") ||
      lower.includes("/cdn-cgi/challenge-platform") ||
      lower.includes("cf-mitigated");
    var hasChallengeMarker = lower.includes("just a moment") ||
      lower.includes("attention required") ||
      lower.includes("checking your browser") ||
      lower.includes("verify you are human") ||
      lower.includes("please enable cookies") ||
      lower.includes("cf-browser-verification") ||
      lower.includes("challenge-platform") ||
      lower.includes("cf_chl_opt") ||
      lower.includes("captcha");

    return hasHtmlShell && hasCloudflareMarker && hasChallengeMarker;
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
      mangaId: cleanText(series && series.slug || ""),
      title: cleanText(series && (series.postTitle || series.title) || ""),
      image: resolveSeriesImage(series),
      subtitle: emptyToUndefined(subtitle)
    });
  }

  function normalizeSeriesPayloads(seriesList) {
    var deduped = {};
    var ordered = [];

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      if (!isSeriesPayload(series) || isNovelLikeSeries(series)) {
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

  function isNovelLikeSeries(series) {
    var type = cleanText(series && series.seriesType).toUpperCase();
    var title = cleanText(series && (series.postTitle || series.title));
    var slug = cleanText(series && series.slug);
    return series && series.isNovel === true ||
      type === "NOVEL" ||
      /\[novel\]/i.test(title) ||
      /(^|-)novel($|-)/i.test(slug);
  }

  function resolveSeriesImage(series) {
    var candidates = [
      series && series.featuredImage,
      series && series.featuredImageCL,
      series && series.featuredLogo,
      series && series.coverImage,
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
    return normalizeSeriesPayloads(seriesList).filter(function(series) {
      return resolveSeriesImage(series).length > 0;
    }).map(function(series) {
      return createPartialSeries(series, buildGenreSubtitle(series && series.genres, 4));
    });
  }

  function mapPopularTodayHomeItems(seriesList) {
    return mapHomeItems(seriesList, false);
  }

  function mapMostPopularHomeItems(seriesList) {
    var deduped = {};
    var items = [];

    (Array.isArray(seriesList) ? seriesList : []).forEach(function(series) {
      var slug = cleanText(series && series.slug);
      var title = cleanText(series && (series.title || series.postTitle));
      var image = resolveSeriesImage(series);

      if (slug.length === 0 || title.length === 0 || image.length === 0 || deduped[slug] || isNovelLikeSeries(series)) {
        return;
      }

      deduped[slug] = true;
      items.push(App.createPartialSourceManga({
        mangaId: slug,
        title: title,
        image: image,
        subtitle: emptyToUndefined(buildGenreSubtitle(series && (series.tags || series.genres), 3))
      }));
    });

    return items;
  }

  function buildHomeSubtitle(series) {
    var latestChapter = findFirstChapterPreview(series && series.chapters);
    if (latestChapter) {
      return buildChapterListName(latestChapter, toChapterNumber(latestChapter.number, 0));
    }

    var lastChapter = toNumber(series && series.lastChapter, NaN);
    if (isFinite(lastChapter) && lastChapter > 0) {
      return buildChapterName(lastChapter, "");
    }

    var statusLabel = formatOptionLabel(series && series.seriesStatus);
    return statusLabel.length > 0 ? statusLabel : void 0;
  }

  function buildGenreSubtitle(values, limit) {
    var labels = [];
    var seen = {};
    var max = toPositiveInteger(limit, 0);

    (Array.isArray(values) ? values : []).forEach(function(value) {
      var label = formatGenreLabel(isObject(value) ? value.name || value.label || "" : value);
      var key = toOptionId(label);

      if (label.length === 0 || key.length === 0 || seen[key] || (max > 0 && labels.length >= max)) {
        return;
      }

      seen[key] = true;
      labels.push(label);
    });

    return labels.join(" \u00b7 ");
  }

  async function getLatestReleasesView(stateManager) {
    return normalizeLatestReleasesView(await stateManager.retrieve(STATE_LATEST_RELEASES_VIEW));
  }

  function normalizeLatestReleasesView(value) {
    var rawValue = Array.isArray(value) ? value[0] : value;
    var view = cleanText(rawValue || "").toLowerCase();
    return view === LATEST_RELEASES_VIEW_NEW ? LATEST_RELEASES_VIEW_NEW : LATEST_RELEASES_VIEW_LATEST;
  }

  function getLatestReleasesViewSelection(value) {
    return [normalizeLatestReleasesView(value)];
  }

  function getLatestReleasesViewTag(value) {
    // Paperback does not expose Vortex's optional pinned-series block as a
    // separate row, so use the combined latest feed that the current homepage
    // renders when pinned titles belong at the top of Latest Releases.
    return normalizeLatestReleasesView(value) === LATEST_RELEASES_VIEW_NEW ? "new" : "latestUpdatePinned";
  }

  function getLatestReleasesViewLabel(value) {
    var view = normalizeLatestReleasesView(value);
    for (var index = 0; index < LATEST_RELEASES_VIEW_OPTIONS.length; index += 1) {
      if (LATEST_RELEASES_VIEW_OPTIONS[index].id === view) {
        return LATEST_RELEASES_VIEW_OPTIONS[index].label;
      }
    }

    return formatOptionLabel(view);
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
      statuses: [],
      types: [],
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
    var seenStatuses = {};
    var seenTypes = {};
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

      if (tagId.indexOf(SEARCH_TAG_PREFIX_STATUS) === 0) {
        var status = tagId.slice(SEARCH_TAG_PREFIX_STATUS.length);
        if (hasFilterOption(SEARCH_STATUS_OPTIONS, status) && !seenStatuses[status]) {
          seenStatuses[status] = true;
          filters.statuses.push(status);
        }
        return;
      }

      if (tagId.indexOf(SEARCH_TAG_PREFIX_TYPE) === 0) {
        var type = tagId.slice(SEARCH_TAG_PREFIX_TYPE.length);
        if (hasFilterOption(SEARCH_TYPE_OPTIONS, type) && !seenTypes[type]) {
          seenTypes[type] = true;
          filters.types.push(type);
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

  function buildArchiveQueryParams(title, filters, page, perPage) {
    var sortOption = getArchiveSortOption(filters && filters.sortBy) || getArchiveSortOption("latest_chapters");
    var minChapters = toPositiveInteger(filters && filters.minChapters, 0);
    var maxChapters = toPositiveInteger(filters && filters.maxChapters, 0);
    var seriesTypes = Array.isArray(filters && filters.types) ? filters.types : [];
    var params = {
      page: toPositiveInteger(page, 1),
      perPage: toPositiveInteger(perPage, SEARCH_PER_PAGE),
      view: "archive",
      seriesType: seriesTypes.length > 0 ? seriesTypes.join(",") : ARCHIVE_DEFAULT_SERIES_TYPES,
      orderBy: sortOption.orderBy,
      orderDirection: getArchiveOrderDirection(filters && filters.sortDirection, sortOption.defaultDirection)
    };
    var searchTerm = cleanText(title || "");
    var genreIds = Array.isArray(filters && filters.genres) ? filters.genres : [];
    var excludedGenreIds = Array.isArray(filters && filters.excludedGenres) ? filters.excludedGenres : [];
    var seriesStatuses = Array.isArray(filters && filters.statuses) ? filters.statuses : [];
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
    if (seriesStatuses.length > 0) {
      params.seriesStatus = seriesStatuses.join(",");
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
    return normalizeFilterOptions((Array.isArray(genres) ? genres : []).map(function(genre) {
      return {
        id: cleanText(genre && genre.id),
        label: formatGenreLabel(genre && genre.name)
      };
    }));
  }

  function normalizeFilterOptions(options) {
    var deduped = {};

    (Array.isArray(options) ? options : []).forEach(function(option) {
      var id = cleanText(option && option.id);
      var label = cleanText(option && option.label);
      if (id.length === 0 || label.length === 0 || deduped[id]) {
        return;
      }
      deduped[id] = {
        id: id,
        label: label
      };
    });

    return Object.keys(deduped).map(function(id) {
      return deduped[id];
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

    if (typeId.length > 0 && typeLabel.length > 0 && SEARCH_TYPE_OPTIONS.some(function(option) {
      return option.id === typeId;
    })) {
      metadataTags.push(App.createTag({
        id: SEARCH_TAG_PREFIX_TYPE + typeId,
        label: "Type: " + typeLabel
      }));
    }

    addDetailMetadataTag(metadataTags, "released", "Released", series && series.releaseDate);
    addDetailMetadataTag(metadataTags, "studio", "Studio", series && series.studio);
    addDetailMetadataTag(metadataTags, "chapters", "Chapters", formatCount(series && series._count && series._count.chapters));
    addDetailMetadataTag(metadataTags, "added", "Added", formatDateMetadata(series && series.createdAt));
    addDetailMetadataTag(metadataTags, "last-update", "Last Update", formatDateMetadata(series && series.lastChapterAddedAt));
    addDetailMetadataTag(metadataTags, "views", "Views", formatCount(series && series.totalViews));
    addDetailMetadataTag(metadataTags, "favorites", "Favorites", formatCount(series && series._count && series._count.bookmarks));
    addDetailMetadataTag(metadataTags, "rating-count", "Rating Count", formatCount(series && series.totalRatings));
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
      id: id + ":" + toOptionId(clean),
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

    var percentage = toNumber(series.salePercentage, 0);
    if (percentage <= 0 || percentage >= 100) {
      return "";
    }

    var saleEndRaw = cleanText(series.saleEndDate);
    if (saleEndRaw.length > 0) {
      var saleEnd = new Date(saleEndRaw);
      if (!isNaN(saleEnd.getTime()) && saleEnd.getTime() <= Date.now()) {
        return "";
      }
    }

    var label = String(Math.floor(percentage)) + "% off";
    var endDate = formatDateMetadata(series.saleEndDate);
    return endDate.length > 0 ? label + " until " + endDate : label;
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
    return cleanText(value || "").split(/\s*[,;\n\r\u2022]+\s*/).map(function(title) {
      return cleanText(title);
    }).filter(function(title) {
      return title.length > 0;
    });
  }

  function mapStatus(status) {
    var value = cleanText(status || "").toUpperCase();
    // Keep Paperback status mapping conservative. Vortex-specific extra states
    // remain visible through metadata tags.
    if (value === "ONGOING") return "ONGOING";
    if (value === "COMPLETED") return "COMPLETED";
    if (value === "HIATUS") return "HIATUS";
    return "UNKNOWN";
  }

  // Chapter Helpers

  function normalizeChapterEntries(chapters) {
    var deduped = {};
    var ordered = [];

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      var slug = cleanText(chapter && chapter.slug);
      if (slug.length === 0 || deduped[slug]) {
        return;
      }

      deduped[slug] = true;
      ordered.push(chapter);
    });

    return ordered;
  }

  function isDisplayChapter(chapter) {
    var status = cleanText(chapter && chapter.chapterStatus).toUpperCase();
    return status.length === 0 || status === "PUBLIC";
  }

  function findFirstChapterPreview(chapters) {
    var previewChapters = normalizeChapterEntries(chapters).filter(isDisplayChapter).sort(compareChapterEntriesDesc);
    return previewChapters.length > 0 ? previewChapters[0] : null;
  }

  function compareChapterEntriesDesc(left, right) {
    var leftNumber = toNumber(left && left.number, NaN);
    var rightNumber = toNumber(right && right.number, NaN);

    if (isFinite(leftNumber) && isFinite(rightNumber) && leftNumber !== rightNumber) {
      return rightNumber - leftNumber;
    }

    var rightDate = parseDate(right && (right.updatedAt || right.createdAt)).getTime();
    var leftDate = parseDate(left && (left.updatedAt || left.createdAt)).getTime();
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    var leftSlug = cleanText(left && left.slug);
    var rightSlug = cleanText(right && right.slug);
    if (leftSlug < rightSlug) return 1;
    if (leftSlug > rightSlug) return -1;
    return 0;
  }

  function getChapterDisplayDate(chapter) {
    var becameFreeAt = parseDate(chapter && chapter.becameFreeAt);
    if (becameFreeAt.getTime() > 0) {
      return becameFreeAt;
    }

    var updatedAt = parseDate(chapter && chapter.updatedAt);
    if (updatedAt.getTime() > 0) {
      return updatedAt;
    }

    return parseDate(chapter && chapter.createdAt);
  }

  function buildChapterName(number, title) {
    var cleanTitle = cleanText(title || "");
    if (cleanTitle.length > 0 && number > 0) {
      return "Chapter " + number + ": " + cleanTitle;
    }
    if (cleanTitle.length > 0) {
      return cleanTitle;
    }
    return number > 0 ? "Chapter " + number : "Chapter";
  }

  function buildReadableChapterLabel(chapter, fallbackNumber) {
    var chapterNumber = toChapterNumber(chapter && chapter.number, fallbackNumber);
    return buildChapterName(chapterNumber, chapter && chapter.title);
  }

  function buildLockedChapterLabel(chapter, fallbackNumber) {
    return LOCKED_CHAPTER_LABEL_PREFIX + buildReadableChapterLabel(chapter, fallbackNumber);
  }

  function buildChapterListName(chapter, fallbackNumber) {
    return getChapterAccessState(chapter) === CHAPTER_ACCESS_LOCKED ?
      buildLockedChapterLabel(chapter, fallbackNumber) :
      buildReadableChapterLabel(chapter, fallbackNumber);
  }

  async function getShowLockedChapters(stateManager) {
    return (await stateManager.retrieve(STATE_SHOW_LOCKED_CHAPTERS)) === true;
  }

  function getChapterAccessState(chapter) {
    if (!isObject(chapter)) {
      return CHAPTER_ACCESS_UNKNOWN;
    }

    if (chapter.isAccessible === true || chapter.chapterPurchased === true || chapter.isPurchased === true) {
      return CHAPTER_ACCESS_READABLE;
    }

    var unlockAt = parseDate(chapter.unlockAt);
    var unlockTime = unlockAt.getTime();
    var hasUnlockTime = unlockTime > 0;
    var futureUnlock = hasUnlockTime && unlockTime > Date.now();
    var expiredTimedUnlock = hasUnlockTime && unlockTime <= Date.now() && chapter.isPermanentlyLocked !== true;

    if (expiredTimedUnlock) {
      return CHAPTER_ACCESS_READABLE;
    }

    if (chapter.isLocked === true ||
      chapter.isLockedByCoins === true ||
      chapter.isPermanentlyLocked === true ||
      futureUnlock ||
      chapter.isShortLinkLocked === true && futureUnlock) {
      return CHAPTER_ACCESS_LOCKED;
    }

    return CHAPTER_ACCESS_READABLE;
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

  // Generic Utilities

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function cleanText(value) {
    var decoded = decodeEntities(String(value || ""));
    return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    } catch (error) {
      return "";
    }
  }

  function normalizeUrl(value) {
    var clean = cleanText(value || "");
    if (clean.length === 0) {
      return "";
    }
    if (clean.indexOf("//") === 0) {
      clean = "https:" + clean;
    }
    return clean.replace(/([^:])\/{2,}/g, "$1/");
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value || "");
    return clean.length > 0 ? clean : void 0;
  }

  function toPositiveInteger(value, fallback) {
    var numeric = parseInt(value, 10);
    return isFinite(numeric) && numeric > 0 ? numeric : fallback;
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

  function parseDate(value) {
    var parsed = new Date(cleanText(value || ""));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return new Date(0);
  }

  function formatGenreLabel(value) {
    var label = formatOptionLabel(value);
    var override = GENRE_LABEL_OVERRIDES[label.toLowerCase()];
    return override || label;
  }

  function formatOptionLabel(value) {
    var clean = cleanText(String(value || "")
      .replace(/_/g, " ")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
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

  function toOptionId(value) {
    return cleanText(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    VortexScansInfo: VortexScansInfo,
    VortexScans: VortexScans
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
