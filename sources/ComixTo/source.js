"use strict";

(function() {
  // Constants

  var DOMAIN = "https://comix.to";
  var API_BASE = DOMAIN + "/api/v1";
  var SOURCE_INTENTS_SERIES_CHAPTERS = 1;
  var SOURCE_INTENTS_HOMEPAGE_SECTIONS = 4;
  var SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED = 16;
  var SOURCE_INTENTS_SETTINGS_UI = 32;
  var CONTENT_RATING_MATURE = "MATURE";
  // Comix's own browse/home payloads default to suggestive filtering.
  var CONTENT_RATING_DEFAULT = "suggestive";
  var HOME_PAGE_SIZE = 20;
  var SEARCH_PAGE_SIZE = 20;
  var CHAPTERS_PAGE_SIZE = 100;
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_FOLLOWS = "follows";
  var SECTION_ID_LATEST = "latest";
  var SECTION_ID_NEW = "new";
  var SECTION_ID_COMPLETE = "complete";
  var TAG_PREFIX_GENRE = "genre:";
  var TAG_PREFIX_DEMOGRAPHIC = "demographic:";
  var TAG_PREFIX_FORMAT = "format:";
  var TAG_PREFIX_THEME = "theme:";
  var TAG_PREFIX_STATUS = "status:";
  var TAG_PREFIX_TYPE = "type:";
  var TAG_PREFIX_SORT = "sort:";
  var TAG_PREFIX_AUTHOR = "author:";
  var TAG_PREFIX_ARTIST = "artist:";
  var TAG_PREFIX_GENRE_MODE = "genre_mode:";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var DEFAULT_SORT = "chapter_updated_at:desc";
  var SEARCH_DEFAULT_SORT = "relevance:desc";
  var LATEST_UPDATES_VIEW_HOT = "hot";
  var LATEST_UPDATES_VIEW_NEW = "new";
  var TOP_SECTION_RANGE_DEFAULT = "1";
  var GROUP_MODE_ALL = "all";
  var GROUP_MODE_HIDE = "hide";
  var GROUP_MODE_ONLY = "only";
  var GROUP_MODE_PREFER = "prefer";
  var STATE_CONTENT_RATING = "content_rating";
  var STATE_LATEST_UPDATES_VIEW = "latest_updates_mode";
  // These legacy state keys keep existing user settings compatible.
  var STATE_TRENDING_RANGE = "most_recent_popular_range";
  var STATE_MOST_FOLLOWED_RANGE = "most_follows_range";
  var STATE_HOME_DEMOGRAPHICS = "home_demographics";
  var STATE_HOME_TYPES = "home_types";
  var STATE_CHAPTER_GROUP_MODE = "chapter_group_mode";
  var STATE_CHAPTER_GROUP_FILTER = "chapter_group_filter";
  var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var CONTENT_RATING_OPTIONS = [
    { id: "safe", label: "Safe" },
    { id: "suggestive", label: "Suggestive" },
    { id: "erotica", label: "Erotica" },
    { id: "pornographic", label: "Pornographic" }
  ];
  var LATEST_UPDATES_VIEW_OPTIONS = [
    { id: LATEST_UPDATES_VIEW_HOT, label: "Hot" },
    { id: LATEST_UPDATES_VIEW_NEW, label: "New" }
  ];
  var TOP_SECTION_RANGE_OPTIONS = [
    { id: "1", label: "Today" },
    { id: "7", label: "7 Days" },
    { id: "30", label: "Last 30 Days" },
    { id: "90", label: "Last 3 Months" },
    { id: "180", label: "Last 6 Months" },
    { id: "365", label: "Last Year" }
  ];
  var HOME_DEMOGRAPHIC_OPTIONS = [
    { id: "shounen", label: "Shounen" },
    { id: "shoujo", label: "Shoujo" },
    { id: "seinen", label: "Seinen" },
    { id: "josei", label: "Josei" }
  ];
  var HOME_TYPE_OPTIONS = [
    { id: "manga", label: "Manga" },
    { id: "manhwa", label: "Manhwa" },
    { id: "manhua", label: "Manhua" },
    { id: "other", label: "Other" }
  ];
  var GROUP_MODE_OPTIONS = [
    { id: GROUP_MODE_ALL, label: "Show All Groups" },
    { id: GROUP_MODE_HIDE, label: "Hide Matching Groups" },
    { id: GROUP_MODE_ONLY, label: "Only Matching Groups" },
    { id: GROUP_MODE_PREFER, label: "Prefer Matching Group" }
  ];
  // Static port of Comix's public tfl4t2 request signer and envelope decoder.
  // Refresh from secure-tfl4t2-BRlFkaym.js when the public bundle id changes.
  var COMIX_CIPHER_STAGES = [
    {
      table: "haySVASzgso1XvPOR+534yE/rV3FbsM6SmZcaxymULBY2KecuXwI4NB/G3S0FH0OMrzHiHv2WXqKIpT8j8Hqdkmp+P82LUZwLCbmrp4NZCTwDJUZH1pzN8w0TBqJo9QlCW0vPGcA9L64oe/ZS/m//rYHjitRzWAuxKCZdTEgfrXdEVb7mDjXYqr6TegSW9NEAz2o54Z4Pt4K7TPS7MYQvcjJ9zuajEiQYXmEFg/1QygLm6KAunHaHq+lT29ftzDkQcIBZRhF4uFqg5efHcvplofVgbKN/QblKbEVUmnb8vFjnWzrwJNo3xdTu9EqE06rcidXAgVCOdZApFUji5Hczw==",
      key: "LbvnM0tqpqYeHgDpUAnnKlmLndE9Zanimj8=",
      seed: 92
    },
    {
      table: "ujbY8ugLILk1uEvtVtd6fxvVkJyUw0bPaCh7McAySAFao/hfjN+1q4lhkQAWI5pNZG1mLhlBeVe8/+VDdspbgskJnu8YOfeY68QkDCmVUfS/zm7TbCUFUi2DcwiBtFPWB/lK0L6osqYX+41UK6QVTw2982NgdbfHM5bccAS7tkKlIbCbrg+TOIv80upycROHhsGnaybGQA4GqfoQn+OIXI/UHH1O5IU3MMgSFEdql+lMzCf+y2kD3h/dWa+xKgJ4meDREcL1gI47HoriWDSzrZ0iPOFlXnfuPfDs9jqifKxESS/ZLM10VW9QGpJi2+ah2n6q8UX9P6AdxQpnPoTnXQ==",
      key: "ydX4N9AMLlSdM4rDfFkKmCKFF9/5srl++t6+dw==",
      seed: 147
    },
    {
      table: "FGQy+D4NCgfFIs0EWzX6edMrk1gnj1TvsNz952XZ8GJIX3cv1IzyXoOXQ+B9EuTbe+46iUF4/pxEG1XSCK8ZcVHDoW/rtMeITtG+P84zwLwJ/wBraHY9TAxPJelp1SzKnZbPGHNs86sulb0LqCHWECCtheX0qTc7SqS5HIdtxGdCS1K3HYCnXepykaqN+df10DZaf1AOFQKBgrVHxrOj40WOF96gm2aY4gMkngWyBt88OKK/5g8t4dgRi1nBKctgsfdhJvvt2obddZlufgEeTej8GhMorDkWusyKNJ+4lJCEu/a2asKaSfHJY1euRnxcQFZTpnowcMgxI6Uf7Cp0kg==",
      key: "BpB1hZ2zP4Yfc7NjuClhFbjsVlO8YA==",
      seed: 170
    }
  ];
  var decodedComixCipherStages = null;
  var COMIX_SIGNER_RC4_KEYS = [
    "EO8fB2AQIKXZ5A/qaoglOT88IrBPN9r8lRNmm+KEUzI=",
    "Ln8y/7k8kWdMHrULDE9x/aalNWbCK+/vC/8gAihXlAQ=",
    "IkY+JZt8Zh4iUvPLDGGztNncx0f4i+VyCfk8b5vY4P0=",
    "k80C/WNNoQeupQlmMdyc60+3WQPiJYY+PRy4Ca3jew8=",
    "aUvDZX3P3oZ53+JPe68doZCPPyTlX2I8LNmQU9dew7U="
  ];
  var COMIX_SIGNER_INSERT_STAGES = [
    {
      prefix: 10,
      prefixBytes: "jUctkam5GFGxUA==",
      ops: "AFQAAeA6ANIAAVkeAVRLCGwAAB0ABRIAAYZLAJ8AAIQAATE6ANEAAZEeAX1LCPgAAFEABcgAARxLADEAAGAAAbg6AK8AAWweAbJLCKQAAPEABVgAAQpLABUAAHAAAW46AKEAAWAeAfdLCFkAAEgABWwAAQFLAMIAAFYAAc86AHEAAbEeAfRLCJEAAGEABfgAAU1LABgAAMwAAWE6AJUAATgeAYpLCGwAAK4ABaQAAe1LAIgAANoAAUU6AIUAAe4eAYRLCGAAAOsABVkAAVRLALwAANEAAZI6AKMAAU8eAVRLCLEAAOgABZEAAX1LACgAAJ0AAUg6ADkAAeEeAbBLCDgAAJYABWwAAbJLAHQAAD0AAdg6AC8AAcUeAaBLCO4AAJgABWAAAfdLAIkAAIQAAew6ACQAARIeAYZLCE8AAEgABbEAAfRLAEEAAK0AAXg6AGgAAcgeARxLCOEAAKwABTgAAYpLALwAAGIAASQ6AMgAAVgeAQpLCMUAALwABe4AAYRLALAAACcAAdk6AHEAAWweAQFLCBIAAJoABU8AAVRLAGEAACQAARE6AFgAAfgeAU1LCMgAAAAABeEAAbBLAOgAAFoAAew6AJcAAaQeAe1LCFgAABYABcUAAaBLAD4A"
    },
    {
      prefix: 6,
      prefixBytes: "bcbQp+o6",
      ops: "AYhLAThRALcAAdY6AAcAAcNLAFYAANsACM4ACIMAARZLASFRAEkAAWE6AEQAAcdLAKEAAMMACJwACBsAAXRLAQBRAPcAAew6AHUAAQRLAH8AAO4ACFgACPkAARBLAf9RAJQAATg6ALcAAVZLAAcAABMACEoACAsAAc5LAQNRAAoAASE6AEkAAeFLAEQAABcACL0ACBMAAZxLAZtRAGgAAQA6APcAAWxLAHUAANQACGMACD4AAVhLAXlRAAwAAf86AJQAAbhLALcAAIYACBsACMMAAUpLAYtRANIAAQM6AAoAAaFLAEkAADEACFgACMcAAb1LAZNRAIAAAZs6AGgAAYBLAPcAALwACGkACAQAAWNLAb5RAEQAAXk6AAwAAX9LAJQAAGgACKsACFYAARtLAUNRAFYAAYs6ANIAAYNLAAoAAHEACFUACOEAAVhLAUdRAKEAAZM6AIAAARtLAGgAAFAACOsACGwAAWlLAYRRAH8AAb46AEQAAflLAAwAAK8ACIgACLgAAatLAdZRAAcAAUM6AFYAAQtLANIAAFMACBYACKEAAVVLAWFRAEQAAUc6AKEAARNLAIAAAMsACHQACIAAAetLAexRAHUAAYQ6AH8AAT5LAEQAACkACBAACH8A"
    },
    {
      prefix: 6,
      prefixBytes: "Gi+iYUq9",
      ops: "CHgAAKUAApgACGoAAqgAAZxtAt4AAEAAASRtAdUeCDgAAHoAAiMACH0AAvAAAURtAswAALcAAfBtAYUeCPEAAO4AAi8ACAMAAlwAAXdtAtYAAOsAAR5tAUQeCBgAAFMAAngACIAAApgAAWptAqgAAEwAAd5tAZAeCCQAAPAAAjgACF8AAiMAAX1tAvAAAJQAAcxtAWceCPAAAKAAAvEACMsAAi8AAQNtAlwAAKcAAdZtATseCB4AAGEAAhgACHYAAngAAYBtApgAALoAAahtAZweCN4AALUAAiQACNUAAjgAAV9tAiMAAK0AAfBtAUQeCMwAAEIAAvAACIUAAvEAActtAi8AANMAAVxtAXceCNYAAB4AAh4ACEQAAhgAAXZtAngAAFAAAZhtAWoeCKgAALkAAt4ACJAAAiQAAdVtAjgAAI8AASNtAX0eCPAAAGEAAswACGcAAvAAAYVtAvEAABsAAS9tAQMeCFwAAFIAAtYACDsAAh4AAURtAhgAAKYAAXhtAYAeCJgAAE8AAqgACJwAAt4AAZBtAiQAAAUAAThtAV8eCCMAAFgAAvAACEQAAswAAWdtAvAAAFUAAfFtAcseCC8AACYAAlwACHcAAtYAATttAh4AAJQAARhtAXYe"
    },
    {
      prefix: 7,
      prefixBytes: "eBRPAsbPDw==",
      ops: "CL8AAfBLCJYAALwAAVdtCAsAAQ06Ae8eARY6ATNtCO8AAW9LCEYAAOkAAaRtCJAAAZs6AW8eATw6AcRtCO0AAWBLCOAAAAkAAXptCDAAAd86Ad8eAWY6Af5tCHAAAZdLCL8AAOwAAZZtCKAAAdc6AQseAQ06Ae9tCJYAATNLCO8AAHMAAUZtCPUAASQ6AZAeAZs6AW9tCLwAAcRLCO0AAHwAAeBtCBUAAfo6ATAeAd86Ad9tCOYAAf5LCHAAAIsAAb9tCPAAARY6AaAeAdc6AQttCI0AAe9LCJYAAC8AAe9tCG8AAcY6AfUeASQ6AZBtCBsAAW9LCLwAANgAAe1tCGAAAWA6ARUeAfo6ATBtCF8AAd9LCOYAAOIAAXBtCJcAAT86AfAeARY6AaBtCFcAAQtLCI0AAPMAAZZtCDMAAW86AW8eAcY6AfVtCKQAAZBLCBsAAHMAAbxtCMQAAW06AWAeAWA6ARVtCHoAATBLCF8AAMMAAeZtCP4AAfA6AZceAT86AfBtCJYAAaBLCFcAABcAAY1tCO8AARY6ATMeAW86AW9tCEYAAfVLCKQAAIwAARttCG8AATw6AcQeAWBtCOAAARVLCHoAACwAAV9tCN8AAWY6Af4eAfA6AZdt"
    },
    {
      prefix: 9,
      prefixBytes: "YUCisHAu3f3E",
      ops: "AJkAAPMAAXseAbBtAVQeCIgAAU46AKYAAMkAAMoAAHMAAKsAAXAeAS1tAdseCFkAAYk6AEEAAJkAAGkAAOgAAIgAAfoeARxtAVQeCLAAAa86AJ8AAC0AAAgAAJYAAIwAAbweASNtAXseCLAAAdQ6AJQAAOsAAKYAAMkAAAYAAVYeAXttAXAeCC0AAVs6AEUAACwAAEEAAJkAAKUAAc0eAVhtAfoeCBwAAdQ6AKwAAAoAAJ8AAC0AAMQAAbMeAVxtAbweCCMAAfs6AKwAAHEAAJQAAOsAAGoAAeweAdZtAVYeCHsAAfA6ADEAAP4AAEUAACwAAI0AAbweAXVtAc0eCFgAAXo6AAAAAHEAAKwAAAoAAFMAAQgeARRtAbMeCFwAATw6AD8AAF4AAKwAAHEAAFgAAc4eAbptAeweCNYAAdY6AGcAAFUAADEAAP4AAIkAAQkeAV1tAbweCHUAAU06AEQAAN8AAAAAAHEAAGAAAS8eAYNtAQgeCBQAATM6AEAAAJkAAD8AAF4AAGAAAVQeAYhtAc4eCLoAAWw6AMoAAHMAAGcAAFUAAP0AAdseAVltAQkeCF0AATw6AGkAAOgAAEQAAN8AAMwAAVQeAbBtAS8eCIMAAYg6AAgAAJYAAEAA"
    }
  ];
  var decodedComixSignerStages = null;
  // Legacy tes1em envelope crypto is retained for encrypted responses.
  var COMIX_HASH_KEYS = [
    "22D604qPJ3iZyib4WaXX4bhRjo4eLGzPS8NI/5kBg5o=",
    "1sp9w8c67MpO",
    "Q9TdwuMw/MxVqi3O5uAg5xRarTM3LqwWMYOMGE/+1CA=",
    "AXESAx7UvxKF55ykpvLcnvj2T7+nlXxWhq0XXJrzXJY=",
    "qLHSPpfPyw==",
    "+QKAlsdnzXGBRSCDX8DHsF0YFZMWRzrDmY0GpLYJJKY=",
    "njh2h71NUbtQaemzhwD0bCgKFyQc928JMEES3DzVPRA=",
    "FdvbFojh",
    "nKvB9ym8/F1C9wFG78p8DQJ6LyzrQ//hQTs5MpOJr5I=",
    "jxi8Q+dayEjqxPL51wfhKjE6QDwcsoueGNu0ijoNw64=",
    "+UTnB4G+MtwH",
    "QMSq6NACRC5GKB5OiU5fHJjQ9KTTDezj9d0cthqNiRs=",
    "X46a7RgXUAAEwht+w1UAiuH2OmPGdjabVUTIZoa3iaY=",
    "iOAFX0i0iA==",
    "mmlfRKf+YlUdIQzFKeWLP/Xt6xTAPZZQaR3AHp+5vdY="
  ];
  var FALLBACK_FILTER_OPTIONS = {
    genres: [
      { id: "6", label: "Action" },
      { id: "87264", label: "Adult" },
      { id: "7", label: "Adventure" },
      { id: "8", label: "Boys Love" },
      { id: "9", label: "Comedy" },
      { id: "10", label: "Crime" },
      { id: "11", label: "Drama" },
      { id: "87265", label: "Ecchi" },
      { id: "12", label: "Fantasy" },
      { id: "13", label: "Girls Love" },
      { id: "87266", label: "Hentai" },
      { id: "14", label: "Historical" },
      { id: "15", label: "Horror" },
      { id: "16", label: "Isekai" },
      { id: "17", label: "Magical Girls" },
      { id: "87267", label: "Mature" },
      { id: "18", label: "Mecha" },
      { id: "19", label: "Medical" },
      { id: "20", label: "Mystery" },
      { id: "21", label: "Philosophical" },
      { id: "22", label: "Psychological" },
      { id: "23", label: "Romance" },
      { id: "24", label: "Sci-Fi" },
      { id: "25", label: "Slice of Life" },
      { id: "87268", label: "Smut" },
      { id: "26", label: "Sports" },
      { id: "27", label: "Superhero" },
      { id: "28", label: "Thriller" },
      { id: "29", label: "Tragedy" },
      { id: "30", label: "Wuxia" }
    ],
    demographics: [
      { id: "3", label: "Josei" },
      { id: "4", label: "Seinen" },
      { id: "1", label: "Shoujo" },
      { id: "2", label: "Shounen" }
    ],
    formats: [
      { id: "93164", label: "4-Koma" },
      { id: "93167", label: "Adaptation" },
      { id: "93165", label: "Anthology" },
      { id: "93166", label: "Award Winning" },
      { id: "93168", label: "Doujinshi" },
      { id: "93172", label: "Full Color" },
      { id: "93170", label: "Long Strip" },
      { id: "93169", label: "Oneshot" },
      { id: "93171", label: "Web Comic" }
    ],
    themes: [],
    statuses: [
      { id: "releasing", label: "Releasing" },
      { id: "finished", label: "Finished" },
      { id: "on_hiatus", label: "On hiatus" },
      { id: "discontinued", label: "Discontinued" },
      { id: "not_yet_released", label: "Not yet released" }
    ],
    types: [
      { id: "manga", label: "Manga" },
      { id: "manhwa", label: "Manhwa" },
      { id: "manhua", label: "Manhua" },
      { id: "other", label: "Other" }
    ],
    sorts: [
      { id: "relevance:desc", label: "Best Match" },
      { id: "chapter_updated_at:desc", label: "Latest Updates" },
      { id: "created_at:desc", label: "Recently Added" },
      { id: "title:asc", label: "Title A-Z" },
      { id: "title:desc", label: "Title Z-A" },
      { id: "year:desc", label: "Year (Newest)" },
      { id: "year:asc", label: "Year (Oldest)" },
      { id: "score:desc", label: "Highest Rated" },
      { id: "views_7d:desc", label: "Most Viewed - 7 Days" },
      { id: "views_30d:desc", label: "Most Viewed - 30 Days" },
      { id: "views_90d:desc", label: "Most Viewed - 90 Days" },
      { id: "views_total:desc", label: "Most Viewed - All Time" },
      { id: "follows_total:desc", label: "Most Followed" }
    ]
  };

  // Source Info

  var ComixToInfo = {
    version: "1.0.9",
    name: "ComixTo",
    description: "Extension that pulls series from " + DOMAIN,
    author: "real",
    icon: "icon.png",
    contentRating: CONTENT_RATING_MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [],
    intents: SOURCE_INTENTS_SERIES_CHAPTERS | SOURCE_INTENTS_HOMEPAGE_SECTIONS | SOURCE_INTENTS_CLOUDFLARE_BYPASS_REQUIRED | SOURCE_INTENTS_SETTINGS_UI
  };

  // Constructor

  function ComixTo() {
    this.cachedFilterData = null;
    this.cachedChapterShareUrls = {};
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
            "x-requested-with": "XMLHttpRequest",
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

  ComixTo.prototype.searchRequest = function(query, metadata) {
    return this.getSearchResults(query, metadata);
  };

  ComixTo.prototype.getTags = async function() {
    if (typeof this.getSearchTags === "function") {
      return this.getSearchTags();
    }
    return [];
  };

  ComixTo.prototype.getMangaShareUrl = function(seriesId) {
    return DOMAIN + "/title/" + encodePathSegment(seriesId);
  };

  ComixTo.prototype.getChapterShareUrl = function(seriesId, chapterId) {
    var cachedUrl = this.cachedChapterShareUrls && this.cachedChapterShareUrls[String(chapterId)];
    return cleanText(cachedUrl || "") || this.getMangaShareUrl(seriesId);
  };

  ComixTo.prototype.getHomePageSections = async function(sectionCallback) {
    var homeFilters = await getHomeFilterParams(this.stateManager);
    var trendingSectionDays = await getTrendingDays(this.stateManager);
    var mostFollowedSectionDays = await getMostFollowedDays(this.stateManager);
    var results = await Promise.all([
      this.getTopSectionItems("trending", 1, homeFilters, trendingSectionDays),
      this.getTopSectionItems("follows", 1, homeFilters, mostFollowedSectionDays),
      this.getLatestSectionItems(1, homeFilters),
      this.getNewSectionItems(1, homeFilters),
      this.getCompleteSectionItems(1, homeFilters)
    ]);

    [
      createHomeSection(SECTION_ID_FEATURED, "Trending", "featured", results[0]),
      createHomeSection(SECTION_ID_FOLLOWS, "Most Followed", "singleRowLarge", results[1]),
      createHomeSection(SECTION_ID_LATEST, "Latest Updates", "singleRowNormal", results[2]),
      createHomeSection(SECTION_ID_NEW, "Recently Added", "singleRowNormal", results[3]),
      createHomeSection(SECTION_ID_COMPLETE, "Complete Series", "singleRowNormal", results[4])
    ].forEach(function(section) {
      if (Array.isArray(section.items) && section.items.length > 0) {
        sectionCallback(section);
      }
    });
  };

  ComixTo.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);

    if (homepageSectionId === SECTION_ID_LATEST) {
      return this.getLatestSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_NEW) {
      return this.getNewSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_COMPLETE) {
      return this.getCompleteSectionItems(page);
    }

    return App.createPagedResults({
      results: []
    });
  };

  ComixTo.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET"
    });
  };

  ComixTo.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;
    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      footer: "Chapter group matching uses comma-separated exact group names or numeric group IDs.",
      rows: async function() {
        return [
          createSingleSelectSetting(stateManager, {
            id: STATE_CONTENT_RATING,
            label: "Content Rating",
            options: CONTENT_RATING_OPTIONS,
            fallback: CONTENT_RATING_DEFAULT,
            getValue: getContentRating
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_LATEST_UPDATES_VIEW,
            label: "Latest Updates View",
            options: LATEST_UPDATES_VIEW_OPTIONS,
            fallback: LATEST_UPDATES_VIEW_HOT,
            getValue: getLatestUpdatesView
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_TRENDING_RANGE,
            label: "Trending Period",
            options: TOP_SECTION_RANGE_OPTIONS,
            fallback: TOP_SECTION_RANGE_DEFAULT,
            getValue: getTrendingDays
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_MOST_FOLLOWED_RANGE,
            label: "Most Followed Period",
            options: TOP_SECTION_RANGE_OPTIONS,
            fallback: TOP_SECTION_RANGE_DEFAULT,
            getValue: getMostFollowedDays
          }),
          createMultiSelectSetting(stateManager, {
            id: STATE_HOME_DEMOGRAPHICS,
            label: "Home Demographics",
            options: HOME_DEMOGRAPHIC_OPTIONS,
            getValue: getHomeDemographics
          }),
          createMultiSelectSetting(stateManager, {
            id: STATE_HOME_TYPES,
            label: "Home Types",
            options: HOME_TYPE_OPTIONS,
            getValue: getHomeTypes
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_CHAPTER_GROUP_MODE,
            label: "Chapter Group Handling",
            options: GROUP_MODE_OPTIONS,
            fallback: GROUP_MODE_ALL,
            getValue: getChapterGroupMode
          }),
          App.createDUIInputField({
            id: STATE_CHAPTER_GROUP_FILTER,
            label: "Group Names or IDs",
            value: App.createDUIBinding({
              get: async function() {
                return getChapterGroupFilterText(stateManager);
              },
              set: async function(newValue) {
                await stateManager.store(STATE_CHAPTER_GROUP_FILTER, cleanText(newValue || ""));
              }
            })
          })
        ];
      }
    });
  };

  ComixTo.prototype.supportsTagExclusion = async function() {
    // Paperback exposes exclusion source-wide. Comix only honors it for genre-like
    // terms sent through genres_ex, which includes formats and theme/tag terms.
    return true;
  };

  ComixTo.prototype.getSearchTags = async function() {
    return buildSearchTagSections(await this.getFilterData());
  };

  ComixTo.prototype.getSearchFields = async function() {
    return [createMinimumChaptersSearchField()];
  };

  ComixTo.prototype.getMangaDetails = async function(seriesId) {
    var details = extractApiResult(
      await this.fetchJson(buildApiUrl("/manga/" + encodePathSegment(seriesId))),
      "/manga/" + seriesId
    );

    return App.createSourceManga({
      id: String(details.hid || seriesId),
      mangaInfo: App.createMangaInfo({
        titles: buildTitles(details.title, combineDetailValues(details.altTitles, details.alt_titles)),
        image: choosePoster(details.poster || details.cover),
        desc: cleanText(stripHtml(details.synopsisHtml || details.synopsis || "")),
        author: emptyToUndefined(joinContributorNames(combineDetailValues(details.authors, details.author))),
        artist: emptyToUndefined(joinContributorNames(combineDetailValues(details.artists, details.artist))),
        status: mapStatus(details.status),
        rating: normalizeRating(details.ratedAvg || details.rating),
        tags: buildDetailTagSections(details),
        hentai: isExplicitSeries(details)
      })
    });
  };

  ComixTo.prototype.getChapters = async function(seriesId) {
    var path = "/manga/" + encodePathSegment(seriesId) + "/chapters";
    var source = this;
    var firstPage = extractApiResult(await this.fetchJson(buildSignedApiUrl(path, {
      page: 1,
      limit: CHAPTERS_PAGE_SIZE,
      order: { number: "desc" }
    })), path);
    var pages = [firstPage];
    var totalPages = toPositiveInteger(firstPage && firstPage.meta && firstPage.meta.lastPage, 1);
    var pendingPages = [];
    var chapters;
    var groupSettings = await getChapterGroupSettings(this.stateManager);
    var fetchedAt;
    var duplicateDateFallbacks;

    for (var page = 2; page <= totalPages; page += 1) {
      pendingPages.push(this.fetchJson(buildSignedApiUrl(path, {
        page: page,
        limit: CHAPTERS_PAGE_SIZE,
        order: { number: "desc" }
      })));
    }

    if (pendingPages.length > 0) {
      (await Promise.all(pendingPages)).forEach(function(payload) {
        pages.push(extractApiResult(payload, path));
      });
    }

    chapters = dedupeById(flatten(pages.map(function(pageData) {
      return Array.isArray(pageData && pageData.items) ? pageData.items : [];
    })));
    fetchedAt = Date.now();
    duplicateDateFallbacks = buildChapterDateFallbacks(chapters, fetchedAt);

    if (chapters.length === 0) {
      throw new Error("ComixTo did not return any chapters for " + seriesId + ".");
    }

    chapters.sort(compareChaptersDesc);
    chapters = applyChapterGroupSettings(chapters, groupSettings);

    if (chapters.length === 0) {
      if (hasActiveChapterGroupFilter(groupSettings)) {
        throw new Error("No chapters matched the current ComixTo chapter group settings for " + seriesId + ".");
      }
      throw new Error("ComixTo did not return any readable chapters for " + seriesId + ".");
    }

    var visibleChapters = chapters.filter(function(chapter) {
      return getChapterId(chapter).length > 0;
    }).map(function(chapter, index) {
      var chapterNumber = toNumber(chapter.number, chapters.length - index);
      var chapterId = getChapterId(chapter);
      var chapterData = {
        id: chapterId,
        name: buildChapterName(chapter, chapterNumber),
        chapNum: chapterNumber,
        time: getChapterDate(chapter, fetchedAt, duplicateDateFallbacks),
        langCode: cleanText(chapter.language || "") || "en"
      };
      var groupName = getChapterGroupName(chapter);

      if (groupName.length > 0) {
        chapterData.group = groupName;
      }

      cacheChapterShareUrl(source, chapterId, chapter.url);

      return App.createChapter(chapterData);
    });

    if (visibleChapters.length === 0) {
      throw new Error("ComixTo did not return any chapters with readable IDs for " + seriesId + ".");
    }

    return visibleChapters;
  };

  ComixTo.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var path = "/chapters/" + encodePathSegment(chapterId);
    var chapterData = extractApiResult(await this.fetchJson(buildSignedApiUrl(path)), path);
    var pages = normalizeChapterPages(chapterData && chapterData.pages);

    if (pages.length === 0) {
      throw new Error("ComixTo did not return readable pages for chapter " + chapterId + ".");
    }

    cacheChapterShareUrl(this, chapterId, chapterData && chapterData.url);

    return App.createChapterDetails({
      id: chapterId,
      mangaId: seriesId,
      pages: pages
    });
  };

  ComixTo.prototype.getSearchResults = async function(query, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);
    var title = cleanText(query && query.title || "");
    var filters = extractSearchFilters(query);
    var sort = parseSortOption(filters.sort || (title.length > 0 ? SEARCH_DEFAULT_SORT : DEFAULT_SORT));
    var params = {
      page: page,
      limit: SEARCH_PAGE_SIZE,
      content_rating: await getContentRating(this.stateManager),
      order: sort
    };
    var result;
    var items;

    if (title.length > 0) {
      params.keyword = title;
    }

    if (filters.types.length > 0) {
      params.types = filters.types;
    }

    if (filters.authors.length > 0) {
      params.authors = filters.authors;
    }

    if (filters.artists.length > 0) {
      params.artists = filters.artists;
    }

    if (filters.statuses.length > 0) {
      params.statuses = filters.statuses;
    }

    if (filters.genresIn.length > 0) {
      params.genres_in = filters.genresIn;
    }

    if (filters.genresEx.length > 0) {
      params.genres_ex = filters.genresEx;
    }

    if (filters.genresIn.length > 0 || filters.genresEx.length > 0) {
      params.genres_mode = filters.genresMode;
    }

    if (filters.demographics.length > 0) {
      params.demographics = filters.demographics;
    }

    if (toPositiveInteger(filters.minChapters, 0) > 0) {
      params.min_chap = filters.minChapters;
    }

    result = extractApiResult(await this.fetchJson(buildApiUrl("/manga", params)), "/manga");
    items = Array.isArray(result && result.items) ? result.items : [];

    return App.createPagedResults({
      results: mapSeriesItems(items),
      metadata: getNextPageMetadata(result, page, items, SEARCH_PAGE_SIZE)
    });
  };

  // Source-Specific Fetch Helpers

  ComixTo.prototype.getTopSectionItems = async function(type, page, homeFilters, sectionDays) {
    var filters = homeFilters || (await getHomeFilterParams(this.stateManager));
    var days = normalizeOptionValue(sectionDays, TOP_SECTION_RANGE_OPTIONS, TOP_SECTION_RANGE_DEFAULT);
    var result = extractApiResult(await this.fetchJson(buildApiUrl("/manga/top", Object.assign({
      type: type,
      days: days,
      page: page,
      limit: HOME_PAGE_SIZE
    }, filters))), "/manga/top");
    var items = Array.isArray(result && result.items) ? result.items : Array.isArray(result) ? result : [];

    return App.createPagedResults({
      results: mapSeriesItems(items),
      metadata: void 0
    });
  };

  ComixTo.prototype.getLatestSectionItems = async function(page, homeFilters) {
    var latestView = await getLatestUpdatesView(this.stateManager);
    var params = {
      order: { chapter_updated_at: "desc" }
    };

    if (latestView === LATEST_UPDATES_VIEW_HOT) {
      params.scope = "hot";
    }
    // The live API rejects scope=new. Omitting scope is the frontend's "New" view.

    return this.getSeriesListSectionItems(page, params, homeFilters);
  };

  ComixTo.prototype.getNewSectionItems = async function(page, homeFilters) {
    return this.getSeriesListSectionItems(page, {
      order: { created_at: "desc" }
    }, homeFilters);
  };

  ComixTo.prototype.getCompleteSectionItems = async function(page, homeFilters) {
    return this.getSeriesListSectionItems(page, {
      statuses: ["finished"],
      order: { chapter_updated_at: "desc" }
    }, homeFilters);
  };

  ComixTo.prototype.getSeriesListSectionItems = async function(page, baseParams, homeFilters) {
    var filters = homeFilters || (await getHomeFilterParams(this.stateManager));
    var params = Object.assign({
      page: page,
      limit: HOME_PAGE_SIZE
    }, filters, baseParams || {});
    var result = extractApiResult(await this.fetchJson(buildApiUrl("/manga", params)), "/manga");
    var items = Array.isArray(result && result.items) ? result.items : [];

    return App.createPagedResults({
      results: mapSeriesItems(items),
      metadata: getNextPageMetadata(result, page, items, HOME_PAGE_SIZE)
    });
  };

  ComixTo.prototype.getFilterData = async function() {
    if (this.cachedFilterData) {
      return this.cachedFilterData;
    }

    try {
      this.cachedFilterData = mergeFilterOptions(FALLBACK_FILTER_OPTIONS, await this.fetchBrowseOptions());
    } catch (error) {
      this.cachedFilterData = FALLBACK_FILTER_OPTIONS;
    }

    return this.cachedFilterData;
  };

  ComixTo.prototype.fetchBrowseOptions = async function() {
    var options;

    // Comix's raw server-rendered browse payload lives at /browse. /browser can
    // hydrate in a web browser, but extension-style HTML/API requests get 404.
    var html = await this.fetchText(DOMAIN + "/browse");
    var initialData = parseInitialData(html);
    options = Object.assign({}, initialData && initialData.list && initialData.list.options || {});

    try {
      options.themes = await this.fetchTagOptions("tag");
    } catch (error) {
      // /tags/search is best-effort. /browse still provides the fixed filters.
    }

    return options;
  };

  function parseInitialData(html) {
    var match = String(html || "").match(/<script\b(?=[^>]*\bid=["']initial-data["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i);
    var raw;

    if (!match) {
      return {};
    }

    raw = match[1];

    try {
      return JSON.parse(raw);
    } catch (error) {
      // Continue to the entity-decoded fallback below.
    }

    try {
      return JSON.parse(decodeHtmlEntities(raw));
    } catch (error) {
      return {};
    }
  }

  ComixTo.prototype.fetchTagOptions = async function(type) {
    var result = extractApiResult(await this.fetchJson(buildApiUrl("/tags/search", {
      type: type,
      // Comix v1 rejects limits above 50.
      limit: 50
    })), "/tags/search");

    return Array.isArray(result) ? result : [];
  };

  ComixTo.prototype.fetchJson = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseJsonResponse(response, url);
  };

  ComixTo.prototype.fetchText = async function(url) {
    var response = await this.requestManager.schedule(App.createRequest({
      url: url,
      method: "GET"
    }), 1);

    return parseTextResponse(response, url);
  };

  // Response Helpers

  function parseJsonResponse(response, url) {
    var raw = response && typeof response.data === "string" ? response.data : JSON.stringify(response && response.data || "");
    var parsed;
    ensureReadableResponse(response, raw, url);

    if (isObject(response.data)) {
      return decodeComixEnvelope(response.data, url);
    }

    try {
      parsed = JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("ComixTo returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }

    return decodeComixEnvelope(parsed, url);
  }

  function decodeComixEnvelope(payload, url) {
    var decrypted;

    if (!isObject(payload) || typeof payload.e !== "string") {
      return payload;
    }

    try {
      decrypted = decryptComixEnvelope(payload.e);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error("ComixTo returned an unreadable encrypted API envelope from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(JSON.stringify(payload)));
    }
  }

  function parseTextResponse(response, url) {
    var raw = extractTextResponseData(response && response.data);
    ensureReadableResponse(response, raw, url);
    return raw;
  }

  function extractTextResponseData(data) {
    var raw;
    var parsed;

    if (isObject(data) && typeof data.result === "string") {
      return data.result;
    }

    raw = String(data || "");

    try {
      parsed = JSON.parse(raw);
      if (isObject(parsed) && typeof parsed.result === "string") {
        return parsed.result;
      }
    } catch (error) {
      // Keep the raw response body.
    }

    return raw;
  }

  function ensureReadableResponse(response, body, url) {
    if (!response || typeof response.status !== "number") {
      throw new Error("ComixTo returned an invalid response from " + formatRequestLabel(url) + ".");
    }

    if (isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested ComixTo page was not found.");
    }

    if (response.status >= 400) {
      throw new Error("ComixTo returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildDiagnosticPreview(body));
    }
  }

  function extractApiResult(payload, label) {
    if (!isObject(payload)) {
      throw new Error("ComixTo returned an invalid API payload from " + label + ".");
    }

    if (cleanText(payload.status || "ok").toLowerCase() !== "ok") {
      throw new Error("ComixTo returned an API error from " + label + "." + buildDiagnosticPreview(JSON.stringify(payload)));
    }

    if (payload.result !== void 0) {
      return payload.result;
    }

    return payload;
  }

  function buildDiagnosticPreview(body) {
    var preview = cleanText(stripHtml(body || ""));
    if (preview.length === 0) {
      return "";
    }

    if (preview.length > 120) {
      preview = preview.slice(0, 120) + "...";
    }

    return ' Preview: "' + preview.replace(/"/g, "'") + '"';
  }

  function isChallengePage(body) {
    var text = String(body || "").toLowerCase();
    var hasHtmlShell = text.indexOf("<html") >= 0 || text.indexOf("<!doctype html") >= 0;
    var hasCloudflareMarker = text.indexOf("cloudflare") >= 0 ||
      text.indexOf("cf-ray") >= 0 ||
      text.indexOf("cf_chl_") >= 0 ||
      text.indexOf("cf-browser-verification") >= 0 ||
      text.indexOf("/cdn-cgi/challenge-platform") >= 0 ||
      text.indexOf("cf-mitigated") >= 0;
    var hasChallengeMarker = text.indexOf("just a moment") >= 0 ||
      text.indexOf("attention required") >= 0 ||
      text.indexOf("checking your browser") >= 0 ||
      text.indexOf("verify you are human") >= 0 ||
      text.indexOf("please enable cookies") >= 0 ||
      text.indexOf("challenge-platform") >= 0 ||
      text.indexOf("cf_chl_opt") >= 0 ||
      text.indexOf("captcha") >= 0 ||
      text.indexOf("cf-error-code") >= 0;

    return hasHtmlShell && hasCloudflareMarker && hasChallengeMarker;
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

  // Series / Card Helpers

  function mapSeriesItems(items) {
    return normalizeSeriesItems(items).map(function(item) {
      return createPartialSeries(item);
    });
  }

  function createPartialSeries(item) {
    return App.createPartialSourceManga({
      mangaId: String(item.hid || item.id || ""),
      title: cleanText(item.title || ""),
      image: choosePoster(item.poster || item.cover),
      subtitle: emptyToUndefined(buildSeriesSubtitle(item))
    });
  }

  function normalizeSeriesItems(items) {
    var seen = {};
    var ordered = [];

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var id;

      if (!isObject(item) || item.hasChapters === false) {
        return;
      }

      id = cleanText(item.hid || item.id || "");
      if (id.length === 0 || cleanText(item.title || "").length === 0 || seen[id]) {
        return;
      }

      seen[id] = true;
      ordered.push(item);
    });

    return ordered;
  }

  function buildSeriesSubtitle(item) {
    var latestChapter = toNumber(item && item.latestChapter, NaN);
    var status;

    if (isFinite(latestChapter) && (latestChapter > 0 || (item && item.hasChapters === true && latestChapter >= 0))) {
      return "Chapter " + formatChapterNumber(latestChapter);
    }

    status = formatStatus(item && item.status);
    return status.length > 0 ? status : void 0;
  }

  // Homepage Helpers

  function createHomeSection(id, title, type, pagedResults) {
    return App.createHomeSection({
      id: id,
      title: title,
      type: type,
      items: Array.isArray(pagedResults && pagedResults.results) ? pagedResults.results : [],
      containsMoreItems: pagedResults && pagedResults.metadata !== void 0
    });
  }

  // Search / Filter Helpers

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var demographics = normalizeFilterOptions(filterData && filterData.demographics);
    var formats = normalizeFilterOptions(filterData && filterData.formats);
    var themes = normalizeFilterOptions(filterData && filterData.themes);
    var statuses = normalizeFilterOptions(filterData && filterData.statuses);
    var types = normalizeFilterOptions(filterData && filterData.types);
    var sorts = normalizeFilterOptions(filterData && filterData.sorts);

    pushSearchTagSection(sections, "genres", "Genres", TAG_PREFIX_GENRE, genres);
    pushSearchTagSection(sections, "formats", "Formats", TAG_PREFIX_FORMAT, formats);
    pushSearchTagSection(sections, "themes", "Themes", TAG_PREFIX_THEME, themes);
    sections.push(App.createTagSection({
      id: "genre_match",
      label: "Genre Match",
      tags: [
        App.createTag({
          id: TAG_PREFIX_GENRE_MODE + "and",
          label: "All Included Tags"
        }),
        App.createTag({
          id: TAG_PREFIX_GENRE_MODE + "or",
          label: "Any Included Tag"
        })
      ]
    }));
    pushSearchTagSection(sections, "demographics", "Demographics", TAG_PREFIX_DEMOGRAPHIC, demographics);
    pushSearchTagSection(sections, "statuses", "Status", TAG_PREFIX_STATUS, statuses);
    pushSearchTagSection(sections, "types", "Type", TAG_PREFIX_TYPE, types);
    pushSearchTagSection(sections, "sorts", "Sort", TAG_PREFIX_SORT, sorts);

    return sections;
  }

  function pushSearchTagSection(sections, id, label, prefix, options) {
    if (!Array.isArray(options) || options.length === 0) {
      return;
    }

    sections.push(App.createTagSection({
      id: id,
      label: label,
      tags: options.map(function(option) {
        return App.createTag({
          id: prefix + option.id,
          label: option.label
        });
      })
    }));
  }

  function normalizeFilterOptions(values) {
    var seen = {};
    var normalized = [];

    normalizeArray(values).forEach(function(value) {
      var id = "";
      var label = "";
      var key;

      if (Array.isArray(value)) {
        id = cleanText(value[0]);
        label = cleanText(value[1] || value[0]);
      } else if (typeof value === "string") {
        id = cleanText(value);
        label = formatOptionLabel(value);
      } else if (isObject(value)) {
        id = cleanText(value.id || value.slug || value.value || value.key || "");
        label = cleanText(value.label || value.name || value.title || value.slug || value.id || "");
      }

      key = id.toLowerCase();
      if (id.length === 0 || label.length === 0 || seen[key]) {
        return;
      }

      seen[key] = true;
      normalized.push({ id: id, label: label });
    });

    return normalized;
  }

  function extractSearchFilters(query) {
    var filters = {
      genresIn: [],
      genresEx: [],
      demographics: [],
      statuses: [],
      types: [],
      authors: [],
      artists: [],
      sort: void 0,
      genresMode: "and",
      minChapters: extractMinimumChaptersFilterValue(query)
    };
    var includedTags = Array.isArray(query && query.includedTags) ? query.includedTags : [];
    var excludedTags = Array.isArray(query && query.excludedTags) ? query.excludedTags : [];

    includedTags.forEach(function(tag) {
      var tagId = String(tag && tag.id || "");
      var value;

      if (tagId.indexOf(TAG_PREFIX_GENRE) === 0) {
        value = tagId.slice(TAG_PREFIX_GENRE.length);
        pushUnique(filters.genresIn, value);
      } else if (tagId.indexOf(TAG_PREFIX_FORMAT) === 0) {
        // Comix models format terms as genre terms in the browse API.
        value = tagId.slice(TAG_PREFIX_FORMAT.length);
        pushUnique(filters.genresIn, value);
      } else if (tagId.indexOf(TAG_PREFIX_THEME) === 0) {
        // Comix models theme/tag terms as genre terms in the browse API.
        value = tagId.slice(TAG_PREFIX_THEME.length);
        pushUnique(filters.genresIn, value);
      } else if (tagId.indexOf(TAG_PREFIX_GENRE_MODE) === 0) {
        value = tagId.slice(TAG_PREFIX_GENRE_MODE.length).toLowerCase();
        if (value === "or") {
          filters.genresMode = "or";
        } else if (value === "and") {
          filters.genresMode = "and";
        }
      } else if (tagId.indexOf(TAG_PREFIX_DEMOGRAPHIC) === 0) {
        value = tagId.slice(TAG_PREFIX_DEMOGRAPHIC.length);
        pushUnique(filters.demographics, value);
      } else if (tagId.indexOf(TAG_PREFIX_STATUS) === 0) {
        value = tagId.slice(TAG_PREFIX_STATUS.length);
        pushUnique(filters.statuses, value);
      } else if (tagId.indexOf(TAG_PREFIX_TYPE) === 0) {
        value = tagId.slice(TAG_PREFIX_TYPE.length);
        pushUnique(filters.types, value);
      } else if (tagId.indexOf(TAG_PREFIX_AUTHOR) === 0) {
        value = tagId.slice(TAG_PREFIX_AUTHOR.length);
        pushUnique(filters.authors, value);
      } else if (tagId.indexOf(TAG_PREFIX_ARTIST) === 0) {
        value = tagId.slice(TAG_PREFIX_ARTIST.length);
        pushUnique(filters.artists, value);
      } else if (tagId.indexOf(TAG_PREFIX_SORT) === 0 && filters.sort === void 0) {
        filters.sort = tagId.slice(TAG_PREFIX_SORT.length);
      }
    });

    excludedTags.forEach(function(tag) {
      var tagId = String(tag && tag.id || "");
      var value;

      if (tagId.indexOf(TAG_PREFIX_GENRE) === 0) {
        value = tagId.slice(TAG_PREFIX_GENRE.length);
        pushUnique(filters.genresEx, value);
      } else if (tagId.indexOf(TAG_PREFIX_FORMAT) === 0) {
        value = tagId.slice(TAG_PREFIX_FORMAT.length);
        pushUnique(filters.genresEx, value);
      } else if (tagId.indexOf(TAG_PREFIX_THEME) === 0) {
        value = tagId.slice(TAG_PREFIX_THEME.length);
        pushUnique(filters.genresEx, value);
      }
      // Status, type, demographic, author, and artist exclusions are ignored
      // because the Comix browse API does not honor *_ex params for them.
    });

    return filters;
  }

  function createMinimumChaptersSearchField() {
    var field = {
      id: SEARCH_FIELD_MIN_CHAPTERS,
      name: "Minimum Chapters",
      placeholder: "e.g. 10"
    };
    return typeof App !== "undefined" && App && typeof App.createSearchField === "function" ? App.createSearchField(field) : field;
  }

  function extractMinimumChaptersFilterValue(query) {
    var parameters = isObject(query && query.parameters) ? query.parameters : {};
    var values = Array.isArray(parameters[SEARCH_FIELD_MIN_CHAPTERS]) ? parameters[SEARCH_FIELD_MIN_CHAPTERS] : [];
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
    if (!/^\d+$/.test(rawValue)) {
      throw new Error("Minimum Chapters must be a positive whole number.");
    }

    var minChapters = parseInt(rawValue, 10);
    if (!isFinite(minChapters) || minChapters <= 0) {
      throw new Error("Minimum Chapters must be a positive whole number.");
    }

    return minChapters;
  }

  function parseSortOption(value) {
    var sort = cleanText(value || DEFAULT_SORT);
    var parts = sort.split(":");
    var field = cleanText(parts[0] || DEFAULT_SORT.split(":")[0]);
    var direction = cleanText(parts[1] || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    var order = {};

    order[field] = direction;
    return order;
  }

  function mergeFilterOptions(fallback, fetched) {
    var merged = Object.assign({}, fallback || {});

    Object.keys(fetched || {}).forEach(function(key) {
      if (Array.isArray(fetched[key]) && fetched[key].length > 0) {
        merged[key] = fetched[key];
      }
    });

    return merged;
  }

  // Detail Helpers

  function buildTitles(title, alternateTitles) {
    var seen = {};
    var titles = [];

    [title].concat(normalizeStringArray(alternateTitles)).forEach(function(value) {
      var clean = cleanText(value || "");
      var key = clean.toLowerCase();

      if (clean.length > 0 && !seen[key]) {
        seen[key] = true;
        titles.push(clean);
      }
    });

    return titles.length > 0 ? titles : ["Unknown Title"];
  }

  function choosePoster(poster) {
    if (typeof poster === "string") {
      return cleanText(poster);
    }

    if (isObject(poster)) {
      return cleanText(poster.large || poster.medium || poster.original || poster.url || "");
    }

    return "";
  }

  function buildDetailTagSections(details) {
    details = details || {};

    var sections = [];
    var genreTags = normalizeDetailTags(combineDetailValues(details.genres, details.categories));
    var themeTags = normalizeDetailTags(combineDetailValues(details.tags, details.themes));
    var metadataTags = [];
    var authorTags = normalizeDetailTags(combineDetailValues(details.authors, details.author));
    var artistTags = normalizeDetailTags(combineDetailValues(details.artists, details.artist));

    normalizeDetailTags(combineDetailValues(details.demographics, details.demographic)).forEach(function(tag) {
      metadataTags.push(createPrefixedTag(TAG_PREFIX_DEMOGRAPHIC, tag.id, "Demographic: " + tag.label));
    });

    normalizeDetailTags(combineDetailValues(details.formats, details.format)).forEach(function(tag) {
      metadataTags.push(createPrefixedTag(TAG_PREFIX_FORMAT, tag.id, "Format: " + tag.label));
    });

    pushPrefixedMetadataTag(metadataTags, TAG_PREFIX_TYPE, details.type, "Type", formatType(details.type));
    pushPrefixedMetadataTag(metadataTags, TAG_PREFIX_STATUS, details.status, "Status", formatStatus(details.status));

    if (genreTags.length > 0) {
      sections.push(App.createTagSection({
        id: "genres",
        label: "Genres",
        tags: genreTags.map(function(tag) {
          return createPrefixedTag(TAG_PREFIX_GENRE, tag.id, tag.label);
        })
      }));
    }

    if (themeTags.length > 0) {
      sections.push(App.createTagSection({
        id: "themes",
        label: "Themes",
        tags: themeTags.map(function(tag) {
          return createPrefixedTag(TAG_PREFIX_THEME, tag.id, tag.label);
        })
      }));
    }

    if (authorTags.length > 0) {
      sections.push(App.createTagSection({
        id: "authors",
        label: "Authors",
        tags: authorTags.map(function(tag) {
          return createPrefixedTag(TAG_PREFIX_AUTHOR, tag.id, "Author: " + tag.label);
        })
      }));
    }

    if (artistTags.length > 0) {
      sections.push(App.createTagSection({
        id: "artists",
        label: "Artists",
        tags: artistTags.map(function(tag) {
          return createPrefixedTag(TAG_PREFIX_ARTIST, tag.id, "Artist: " + tag.label);
        })
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

  function combineDetailValues() {
    var values = [];
    var index;

    for (index = 0; index < arguments.length; index += 1) {
      values = values.concat(normalizeArray(arguments[index]));
    }

    return values;
  }

  function normalizeDetailTags(values) {
    var seen = {};
    var tags = [];

    normalizeArray(values).forEach(function(value) {
      var id = "";
      var label = "";
      var key;

      if (typeof value === "string") {
        label = cleanText(value);
        id = label.toLowerCase();
      } else if (isObject(value)) {
        label = cleanText(value.label || value.name || value.title || value.slug || value.id || "");
        id = cleanText(value.id || value.slug || value.name || label);
      }

      key = label.toLowerCase();
      if (label.length === 0 || seen[key]) {
        return;
      }

      seen[key] = true;
      tags.push({
        id: id.length > 0 ? id : key,
        label: label
      });
    });

    return tags;
  }

  function createPrefixedTag(prefix, id, label) {
    var cleanId = cleanText(id || "");
    return App.createTag({
      id: cleanId.indexOf(prefix) === 0 ? cleanId : prefix + cleanId,
      label: label
    });
  }

  function pushPrefixedMetadataTag(tags, prefix, id, labelPrefix, labelValue) {
    var cleanId = cleanText(id || "");
    var cleanLabel = cleanText(labelValue || "");

    if (cleanId.length > 0 && cleanLabel.length > 0) {
      tags.push(createPrefixedTag(prefix, cleanId, labelPrefix + ": " + cleanLabel));
    }
  }

  function isExplicitSeries(details) {
    details = details || {};

    var rating = cleanText((details.contentRating || details.content_rating) || "").toLowerCase();
    var genreLikeTags = normalizeDetailTags(
      combineDetailValues(details.genres, details.categories, details.tags, details.themes)
    );
    var explicitLabels = {
      adult: true,
      erotica: true,
      explicit: true,
      hentai: true,
      pornographic: true,
      smut: true
    };

    if (explicitLabels[rating]) {
      return true;
    }

    return genreLikeTags.some(function(tag) {
      return explicitLabels[tag.label.toLowerCase()];
    });
  }

  function joinContributorNames(values) {
    var seen = {};
    var names = [];

    normalizeStringArray(values).forEach(function(name) {
      var key = name.toLowerCase();

      if (key.length > 0 && !seen[key]) {
        seen[key] = true;
        names.push(name);
      }
    });

    return names.join(", ");
  }

  function mapStatus(status) {
    var value = cleanText(status || "").toLowerCase().replace(/-/g, "_");

    if (value === "releasing" || value === "ongoing") {
      return "ONGOING";
    }

    if (value === "finished" || value === "completed") {
      return "COMPLETED";
    }

    if (value === "on_hiatus" || value === "hiatus") {
      return "HIATUS";
    }

    return "UNKNOWN";
  }

  function normalizeRating(value) {
    var rating = toNumber(value, 0);
    return rating > 5 ? rating / 2 : rating;
  }

  function formatStatus(status) {
    return formatOptionLabel(status);
  }

  function formatType(type) {
    return formatOptionLabel(type);
  }

  // Chapter Helpers

  function buildChapterName(chapter, chapterNumber) {
    var rawName = cleanText(chapter.name || chapter.title || "");
    var prefix;

    if (!isFinite(chapterNumber) || chapterNumber <= 0) {
      return rawName.length > 0 ? rawName : "Chapter";
    }

    prefix = "Chapter " + formatChapterNumber(chapterNumber);
    if (rawName.length === 0 || rawName.toLowerCase() === prefix.toLowerCase()) {
      return prefix;
    }

    return prefix + ": " + rawName;
  }

  function compareChaptersDesc(a, b) {
    return toNumber(b && b.number, 0) - toNumber(a && a.number, 0);
  }

  function normalizeChapterPages(pages) {
    var baseUrl = "";
    var items = pages;

    if (isObject(pages)) {
      baseUrl = cleanText(pages.baseUrl || pages.base_url || "");
      items = pages.items;
    }

    return (Array.isArray(items) ? items : []).map(function(page) {
      return normalizeChapterPageUrl(page, baseUrl);
    }).filter(function(page) {
      return page.length > 0;
    });
  }

  function normalizeChapterPageUrl(page, baseUrl) {
    var url = typeof page === "string" ? cleanText(page) : cleanText(page && (page.url || page.src || page.path) || "");

    if (url.length === 0 || /^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      return normalizeReadableChapterImageUrl(url);
    }

    if (url.indexOf("//") === 0) {
      return normalizeReadableChapterImageUrl("https:" + url);
    }

    if (baseUrl.length === 0) {
      return normalizeReadableChapterImageUrl(url);
    }

    return normalizeReadableChapterImageUrl(baseUrl.replace(/\/+$/, "") + "/" + url.replace(/^\/+/, ""));
  }

  function normalizeReadableChapterImageUrl(url) {
    // Current /i/ variants often return 404 HTML. Keep raw /si/ transport.
    // API pages with s:1 remain visually scrambled until an external descrambler exists.
    return url;
  }

  function dedupeById(items) {
    var seen = {};
    var ordered = [];

    (Array.isArray(items) ? items : []).forEach(function(item) {
      var id = getChapterId(item);

      if (id.length === 0 || seen[id]) {
        return;
      }

      seen[id] = true;
      ordered.push(item);
    });

    return ordered;
  }

  function applyChapterGroupSettings(chapters, settings) {
    var mode = settings && settings.mode || GROUP_MODE_ALL;
    var tokens = settings && Array.isArray(settings.tokens) ? settings.tokens : [];

    if (tokens.length === 0 || mode === GROUP_MODE_ALL) {
      return chapters;
    }

    if (mode === GROUP_MODE_HIDE) {
      return chapters.filter(function(chapter) {
        return !chapterMatchesGroupTokens(chapter, tokens);
      });
    }

    if (mode === GROUP_MODE_ONLY) {
      return chapters.filter(function(chapter) {
        return chapterMatchesGroupTokens(chapter, tokens);
      });
    }

    if (mode === GROUP_MODE_PREFER) {
      return collapseDuplicateChapterGroups(chapters, tokens);
    }

    return chapters;
  }

  function hasActiveChapterGroupFilter(settings) {
    return !!settings &&
      settings.mode !== GROUP_MODE_ALL &&
      Array.isArray(settings.tokens) &&
      settings.tokens.length > 0;
  }

  function collapseDuplicateChapterGroups(chapters, tokens) {
    var grouped = {};
    var order = [];
    var output = [];

    chapters.forEach(function(chapter) {
      var key = getChapterNumberKey(chapter);

      if (key.length === 0) {
        output.push(chapter);
        return;
      }

      if (!grouped[key]) {
        grouped[key] = [];
        order.push(key);
      }

      grouped[key].push(chapter);
    });

    order.forEach(function(key) {
      output.push(selectPreferredChapter(grouped[key], tokens));
    });

    return output;
  }

  function selectPreferredChapter(chapters, tokens) {
    var selected = chapters[0];
    var selectedIndex = getGroupTokenIndex(selected, tokens);

    chapters.forEach(function(chapter) {
      var tokenIndex = getGroupTokenIndex(chapter, tokens);

      if (tokenIndex >= 0 && (selectedIndex < 0 || tokenIndex < selectedIndex)) {
        selected = chapter;
        selectedIndex = tokenIndex;
      }
    });

    return selected;
  }

  function getChapterNumberKey(chapter) {
    var number = chapter && chapter.number !== void 0 && chapter.number !== null ? String(chapter.number).trim() : "";
    var volume = chapter && chapter.volume !== void 0 && chapter.volume !== null ? String(chapter.volume).trim() : "";

    return number.length > 0 ? volume + ":" + number : "";
  }

  function parseGroupFilterTokens(value) {
    var seen = {};
    var tokens = [];

    String(value || "").split(",").forEach(function(part) {
      var token = cleanText(part).toLowerCase();
      if (token.length > 0 && !seen[token]) {
        seen[token] = true;
        tokens.push(token);
      }
    });

    return tokens;
  }

  function chapterMatchesGroupTokens(chapter, tokens) {
    return getGroupTokenIndex(chapter, tokens) >= 0;
  }

  function getGroupTokenIndex(chapter, tokens) {
    var groupId = getChapterGroupId(chapter).toLowerCase();
    var groupName = getChapterGroupName(chapter).toLowerCase();

    for (var index = 0; index < tokens.length; index += 1) {
      if (tokens[index] === groupId || tokens[index] === groupName) {
        return index;
      }
    }

    return -1;
  }

  function getChapterGroupId(chapter) {
    var group = chapter && (chapter.group || chapter.scanlation_group || chapter.scanlationGroup);

    return cleanText(
      group && (group.id || group.hid) ||
      chapter && (chapter.groupId || chapter.group_id || chapter.scanlationGroupId || chapter.scanlation_group_id) ||
      ""
    );
  }

  function getChapterGroupName(chapter) {
    var group = chapter && (chapter.group || chapter.scanlation_group || chapter.scanlationGroup);

    if (typeof group === "string") {
      return cleanText(group);
    }

    return cleanText(
      group && (group.name || group.title || group.slug) ||
      chapter && (chapter.groupName || chapter.group_name || chapter.scanlationGroupName || chapter.scanlation_group_name) ||
      ""
    );
  }

  function getChapterId(chapter) {
    return cleanText(chapter && chapter.id || "");
  }

  function cacheChapterShareUrl(source, chapterId, url) {
    var cleanId = cleanText(chapterId || "");
    var cleanUrl = cleanText(url || "");

    if (cleanId.length > 0 && cleanUrl.indexOf(DOMAIN + "/title/") === 0) {
      source.cachedChapterShareUrls[cleanId] = cleanUrl;
    }
  }

  function flatten(arrays) {
    var flattened = [];

    (Array.isArray(arrays) ? arrays : []).forEach(function(array) {
      (Array.isArray(array) ? array : []).forEach(function(value) {
        flattened.push(value);
      });
    });

    return flattened;
  }

  function buildChapterDateFallbacks(chapters, fetchedAt) {
    var fallbacks = {};

    (Array.isArray(chapters) ? chapters : []).forEach(function(chapter) {
      var key = getChapterNumberKey(chapter);
      var dateInfo;

      if (key.length === 0) {
        return;
      }

      dateInfo = getOwnChapterDateInfo(chapter, fetchedAt);
      if (!dateInfo) {
        return;
      }

      if (!fallbacks[key] || dateInfo.quality > fallbacks[key].quality) {
        fallbacks[key] = dateInfo;
      }
    });

    return fallbacks;
  }

  function getChapterDate(chapter, fetchedAt, duplicateDateFallbacks) {
    var ownDate = getOwnChapterDate(chapter, fetchedAt);
    var key;
    var fallback;

    if (ownDate) {
      return ownDate;
    }

    key = getChapterNumberKey(chapter);
    fallback = key.length > 0 && duplicateDateFallbacks && duplicateDateFallbacks[key];
    if (fallback && fallback.date) {
      return new Date(fallback.date.getTime());
    }

    return createUnknownChapterDate(fetchedAt);
  }

  function getOwnChapterDate(chapter, fetchedAt) {
    var dateInfo = getOwnChapterDateInfo(chapter, fetchedAt);

    return dateInfo && dateInfo.date;
  }

  function getOwnChapterDateInfo(chapter, fetchedAt) {
    var absoluteFields = [
      chapter && chapter.publishedAt,
      chapter && chapter.published_at,
      chapter && chapter.publishAt,
      chapter && chapter.publish_at,
      chapter && chapter.releasedAt,
      chapter && chapter.released_at,
      chapter && chapter.uploadedAt,
      chapter && chapter.uploaded_at,
      chapter && chapter.publishedAtTimestamp,
      chapter && chapter.published_at_timestamp,
      chapter && chapter.releasedAtTimestamp,
      chapter && chapter.released_at_timestamp,
      chapter && chapter.uploadedAtTimestamp,
      chapter && chapter.uploaded_at_timestamp,
      chapter && chapter.createdAt,
      chapter && chapter.created_at,
      chapter && chapter.createdAtTimestamp,
      chapter && chapter.created_at_timestamp,
      chapter && chapter.updatedAt,
      chapter && chapter.updated_at,
      chapter && chapter.updatedAtTimestamp,
      chapter && chapter.updated_at_timestamp
    ];
    var index;
    var date;

    for (index = 0; index < absoluteFields.length; index += 1) {
      date = parseAbsoluteDate(absoluteFields[index]);
      if (date) {
        return {
          date: date,
          quality: 2
        };
      }
    }

    date = parseRelativeChapterDate([
      chapter && chapter.createdAtFormatted,
      chapter && chapter.created_at_formatted,
      chapter && chapter.updatedAtFormatted,
      chapter && chapter.updated_at_formatted,
      chapter && chapter.chapterUpdatedAtFormatted,
      chapter && chapter.chapter_updated_at_formatted,
      chapter && chapter.publishedAtFormatted,
      chapter && chapter.published_at_formatted,
      chapter && chapter.releasedAtFormatted,
      chapter && chapter.released_at_formatted,
      chapter && chapter.uploadedAtFormatted,
      chapter && chapter.uploaded_at_formatted
    ], fetchedAt);
    if (date) {
      return {
        date: date,
        quality: 1
      };
    }

    return null;
  }

  function createUnknownChapterDate(fetchedAt) {
    return new Date(fetchedAt);
  }

  function parseRelativeChapterDate(values, fetchedAt) {
    var candidates = Array.isArray(values) ? values : [values];
    var index;
    var parsed;

    for (index = 0; index < candidates.length; index += 1) {
      parsed = parseSingleRelativeChapterDate(candidates[index], fetchedAt);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  function parseSingleRelativeChapterDate(value, fetchedAt) {
    var text = cleanText(value || "").toLowerCase();
    var match;
    var amount;
    var unit;
    var multipliers = {
      s: 1000,
      sec: 1000,
      secs: 1000,
      second: 1000,
      seconds: 1000,
      m: 60000,
      min: 60000,
      mins: 60000,
      minute: 60000,
      minutes: 60000,
      h: 3600000,
      hr: 3600000,
      hrs: 3600000,
      hour: 3600000,
      hours: 3600000,
      d: 86400000,
      day: 86400000,
      days: 86400000,
      w: 604800000,
      week: 604800000,
      weeks: 604800000,
      mo: 2592000000,
      mos: 2592000000,
      mon: 2592000000,
      mons: 2592000000,
      month: 2592000000,
      months: 2592000000,
      y: 31536000000,
      yr: 31536000000,
      yrs: 31536000000,
      year: 31536000000,
      years: 31536000000
    };

    if (text === "just now" || text === "now" || text === "today") {
      return new Date(fetchedAt);
    }

    if (text === "yesterday") {
      return new Date(fetchedAt - 86400000);
    }

    match = text.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|mos|mon|mons|month|months|y|yr|yrs|year|years)(?:\s+ago)?$/);
    if (!match) {
      return null;
    }

    amount = Number(match[1]);
    unit = match[2];
    if (!isFinite(amount) || amount < 0 || !multipliers[unit]) {
      return null;
    }

    return new Date(fetchedAt - amount * multipliers[unit]);
  }

  function parseAbsoluteDate(value) {
    var numberValue = Number(value);
    var date;

    if (isFinite(numberValue) && numberValue > 0) {
      return new Date(numberValue < 100000000000 ? numberValue * 1000 : numberValue);
    }

    if (typeof value !== "string" || isRelativeDateString(value)) {
      return null;
    }

    date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function isRelativeDateString(value) {
    var text = cleanText(value || "").toLowerCase();

    if (text.length === 0) {
      return true;
    }

    return /^(just now|now|today|yesterday)$/.test(text) ||
      /^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|mos|mon|mons|month|months|y|yr|yrs|year|years)(?:\s+ago)?$/.test(text);
  }

  function formatChapterNumber(number) {
    return String(number).replace(/\.0+$/, "");
  }

  // Source Settings Helpers

  function createSingleSelectSetting(stateManager, config) {
    return App.createDUISelect({
      id: config.id,
      label: config.label,
      options: getOptionIds(config.options),
      allowsMultiselect: false,
      labelResolver: async function(value) {
        return getOptionLabel(value, config.options, config.fallback);
      },
      value: App.createDUIBinding({
        get: async function() {
          return [await config.getValue(stateManager)];
        },
        set: async function(newValue) {
          await stateManager.store(config.id, normalizeOptionValue(newValue, config.options, config.fallback));
        }
      })
    });
  }

  function createMultiSelectSetting(stateManager, config) {
    return App.createDUISelect({
      id: config.id,
      label: config.label,
      options: getOptionIds(config.options),
      allowsMultiselect: true,
      labelResolver: async function(value) {
        return getOptionLabel(value, config.options, value);
      },
      value: App.createDUIBinding({
        get: async function() {
          return config.getValue(stateManager);
        },
        set: async function(newValue) {
          await stateManager.store(config.id, normalizeMultiOptionValues(newValue, config.options));
        }
      })
    });
  }

  function getOptionIds(options) {
    return options.map(function(option) {
      return option.id;
    });
  }

  async function getContentRating(stateManager) {
    return normalizeOptionValue(await stateManager.retrieve(STATE_CONTENT_RATING), CONTENT_RATING_OPTIONS, CONTENT_RATING_DEFAULT);
  }

  async function getLatestUpdatesView(stateManager) {
    return normalizeLatestUpdatesView(await stateManager.retrieve(STATE_LATEST_UPDATES_VIEW));
  }

  async function getTrendingDays(stateManager) {
    return normalizeOptionValue(await stateManager.retrieve(STATE_TRENDING_RANGE), TOP_SECTION_RANGE_OPTIONS, TOP_SECTION_RANGE_DEFAULT);
  }

  async function getMostFollowedDays(stateManager) {
    return normalizeOptionValue(await stateManager.retrieve(STATE_MOST_FOLLOWED_RANGE), TOP_SECTION_RANGE_OPTIONS, TOP_SECTION_RANGE_DEFAULT);
  }

  async function getHomeDemographics(stateManager) {
    return normalizeMultiOptionValues(await stateManager.retrieve(STATE_HOME_DEMOGRAPHICS), HOME_DEMOGRAPHIC_OPTIONS);
  }

  async function getHomeTypes(stateManager) {
    return normalizeMultiOptionValues(await stateManager.retrieve(STATE_HOME_TYPES), HOME_TYPE_OPTIONS);
  }

  async function getHomeFilterParams(stateManager) {
    var contentRating = await getContentRating(stateManager);
    var demographics = await getHomeDemographics(stateManager);
    var types = await getHomeTypes(stateManager);
    var params = {
      content_rating: contentRating
    };

    if (demographics.length > 0 && demographics.length < HOME_DEMOGRAPHIC_OPTIONS.length) {
      // The browse API uses numeric demographics, but the homepage/top frontend uses
      // slug-valued genders[] for the same concept.
      params.genders = demographics;
    }

    if (types.length > 0 && types.length < HOME_TYPE_OPTIONS.length) {
      params.types = types;
    }

    return params;
  }

  function normalizeLatestUpdatesView(value) {
    return normalizeOptionValue(value, LATEST_UPDATES_VIEW_OPTIONS, LATEST_UPDATES_VIEW_HOT);
  }

  function normalizeGroupMode(value) {
    return normalizeOptionValue(value, GROUP_MODE_OPTIONS, GROUP_MODE_ALL);
  }

  async function getChapterGroupMode(stateManager) {
    return normalizeGroupMode(await stateManager.retrieve(STATE_CHAPTER_GROUP_MODE));
  }

  async function getChapterGroupFilterText(stateManager) {
    return cleanText(await stateManager.retrieve(STATE_CHAPTER_GROUP_FILTER) || "");
  }

  async function getChapterGroupSettings(stateManager) {
    return {
      mode: await getChapterGroupMode(stateManager),
      tokens: parseGroupFilterTokens(await getChapterGroupFilterText(stateManager))
    };
  }

  function normalizeOptionValue(value, options, fallback) {
    var rawValue = Array.isArray(value) ? value[0] : value;
    var normalized = cleanText(rawValue || "").toLowerCase();

    for (var index = 0; index < options.length; index += 1) {
      if (String(options[index].id).toLowerCase() === normalized) {
        return options[index].id;
      }
    }

    return fallback;
  }

  function normalizeMultiOptionValues(value, options) {
    var values = Array.isArray(value) ? value : normalizeArray(value);
    var validIds = {};
    var selected = [];

    options.forEach(function(option) {
      validIds[String(option.id).toLowerCase()] = option.id;
    });

    values.forEach(function(entry) {
      var normalized = cleanText(entry || "").toLowerCase();
      var id = validIds[normalized];
      if (id && selected.indexOf(id) < 0) {
        selected.push(id);
      }
    });

    return selected.length > 0 ? selected : options.map(function(option) {
      return option.id;
    });
  }

  function getOptionLabel(value, options, fallback) {
    var normalized = normalizeOptionValue(value, options, fallback);

    for (var index = 0; index < options.length; index += 1) {
      if (options[index].id === normalized) {
        return options[index].label;
      }
    }

    return formatOptionLabel(normalized);
  }

  // Generic Utilities

  function buildApiUrl(path, params) {
    return API_BASE + path + buildQueryString(params);
  }

  function buildSignedApiUrl(path, params) {
    var signedParams = Object.assign({}, params || {});

    if (requiresComixHash(path)) {
      signedParams._ = generateComixHash(path);
    }

    return buildApiUrl(path, signedParams);
  }

  function requiresComixHash(path) {
    var normalizedPath = normalizeComixHashPath(path);

    // The live API rejects unsigned chapter lists, chapter indexes, and chapter detail requests.
    return /^\/manga\/[^/]+\/chapters$/.test(normalizedPath) ||
      /^\/manga\/[^/]+\/chapter-indexes$/.test(normalizedPath) ||
      /^\/chapters\/[^/]+$/.test(normalizedPath);
  }

  function buildQueryString(params) {
    var queryParts = [];

    Object.keys(params || {}).forEach(function(key) {
      appendQueryParam(queryParts, key, params[key]);
    });

    return queryParts.length > 0 ? "?" + queryParts.join("&") : "";
  }

  function appendQueryParam(queryParts, key, value) {
    if (value === void 0 || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(function(entry) {
        appendQueryParam(queryParts, key + "[]", entry);
      });
      return;
    }

    if (isObject(value)) {
      Object.keys(value).forEach(function(childKey) {
        appendQueryParam(queryParts, key + "[" + childKey + "]", value[childKey]);
      });
      return;
    }

    queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  }

  function getNextPageMetadata(result, page, items, pageSize) {
    var meta = result && result.meta;
    var currentPage = toPositiveInteger(page, 1);
    var hasNext;
    var lastPage;
    var total;
    var perPage;

    if (isObject(meta)) {
      hasNext = meta.hasNext;
      if (hasNext === void 0) {
        hasNext = meta.has_next;
      }

      if (hasNext === true) {
        return { page: currentPage + 1 };
      }

      if (hasNext === false) {
        return void 0;
      }

      lastPage = firstPositiveInteger([meta.lastPage, meta.last_page]);
      if (lastPage > 0) {
        return lastPage > currentPage ? { page: currentPage + 1 } : void 0;
      }

      total = firstPositiveInteger([meta.total]);
      perPage = firstPositiveInteger([meta.perPage, meta.per_page, pageSize]);
      if (total > 0 && perPage > 0) {
        return currentPage * perPage < total ? { page: currentPage + 1 } : void 0;
      }
    }

    if (Array.isArray(items) && items.length >= pageSize) {
      return { page: currentPage + 1 };
    }

    return void 0;
  }

  function firstPositiveInteger(values) {
    var candidates = Array.isArray(values) ? values : [values];
    var index;
    var numberValue;

    for (index = 0; index < candidates.length; index += 1) {
      numberValue = toPositiveInteger(candidates[index], 0);
      if (numberValue > 0) {
        return numberValue;
      }
    }

    return 0;
  }

  function normalizeStringArray(values) {
    return normalizeArray(values).map(function(value) {
      if (typeof value === "string") {
        return cleanText(value);
      }
      if (isObject(value)) {
        return cleanText(value.name || value.title || value.label || value.slug || "");
      }
      return "";
    }).filter(function(value) {
      return value.length > 0;
    });
  }

  function normalizeArray(values) {
    if (Array.isArray(values)) {
      return values;
    }
    if (values === void 0 || values === null || values === "") {
      return [];
    }
    return [values];
  }

  function formatOptionLabel(value) {
    return cleanText(value || "").replace(/[_-]+/g, " ").replace(/\b\w/g, function(char) {
      return char.toUpperCase();
    });
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || ""));
  }

  function cleanText(value) {
    return decodeHtmlEntities(String(value || ""))
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripHtml(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  function decodeHtmlEntities(value) {
    return String(value || "").replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, function(match, entity) {
      var lower = String(entity || "").toLowerCase();
      var code;

      if (lower === "amp") {
        return "&";
      }
      if (lower === "lt") {
        return "<";
      }
      if (lower === "gt") {
        return ">";
      }
      if (lower === "quot") {
        return "\"";
      }
      if (lower === "apos") {
        return "'";
      }
      if (lower.charAt(0) === "#") {
        code = lower.charAt(1) === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
        return safeCodePoint(code, match);
      }
      return match;
    });
  }

  function safeCodePoint(code, fallback) {
    if (!isFinite(code)) {
      return fallback;
    }

    try {
      return String.fromCodePoint(code);
    } catch (error) {
      return fallback;
    }
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : fallback;
  }

  function toPositiveInteger(value, fallback) {
    var parsed = Math.floor(toNumber(value, fallback));
    return parsed > 0 ? parsed : fallback;
  }

  function pushUnique(values, value) {
    var clean = cleanText(value || "");
    if (clean.length > 0 && values.indexOf(clean) < 0) {
      values.push(clean);
    }
  }

  function emptyToUndefined(value) {
    var clean = cleanText(value || "");
    return clean.length > 0 ? clean : void 0;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // Comix Request Signing

  function normalizeComixHashPath(path) {
    return String(path || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0].replace(/^\/api\/v1(?=\/|$)/, "");
  }

  function generateComixHash(path) {
    var normalizedPath = normalizeComixHashPath(path);
    var data = stringToUtf8Bytes(normalizedPath);
    var stages = getComixCipherStages();

    data = applyComixInverseCipherStage(data, stages[2]);
    data = applyComixInverseCipherStage(data, stages[1]);
    data = applyComixInverseCipherStage(data, stages[0]);

    return b64UrlEncode(data);
  }

  function decryptComixEnvelope(value) {
    var data = b64UrlDecode(value);
    var stages = getComixCipherStages();

    data = applyComixForwardCipherStage(data, stages[0]);
    data = applyComixForwardCipherStage(data, stages[1]);
    data = applyComixForwardCipherStage(data, stages[2]);

    return utf8BytesToString(data);
  }

  function getComixCipherStages() {
    var stages = [];
    var index;
    var stage;
    var table;
    var inverseTable;
    var tableIndex;

    if (decodedComixCipherStages !== null) {
      return decodedComixCipherStages;
    }

    for (index = 0; index < COMIX_CIPHER_STAGES.length; index += 1) {
      stage = COMIX_CIPHER_STAGES[index];
      table = b64Decode(stage.table);
      inverseTable = [];

      for (tableIndex = 0; tableIndex < table.length; tableIndex += 1) {
        inverseTable[table[tableIndex] & 255] = tableIndex & 255;
      }

      stages.push({
        table: table,
        inverseTable: inverseTable,
        key: b64Decode(stage.key),
        seed: stage.seed & 255
      });
    }

    decodedComixCipherStages = stages;
    return decodedComixCipherStages;
  }

  function applyComixForwardCipherStage(data, stage) {
    var output = [];
    var index;
    var input;
    var keyByte;
    var previous = stage.seed;

    for (index = 0; index < data.length; index += 1) {
      input = data[index] & 255;
      keyByte = stage.key.length > 0 ? stage.key[index % stage.key.length] & 255 : 0;
      output.push((stage.inverseTable[input] ^ keyByte ^ previous) & 255);
      previous = input;
    }

    return output;
  }

  function applyComixInverseCipherStage(data, stage) {
    var output = [];
    var index;
    var keyByte;
    var transformed;
    var previous = stage.seed;

    for (index = 0; index < data.length; index += 1) {
      keyByte = stage.key.length > 0 ? stage.key[index % stage.key.length] & 255 : 0;
      transformed = stage.table[(data[index] ^ keyByte ^ previous) & 255] & 255;
      output.push(transformed);
      previous = transformed;
    }

    return output;
  }

  function stringToUtf8Bytes(value) {
    var encoded = encodeURIComponent(value === void 0 || value === null ? "" : String(value));
    var output = [];
    var index = 0;
    var charCode;

    while (index < encoded.length) {
      if (encoded.charAt(index) === "%") {
        output.push(parseInt(encoded.slice(index + 1, index + 3), 16) & 255);
        index += 3;
      } else {
        charCode = encoded.charCodeAt(index);
        output.push(charCode & 255);
        index += 1;
      }
    }

    return output;
  }

  function utf8BytesToString(bytes) {
    var output = "";
    var index = 0;
    var byte1;
    var byte2;
    var byte3;
    var byte4;
    var codePoint;

    while (index < bytes.length) {
      byte1 = bytes[index] & 255;

      if (byte1 < 128) {
        output += String.fromCharCode(byte1);
        index += 1;
      } else if (byte1 >= 192 && byte1 < 224) {
        byte2 = bytes[index + 1] & 255;
        output += String.fromCharCode((byte1 & 31) << 6 | byte2 & 63);
        index += 2;
      } else if (byte1 >= 224 && byte1 < 240) {
        byte2 = bytes[index + 1] & 255;
        byte3 = bytes[index + 2] & 255;
        output += String.fromCharCode((byte1 & 15) << 12 | (byte2 & 63) << 6 | byte3 & 63);
        index += 3;
      } else {
        byte2 = bytes[index + 1] & 255;
        byte3 = bytes[index + 2] & 255;
        byte4 = bytes[index + 3] & 255;
        codePoint = ((byte1 & 7) << 18 | (byte2 & 63) << 12 | (byte3 & 63) << 6 | byte4 & 63) - 65536;
        output += String.fromCharCode(55296 + (codePoint >> 10), 56320 + (codePoint & 1023));
        index += 4;
      }
    }

    return output;
  }

  function b64Decode(value) {
    var lookup = [];
    var output = [];
    var buffer = 0;
    var bits = 0;
    var i;
    var code;
    var charValue;

    for (i = 0; i < 64; i += 1) {
      lookup[B64_CHARS.charCodeAt(i)] = i;
    }

    for (i = 0; i < String(value || "").length; i += 1) {
      code = String(value || "").charCodeAt(i);
      if (code === 61) {
        break;
      }

      charValue = lookup[code];
      if (charValue === void 0) {
        continue;
      }

      buffer = buffer << 6 | charValue;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output.push(buffer >> bits & 255);
      }
    }

    return output;
  }

  function b64UrlDecode(value) {
    return b64Decode(String(value || "").replace(/-/g, "+").replace(/_/g, "/"));
  }

  function b64UrlEncode(bytes) {
    var output = "";
    var i = 0;
    var n;

    for (; i + 2 < bytes.length; i += 3) {
      n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      output += B64_CHARS[n >> 18 & 63];
      output += B64_CHARS[n >> 12 & 63];
      output += B64_CHARS[n >> 6 & 63];
      output += B64_CHARS[n & 63];
    }

    if (i + 1 === bytes.length) {
      n = bytes[i] << 16;
      output += B64_CHARS[n >> 18 & 63];
      output += B64_CHARS[n >> 12 & 63];
    } else if (i + 2 === bytes.length) {
      n = bytes[i] << 16 | bytes[i + 1] << 8;
      output += B64_CHARS[n >> 18 & 63];
      output += B64_CHARS[n >> 12 & 63];
      output += B64_CHARS[n >> 6 & 63];
    }

    return output.replace(/\+/g, "-").replace(/\//g, "_");
  }

  function bytesToString(bytes) {
    var output = "";
    var index;

    for (index = 0; index < bytes.length; index += 4096) {
      output += String.fromCharCode.apply(null, bytes.slice(index, index + 4096));
    }

    return output;
  }

  function getHashKeyBytes(index) {
    return b64Decode(COMIX_HASH_KEYS[index] || "");
  }

  function rc4(key, data) {
    var s = [];
    var output = [];
    var i;
    var j = 0;
    var i2 = 0;
    var j2 = 0;
    var tmp;
    var k;

    if (!Array.isArray(key) || key.length === 0) {
      return data.slice();
    }

    for (i = 0; i < 256; i += 1) {
      s[i] = i;
    }

    for (i = 0; i < 256; i += 1) {
      j = (j + s[i] + key[i % key.length]) % 256;
      tmp = s[i];
      s[i] = s[j];
      s[j] = tmp;
    }

    for (k = 0; k < data.length; k += 1) {
      i2 = (i2 + 1) % 256;
      j2 = (j2 + s[i2]) % 256;
      tmp = s[i2];
      s[i2] = s[j2];
      s[j2] = tmp;
      output[k] = data[k] ^ s[(s[i2] + s[j2]) % 256];
    }

    return output;
  }

  function getMutKey(mutKey, index) {
    return mutKey.length > 0 && index % 32 < mutKey.length ? mutKey[index % 32] : 0;
  }

  function rotL(value, bits) {
    return (value << bits | value >>> (8 - bits)) & 255;
  }

  function rotR(value, bits) {
    return (value >>> bits | value << (8 - bits)) & 255;
  }

  function addByte(value, amount) {
    return (value + amount) & 255;
  }

  function subByte(value, amount) {
    return (value - amount) & 255;
  }

  function mutateHashBytes(data, mutKey, prefKey, round) {
    var output = [];
    var i;
    var value;

    for (i = 0; i < data.length; i += 1) {
      if (i < prefKey.length) {
        output.push(prefKey[i]);
      }

      value = data[i] ^ getMutKey(mutKey, i);
      output.push(transformHashByte(value, i, round));
    }

    return output;
  }

  function reverseMutateHashBytes(data, mutKey, prefKey, round) {
    var output = [];
    var dataIndex = 0;
    var outputIndex = 0;
    var value;

    while (dataIndex < data.length) {
      if (outputIndex < prefKey.length) {
        if (data[dataIndex] !== prefKey[outputIndex]) {
          throw new Error("Invalid encrypted payload prefix.");
        }
        dataIndex += 1;
      }

      if (dataIndex >= data.length) {
        break;
      }

      value = inverseTransformHashByte(data[dataIndex], outputIndex, round);
      output.push((value ^ getMutKey(mutKey, outputIndex)) & 255);
      dataIndex += 1;
      outputIndex += 1;
    }

    return output;
  }

  function transformHashByte(value, index, round) {
    switch (round) {
      case 1:
        switch (index % 10) {
          case 0: return addByte(value, 104);
          case 1:
          case 6: return value ^ 84;
          case 2:
          case 5: return rotL(value, 5);
          case 3: return addByte(value, 110);
          case 4: return rotL(value, 1);
          case 7: return addByte(value, 253);
          case 8: return rotL(value, 6);
          case 9: return value ^ 123;
        }
        break;
      case 2:
        switch (index % 10) {
          case 0:
          case 4: return value ^ 84;
          case 1:
          case 2:
          case 3:
          case 9: return rotL(value, 5);
          case 5: return value ^ 123;
          case 6: return addByte(value, 110);
          case 7: return addByte(value, 165);
          case 8: return rotL(value, 1);
        }
        break;
      case 3:
        switch (index % 10) {
          case 0:
          case 3:
          case 8: return rotL(value, 5);
          case 1:
          case 5: return rotL(value, 1);
          case 2: return addByte(value, 104);
          case 4: return addByte(value, 110);
          case 6: return addByte(value, 247);
          case 7: return rotL(value, 6);
          case 9: return value ^ 123;
        }
        break;
      case 4:
        switch (index % 10) {
          case 0:
          case 2: return value ^ 123;
          case 1:
          case 3:
          case 6: return rotL(value, 1);
          case 4:
          case 9: return rotL(value, 5);
          case 5:
          case 8: return value ^ 84;
          case 7: return addByte(value, 165);
        }
        break;
      case 5:
        switch (index % 10) {
          case 0:
          case 7: return value ^ 123;
          case 1:
          case 4: return addByte(value, 104);
          case 2:
          case 5:
          case 6:
          case 8: return rotL(value, 5);
          case 3: return addByte(value, 247);
          case 9: return rotL(value, 1);
        }
        break;
    }

    return value & 255;
  }

  function inverseTransformHashByte(value, index, round) {
    switch (round) {
      case 1:
        switch (index % 10) {
          case 0: return subByte(value, 104);
          case 1:
          case 6: return value ^ 84;
          case 2:
          case 5: return rotR(value, 5);
          case 3: return subByte(value, 110);
          case 4: return rotR(value, 1);
          case 7: return subByte(value, 253);
          case 8: return rotR(value, 6);
          case 9: return value ^ 123;
        }
        break;
      case 2:
        switch (index % 10) {
          case 0:
          case 4: return value ^ 84;
          case 1:
          case 2:
          case 3:
          case 9: return rotR(value, 5);
          case 5: return value ^ 123;
          case 6: return subByte(value, 110);
          case 7: return subByte(value, 165);
          case 8: return rotR(value, 1);
        }
        break;
      case 3:
        switch (index % 10) {
          case 0:
          case 3:
          case 8: return rotR(value, 5);
          case 1:
          case 5: return rotR(value, 1);
          case 2: return subByte(value, 104);
          case 4: return subByte(value, 110);
          case 6: return subByte(value, 247);
          case 7: return rotR(value, 6);
          case 9: return value ^ 123;
        }
        break;
      case 4:
        switch (index % 10) {
          case 0:
          case 2: return value ^ 123;
          case 1:
          case 3:
          case 6: return rotR(value, 1);
          case 4:
          case 9: return rotR(value, 5);
          case 5:
          case 8: return value ^ 84;
          case 7: return subByte(value, 165);
        }
        break;
      case 5:
        switch (index % 10) {
          case 0:
          case 7: return value ^ 123;
          case 1:
          case 4: return subByte(value, 104);
          case 2:
          case 5:
          case 6:
          case 8: return rotR(value, 5);
          case 3: return subByte(value, 247);
          case 9: return rotR(value, 1);
        }
        break;
    }

    return value & 255;
  }

  function applyComixRound(data, round) {
    var offset = (round - 1) * 3;
    return rc4(getHashKeyBytes(offset + 2), mutateHashBytes(data, getHashKeyBytes(offset), getHashKeyBytes(offset + 1), round));
  }

  function reverseComixRound(data, round) {
    var offset = (round - 1) * 3;
    return reverseMutateHashBytes(rc4(getHashKeyBytes(offset + 2), data), getHashKeyBytes(offset), getHashKeyBytes(offset + 1), round);
  }

  function round1(data) {
    return applyComixRound(data, 1);
  }

  function round2(data) {
    return applyComixRound(data, 2);
  }

  function round3(data) {
    return applyComixRound(data, 3);
  }

  function round4(data) {
    return applyComixRound(data, 4);
  }

  function round5(data) {
    return applyComixRound(data, 5);
  }

  function reverseRound1(data) {
    return reverseComixRound(data, 1);
  }

  function reverseRound2(data) {
    return reverseComixRound(data, 2);
  }

  function reverseRound3(data) {
    return reverseComixRound(data, 3);
  }

  function reverseRound4(data) {
    return reverseComixRound(data, 4);
  }

  function reverseRound5(data) {
    return reverseComixRound(data, 5);
  }

  // Exports

  var exportedSources = {
    ComixToInfo: ComixToInfo,
    ComixTo: ComixTo
  };

  globalThis.Sources = exportedSources;

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports.Sources = exportedSources;
  }
})();
