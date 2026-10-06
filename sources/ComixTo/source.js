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
  var CHAPTER_PAGE_BATCH_SIZE = 4;
  var MAX_CHAPTER_PAGES = 200;
  var TAG_ID_CACHE_SIZE = 50;
  var TAG_ID_CACHE_TTL_MS = 30 * 60 * 1000;
  var TAG_ID_EMPTY_CACHE_TTL_MS = 2 * 60 * 1000;
  var CHAPTER_SHARE_URL_CACHE_SIZE = 500;
  var TITLE_DATA_CACHE_SIZE = 5;
  var TITLE_DATA_CACHE_TTL_MS = 2 * 60 * 1000;
  var FILTER_CACHE_TTL_MS = 30 * 60 * 1000;
  var PERSISTED_FILTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  var FALLBACK_FILTER_CACHE_TTL_MS = 2 * 60 * 1000;
  var HOME_HTML_CACHE_TTL_MS = 5 * 60 * 1000;
  var TOP_SECTION_PAGE_SIZE = 50;
  var TRANSIENT_HTTP_STATUSES = { 502: true, 503: true, 522: true, 523: true };
  var SECTION_ID_FEATURED = "featured";
  var SECTION_ID_FOLLOWS = "follows";
  var SECTION_ID_FOLLOWS_ALL = "follows_all";
  var SECTION_ID_TRENDING_MANGA = "trending_manga";
  var SECTION_ID_TRENDING_WEBTOONS = "trending_webtoons";
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
  var TAG_PREFIX_YEAR = "year:";
  var TAG_PREFIX_GENRE_MODE = "genre_mode:";
  var SEARCH_FIELD_MIN_CHAPTERS = "min_chapters";
  var SEARCH_FIELD_AUTHOR = "author";
  var SEARCH_FIELD_ARTIST = "artist";
  var SEARCH_FIELD_TAGS = "tags";
  var SEARCH_FIELD_YEAR_FROM = "year_from";
  var SEARCH_FIELD_YEAR_TO = "year_to";
  var OLDEST_RELEASE_YEAR = 1928;
  var DEFAULT_SORT = "chapter_updated_at:desc";
  var SEARCH_DEFAULT_SORT = "relevance:desc";
  var LATEST_UPDATES_VIEW_HOT = "hot";
  var LATEST_UPDATES_VIEW_NEW = "new";
  var TOP_SECTION_RANGE_DEFAULT = "1";
  var GROUP_MODE_ALL = "all";
  var GROUP_MODE_HIDE = "hide";
  var GROUP_MODE_ONLY = "only";
  var GROUP_MODE_PREFER = "prefer";
  var GROUP_MATCH_EXACT = "exact";
  var GROUP_MATCH_CONTAINS = "contains";
  var STATE_CONTENT_RATING = "content_rating";
  var STATE_LATEST_UPDATES_VIEW = "latest_updates_mode";
  // These legacy state keys keep existing user settings compatible.
  var STATE_TRENDING_RANGE = "most_recent_popular_range";
  var STATE_MOST_FOLLOWED_RANGE = "most_follows_range";
  var STATE_HOME_DEMOGRAPHICS = "home_demographics";
  var STATE_HOME_TYPES = "home_types";
  var STATE_EXTRA_HOME_SECTIONS = "extra_home_sections";
  var STATE_HIDDEN_TERMS = "hidden_terms";
  var STATE_REQUIRED_TERMS = "required_terms";
  var STATE_REQUIRED_TERMS_MODE = "required_terms_mode";
  var STATE_CHAPTER_GROUP_MODE = "chapter_group_mode";
  var STATE_CHAPTER_GROUP_MATCH = "chapter_group_match";
  var STATE_CHAPTER_GROUP_FILTER = "chapter_group_filter";
  var STATE_FILTER_CACHE = "filter_cache_v2";
  var STATE_FILTER_CACHE_LEGACY = "filter_cache_v1";
  var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var COMIX_IMAGE_ALGO2_TAPS = 0x3ec241;
  var COMIX_IMAGE_ALGO2_PACKED = "IQHFT9HQGrIldMs3iq71sQgIkRkzuetP8iml5Ns+VxQBKOD0+uJ+B/EaQye36UVUrYU7s8zVtNTUVNONbSYAx2Cw1ErtzI6REGDcBTbNn9CFFMbABEwHTzl7OF2/ycDam+GQ97ygSAq70+qhcBhlDXkRcZAYWlemqsadQNzWmi0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEICggYaI1m2KjvKPQkkPv6//zWbiOiKmedkBDUg2cN30Xs9aiKn5d1UhRW2IgNcNEzzmnBMqveDYHmR+c2PfMImMIJWGY3nc9yeNTtdmtHWDKJDqt2DU1Hvjli3/7JAQk1IPce/K+1EgVcKkMcRrQj1J+QSmXly41XV55sVXEHphAQEDDRn+VOgRfzuK3SOelotmKmLITIOiQg1hgFGofR6IgLIEa0+XcN1Gh1qZyq2YdDYnEoQl3oWQL0q4zKjaGM7Rn6DSgP+0pKBA5Rww8K37vakCljpNIfnBtNFdvNCHdjlaMWfhngjAKOZ7TrEFQfSq7y1q9WyvzLPbDtDTncICCl6jAz81/LloI/EUsW/9CUJy5cDnSMmFe4t/bUr5Rj/ZHsyecDiMvYHWJGZJM4ZgffjTK23PXE38+pUQrHTsI8ecNmVHHMlPSWVzTDBaVYSABdxDacjUCDrp7Oa3LBAKgU6IrjbMDee9jgQl18FMlTW7cXaae2ahN0oa7kRbzFT1NplBIazMCRzcWmjciiYYcU97UQ7P+K7uVLGlqEZ+Un8fFQz44MnDjXuncXZ3Q4DvtU44/Lv56CnJh7NlU+jbitzdhRRgRKihnib5gdi0sxzjn6zDhHt06fQQgSeNcnnA8p5HT0DJODZmq1y/DjuFvCF822Z1tai4YJRCI78YqaovFKZfc9L6bCBqZZSmJtO3wJ26PPQqc4O16BBGkgxagh5BXS8x4L1KvsPEXetnlWJhjB/C8GYcw49DeivLLf/uUJvYUjpz/GCMune/NFvvIne091D0B+77atFTkv3xjDU7Y54TGHqYIt6/zPMV9Qz/fWWch3oFOJhfVfr0OPETFjJ5sQNGUmoSnBvTIj6I9zFwtBmrC0fPH6BX0KOIX7baz8j8t8/Qsm78nuduJ1CivBiIaX+hcwchYr/NrPP0WiOxJnV55vRmHSk0j/pG7J1+4Y4gIAbzsNiOn6t/Z/sa5ntudLYPZ7bxhW5AXVP57jr2fF1oX8NeLGQgrrjO4iYsJLMoej2QkovelfRrmn9lLa2OQlILAsssjoLjx1MSa0D8ngLZT88o6zVWqhmlOfouCo7zaU4yY1DBy/SoRPxjKT5+jNlNxtmbXZ2ZKs5ZYBpIOsqAV3ZtMCfsFDrs2gDkUSh1ISfZ+ZiuQnI8G4r4m6/4EOyZtaEi82xGWLAEBEjg/W56l7PeTkIc2dNjmerM59oPwKZ0fd0c6OuE1QQZnsMhcL44U+V3hLnYORZg8q1x8TLRexj2ZpiQu6Sone7DsSRvueMRTDetHMwxBpxa/jo2q4ZQDhRdUpsNtx9cf8gAfG57ECHE5+rA+jWOA7X4Wk5b6Dxe8I/wx6l7xUgIkYOU4FB3wpJs0XmYvOTnNVFSDoVNy8OfNan0IFbZL9UPwjw+TfQaMXc0ZKBD36C/uEJ6Yf67T2Of/qXEYIGRNiKBGYcbg8DCxxxeI2ZI160pVp86HvXlQ8JQrGHKGREpnDL1u2nL/CauoFXgTl+QG3ocUbH61jkEPzD/L/NM0BEjDV1jW1YDGEqaKr+CLtakuzYE/s91N/tUgSTDzaYsTb5XrWvJM1YwazVzVzrM6+kHcI2/gHMHxq4DDOjODo/3bjxrBVvQ+QgWkjZ+BBOm0qI/5klJCXFHIXj+6seHK/+h7KEdt5llS5W/+rvhPuYQAS99LhGcRxfpgPrcWABgIg5KWwVxWF3Xh5iiIj13FG8PwxC96TJpJfqG9T4H4MIWBUAYHgv/RkS21mFNpRNqzYa0eSRn2ISQNorSVUq8mS5kSF49VOE6/Icsa+OkaQodoVB4BuZ7ihRIzhl18mJuQtYKztZL6eDdcYeD6Flc7q15k9AQp7XYbfhuQQ9LnEAMRCXcFAZZFX3JEu+C5xC2ROxMBdH5gFaxQgugreJzvLdQ5Hh0A0s68UOArFajH2DyGsSpZGVCg3kXUD9SeC0TtlY4CvCC/h9ndZ43PsMTC4/S+3YP4NW0wgMsGMc75PmV5M0kYFNlVAzfX7FGHjUOepl2lUDlsVea7JwFcSOGwBiIC7Jc5xFgecy3HKlhwB7Y3lfxxCU7xCpbSPiKCcpbguWHaofIQozwkgWFlKiS325rCTMMU8uz5dU2EqVxHWoRc+PMC57xY1T/2bOOEd5Dzt5XgMN7M/MTQPGALqtuazMY7F/80lX4IJHErFbOmIo9TDO55O55Y6l3CobVC4PAMRAfdnwPlRpzwFgP/0EPGa4zumu8IJ2Z9uagWORDjcIMNQ2ugGyeRPLePSKocNUb4BW1lWYQIL+NjRr40XdfSsHBVBxi7QbXZFkDtI2tqIRe+oJmQiZp5QwfQlP6Xg7EyCauVJEIjJMQDRX3QoF7e6e+4Z2uqaJKF6z3mCbL0cAiKGYViJbAneur85uEy4SXJG2JSw9cimsbFo9U25tGtqbupnfCrj2pbhh1dqmbj1YbGQFYhmxXGQ5/teWQ1BK/8JtAdCYDEKPdXks6hme0ixT7Yyfgsgxa+tpWhxW/Vvls9mvKimrkimU72sQMgGab2sfAnvLJykudUxuxankCgAxIPUtzOFTDAuxQEKWuIFfMAoWVDGRk0U6nckY30jJmuVypFqW/wkvjQhfDEzYkYqIZ7YCEnBGhGhXcKz7GTXoTpBoByj/ylHQ03kvTKC8J2xH58pzJ4b/P1BipSrgga7yDFsq7aGivg9f8D566ds8pBn5uG14bgqskqA7rY+BIQCFSpFBI4Hxqf8czDBibsUY20BNuvn3W4zn6w375enTQAxOpgxa4fOvvAvF/BbmFICnb/gHvadk4+TDIuIhWGFl6oK0/4Exe+s6rN1YvZ51WH2hScm7gWi1nRD3406BLGILQyR8k8mINvhihi/msMZqCgDn7HgDG6vRoc8nHP1CAAIMmiBJHZuxfuD/aJEh4LQudzuqw4Ji6yLLpwB+dHapimq39+Q7Wm4GfUfvxB/LUq3d5S8k79djBAUMW6z+z97oan4NLK0yHqRn3LT0/fFV9kSYm+dpkbWLjzP9/A8QjdAX7WNHh2Lbh7kmFZ5BlKYsszPsVQH2HGDLRvNJG4QInKgGTtzRMZa8JH2rTIcFrqU4HvQ9JfuH1RXFyTSw3K3oQRyxVc+AkmCS0GMTsZJjTIiSYMrkK8LZ1V6A0Fbs3V/bfDTHL86iHszHQlhjDe/4+P9YGwI7JfB7fLaHq/o++Sx/UFPKBMZoFbK31V/b5ebUZ8SWQKUUfsCrPGT2CBAZMskdGQfQXZJxZjh0W9awMbG/JwaCJn1bgB8GJdjLFnOyG5K+Vy90yneNQ5R+DoyY+QNT+Qj7SSoZaAA6UlYz8QXj4pRZ1ACWzXjONJ4Qy9YCJhkU39K+fFOfg6e3SI3FRtHk0VZt0bemzgQg5pHwZrSF9vJCdQxk9Ay9vywQAVCAWIUgKNQ3pwOnZo9E6bf71aiQLQ+nNipq8++VYG0YFuGU7SU4pOmJhOOR1h+RNMbeJ8O/5qF11Kz45un0oGTwBdofdxAM+L2VoY3MmRIVqGlsd7q1t6VpPOBaUAy1IhNCQTem5ZB0DnO6WmXUVPHDuJ6xXOhvN1gg96Ae1CACoAggCzCggSo198O7bGQzLyjDm4HSmlcVcev2Mksx7ONb486zz1XBvtJ1t5kvsqgTn742O+VXUk3HsQZl1lk/t1WLMgv51RdVhgkHJyIM3/tqFS8NmzXlDjY2+nlGNBvx9iGkaQ6q7SZgD4ELskLTwxtisfeWFTXcsozhI+nRQARAGNiuwm5WGuXtDDrlnfOU74LuxPubIp7TDKrPV8MzXVQdcsWBUWM81RjNSxG2oVPVu/Gq5nyPYZtK6AbYUk8dpyRcaeIg5UsPa73L8cAH/ZGa6iODydGycg9CTOP/6LTK7JnYgRBikuxGfhVZfvm3L6ZLNzUQRG2M6YZfuIWACIAwsFQcRUUlS82qQuuRDLKzOVjhYvz+dkdsBjQ41ELKqGfEQsEt7SREioO/7gF3F6Ssg3ccjTbW8qYSsITBozVmIDGKjiilSD5+Zw5TlTB5n4NGMfFQQIZNSz8XNKCxHKF/S0ibKYZIvIfhkL7/EjP3sPa6sTHY3PrKHQK+0AAQIQKtsQhesFN6kOl5p7z1D7paZx0bHqzEQcFHOMWi1fze3j6X0Xsm3WSwuC4q5xhfI97YzAMioI1a+X6WS3Wi9uRSSV02crSboJQI+q/9/GQs25SudW4Es7Ehw4gQMvSdpqzmNLBLDOt4+9lbT0pdFeW1j7F5K5guchPEHm2JACBCDOsgz5DZ/WSQTihKFlr4rgjv7C64fdsvbAptD3AzEzQB3QLJzwKr5Fh9Ax8tKQ9HJTUYUUUOj6CIl9MKHSMiVKjVYFiS5eyyPc8qy8qLxRfRGZZ6xGoQ+05JieroGnAiAtlh2VkwAB7SGsx0xgtJY9KaR8YJat1llvoJiWgAQIyhDC+AtuyXWN17v1J03dvYgn9Ahsk0R8bO9zdWDY/kSQrNpwKepVgh7Oz7AYSKfbXMC1+4CJjjwIZd+BhwAMDfCvqGC2hpAld0ECPCTNBnfhtobsklMZ9ohD3aJ8SDyYTax2k2Q7QIsgufZbg9XKuAmySr2Lnh0/kTflCIDACAOSD8vWRAcglc89EbBUgVG5eiuK5oXQfmSzzuIgVSGIo3UPTOIPAEMq1+ePGLxxs6hPmeePsUMKaOA1i9EyDna5yd1Kt22pQuDMMLi0l4YG91txE7U+2FUjxPFdUoAQke57PD0mbo7dCqM93sN7sTlYR7zTUa/EUuNUZfYPBRACEQhVi5qJJ3041WAXNItpqGjeeXzTAv2diRfrs0eBQzEo/AH1iE0x4GbN7XowWfBJPbF2o3oYkkTUrzcK8ExSkGughq9chCi437F8PCYdACWT4IRNUjG8x3ylv7b5AxI+ncRDOGe6X5ISShvf7JVzPMTCP5S6RKjMkJarthghAAQiACIHMg9a234a2RHNHH5n2q/dUpk8Sp25nWPntTCldP7fGGm3O2h+5CDGc2i+25D+TlHDUrQIGZbT3gpmgAi+x3ULX72I/nWBVOT13RYuYYdvnjeO7lQx7mbicUUwK0CEn6XM5eUIACW5swp+lNbtKBneA0S6dDO4I+34IlQgCESJRBniDCRx9G+7/9q+NYOy1GlycjnM9TD0DUcioQl0Pe4pUzg2TSQRgAZjz+Lss21c+RVq4kQpdjjjCNSEVuqXMpoq8QY1fE941PWi7AAR2Jm2oMXN571MFMPg1SrT3Uyqk8EQV0jMRCHlwzjl7s2aK/7fyCsnv2vHFvpANI";
  var decodedComixImageAlgo2Table = null;
  var CONTENT_RATING_OPTIONS = [
    { id: "safe", label: "Safe only" },
    { id: "suggestive", label: "Up to Suggestive" },
    { id: "erotica", label: "Up to Erotica" },
    { id: "pornographic", label: "Up to Pornographic" }
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
  var EXTRA_HOME_SECTION_OPTIONS = [
    { id: SECTION_ID_TRENDING_MANGA, label: "Trending Manga" },
    { id: SECTION_ID_TRENDING_WEBTOONS, label: "Trending WebToons" }
  ];
  var REQUIRED_TERM_MODE_OPTIONS = [
    { id: "and", label: "Require All Selected Terms" },
    { id: "or", label: "Require Any Selected Term" }
  ];
  var GROUP_MODE_OPTIONS = [
    { id: GROUP_MODE_ALL, label: "Show All Groups" },
    { id: GROUP_MODE_HIDE, label: "Hide Matching Groups" },
    { id: GROUP_MODE_ONLY, label: "Only Matching Groups" },
    { id: GROUP_MODE_PREFER, label: "Prefer Matching Group" }
  ];
  var GROUP_MATCH_OPTIONS = [
    { id: GROUP_MATCH_EXACT, label: "Exact Group Name" },
    { id: GROUP_MATCH_CONTAINS, label: "Group Name Contains Text" }
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
      { id: "40", label: "Harem" },
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
    years: [],
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
      { id: "chapter_updated_at:asc", label: "Update Date (Oldest)" },
      { id: "chapter_updated_at:desc", label: "Latest Updates" },
      { id: "created_at:asc", label: "Created Date (Oldest)" },
      { id: "created_at:desc", label: "Recently Added" },
      { id: "title:asc", label: "Title A-Z" },
      { id: "title:desc", label: "Title Z-A" },
      { id: "year:desc", label: "Year (Newest)" },
      { id: "year:asc", label: "Year (Oldest)" },
      { id: "score:asc", label: "Lowest Rated" },
      { id: "score:desc", label: "Highest Rated" },
      { id: "views_7d:asc", label: "Least Viewed - 7 Days" },
      { id: "views_7d:desc", label: "Most Viewed - 7 Days" },
      { id: "views_30d:asc", label: "Least Viewed - 30 Days" },
      { id: "views_30d:desc", label: "Most Viewed - 30 Days" },
      { id: "views_90d:asc", label: "Least Viewed - 90 Days" },
      { id: "views_90d:desc", label: "Most Viewed - 90 Days" },
      { id: "views_total:asc", label: "Least Viewed - All Time" },
      { id: "views_total:desc", label: "Most Viewed - All Time" },
      { id: "follows_total:asc", label: "Least Followed" },
      { id: "follows_total:desc", label: "Most Followed" }
    ]
  };

  // Source Info

  var ComixToInfo = {
    version: "1.1.1",
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
    this.cachedFilterDataPromise = null;
    this.cachedFilterDataExpiresAt = 0;
    this.filterCacheGeneration = 0;
    this.cachedTagSearchIds = {};
    this.cachedTagSearchOrder = [];
    this.cachedChapterShareUrls = {};
    this.cachedChapterShareUrlOrder = [];
    this.cachedTitleData = {};
    this.cachedTitleDataOrder = [];
    this.cachedUserAgentPromise = null;
    this.cachedHomeHtml = null;
    this.cachedHomeHtmlPromise = null;
    this.cachedHomeHtmlExpiresAt = 0;
    this.homeHtmlGeneration = 0;
    this.cachedLiveProtocol = null;
    this.cachedLiveProtocolPromise = null;
    this.liveProtocolGeneration = 0;
    this.stateManager = App.createSourceStateManager();
    this.requestManager = App.createRequestManager({
      requestsPerSecond: 4,
      requestTimeout: 20000,
      interceptor: {
        interceptRequest: async function(request) {
          if (!this.cachedUserAgentPromise) {
            var source = this;
            this.cachedUserAgentPromise = Promise.resolve(this.requestManager.getDefaultUserAgent()).catch(function(error) {
              source.cachedUserAgentPromise = null;
              throw error;
            });
          }

          if (isSignerProtectedApiUrl(request.url)) {
            request.url = await this.signLiveApiUrl(request.url);
          }

          var headers = Object.assign({}, request.headers || {});
          headers["user-agent"] = await this.cachedUserAgentPromise;

          if (isImageRequestUrl(request.url)) {
            removeHeaderIgnoreCase(headers, "referer");
            removeHeaderIgnoreCase(headers, "origin");
            removeHeaderIgnoreCase(headers, "x-requested-with");
            headers.accept = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";
          } else {
            headers.referer = DOMAIN + "/";
            headers.origin = DOMAIN;
            headers.accept = "application/json, text/plain, */*";
            headers["x-requested-with"] = "XMLHttpRequest";
          }

          request.headers = headers;
          return request;
        }.bind(this),
        interceptResponse: async function(response) {
          if (isCloudflareMitigatedResponse(response)) {
            throw new Error("Cloudflare Bypass Required");
          }
          return processComixImageResponse(response);
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
    var cachedUrl = getCachedChapterShareUrl(this, chapterId);
    return cleanText(cachedUrl || "") || this.getMangaShareUrl(seriesId);
  };

  ComixTo.prototype.getHomePageSections = async function(sectionCallback) {
    var settings = await Promise.all([
      getHomeFilterParams(this.stateManager),
      getTrendingDays(this.stateManager),
      getMostFollowedDays(this.stateManager),
      getLatestUpdatesView(this.stateManager),
      getExtraHomeSections(this.stateManager)
    ]);
    var homeFilters = settings[0];
    var trendingSectionDays = settings[1];
    var mostFollowedSectionDays = settings[2];
    var latestView = settings[3];
    var extraSections = settings[4];
    var source = this;
    var tasks = [];

    if (isDefaultHomePayloadCompatible(homeFilters, trendingSectionDays, mostFollowedSectionDays, latestView)) {
      var embeddedPromise = this.getEmbeddedHomeSectionItems().catch(function(error) {
        if (isCloudflareBypassError(error)) {
          throw error;
        }
        return {};
      });

      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_FEATURED, "Most Recent Popular", "featured", embeddedPromise.then(function(embedded) {
        return embedded.trending || source.getTopSectionItems("trending", 1, homeFilters, trendingSectionDays);
      })));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_FOLLOWS, "Most Follows · New Comics", "singleRowLarge", embeddedPromise.then(function(embedded) {
        return embedded.follows || source.getTopSectionItems("follows", 1, homeFilters, mostFollowedSectionDays);
      })));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_LATEST, "Latest Updates", "singleRowNormal", embeddedPromise.then(function(embedded) {
        return embedded.latest || source.getLatestSectionItems(1, homeFilters, latestView);
      })));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_NEW, "Recently Added", "singleRowNormal", embeddedPromise.then(function(embedded) {
        return embedded.recent || source.getNewSectionItems(1, homeFilters);
      })));
    } else {
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_FEATURED, "Most Recent Popular", "featured", this.getTopSectionItems("trending", 1, homeFilters, trendingSectionDays)));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_FOLLOWS, "Most Follows · New Comics", "singleRowLarge", this.getTopSectionItems("follows", 1, homeFilters, mostFollowedSectionDays)));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_LATEST, "Latest Updates", "singleRowNormal", this.getLatestSectionItems(1, homeFilters, latestView)));
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_NEW, "Recently Added", "singleRowNormal", this.getNewSectionItems(1, homeFilters)));
    }

    tasks.push(streamHomeSection(sectionCallback, SECTION_ID_FOLLOWS_ALL, "Most Followed", "singleRowLarge", this.getMostFollowedAllSectionItems(1, homeFilters)));
    tasks.push(streamHomeSection(sectionCallback, SECTION_ID_COMPLETE, "Complete Series", "singleRowNormal", this.getCompleteSectionItems(1, homeFilters)));
    if (extraSections.indexOf(SECTION_ID_TRENDING_MANGA) >= 0) {
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_TRENDING_MANGA, "Trending Manga", "singleRowNormal", this.getTrendingMangaSectionItems(1, homeFilters)));
    }
    if (extraSections.indexOf(SECTION_ID_TRENDING_WEBTOONS) >= 0) {
      tasks.push(streamHomeSection(sectionCallback, SECTION_ID_TRENDING_WEBTOONS, "Trending WebToons", "singleRowNormal", this.getTrendingWebtoonSectionItems(1, homeFilters)));
    }

    var outcomes = await Promise.all(tasks);
    if (!outcomes.some(function(value) { return value === true; })) {
      throw new Error("ComixTo could not load any homepage sections.");
    }
  };

  ComixTo.prototype.getViewMoreItems = async function(homepageSectionId, metadata) {
    var page = toPositiveInteger(metadata && metadata.page, 1);

    if (homepageSectionId === SECTION_ID_LATEST) {
      return this.getLatestSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_NEW) {
      return this.getNewSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_FOLLOWS_ALL) {
      return this.getMostFollowedAllSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_TRENDING_MANGA) {
      return this.getTrendingMangaSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_TRENDING_WEBTOONS) {
      return this.getTrendingWebtoonSectionItems(page);
    }

    if (homepageSectionId === SECTION_ID_COMPLETE) {
      return this.getCompleteSectionItems(page);
    }

    return createEmptyPagedResults();
  };

  ComixTo.prototype.getCloudflareBypassRequestAsync = async function() {
    return App.createRequest({
      url: DOMAIN,
      method: "GET",
      headers: {
        "Referer": DOMAIN + "/",
        "User-Agent": await this.requestManager.getDefaultUserAgent()
      }
    });
  };

  ComixTo.prototype.getSourceMenu = async function() {
    var stateManager = this.stateManager;
    var source = this;
    return App.createDUISection({
      id: "main",
      header: "Source Settings",
      isHidden: false,
      footer: "Chapter group matching uses comma-separated group names or numeric group IDs.",
      rows: async function() {
        var filterData;
        try {
          filterData = await source.getFilterData();
        } catch (error) {
          if (isCloudflareBypassError(error)) {
            throw error;
          }
          filterData = FALLBACK_FILTER_OPTIONS;
        }
        var savedTerms = await Promise.all([
          getHiddenTerms(stateManager),
          getRequiredTerms(stateManager)
        ]);
        var hiddenTermOptions = appendSavedTermOptions(
          buildHiddenTermOptions(filterData),
          savedTerms[0].concat(savedTerms[1])
        );
        var rows = [
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
          createOptionalMultiSelectSetting(stateManager, {
            id: STATE_EXTRA_HOME_SECTIONS,
            label: "Extra Home Sections",
            options: EXTRA_HOME_SECTION_OPTIONS,
            getValue: getExtraHomeSections
          }),
          createOptionalMultiSelectSetting(stateManager, {
            id: STATE_HIDDEN_TERMS,
            label: "Global Hidden Terms",
            options: hiddenTermOptions,
            getValue: async function(manager) {
              return normalizeOptionalMultiOptionValues(await getHiddenTerms(manager), hiddenTermOptions);
            }
          }),
          createOptionalMultiSelectSetting(stateManager, {
            id: STATE_REQUIRED_TERMS,
            label: "Global Required Terms",
            options: hiddenTermOptions,
            getValue: async function(manager) {
              return normalizeOptionalMultiOptionValues(await getRequiredTerms(manager), hiddenTermOptions);
            }
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_REQUIRED_TERMS_MODE,
            label: "Required Terms Match",
            options: REQUIRED_TERM_MODE_OPTIONS,
            fallback: "and",
            getValue: getRequiredTermsMode
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_CHAPTER_GROUP_MODE,
            label: "Chapter Group Handling",
            options: GROUP_MODE_OPTIONS,
            fallback: GROUP_MODE_ALL,
            getValue: getChapterGroupMode
          }),
          createSingleSelectSetting(stateManager, {
            id: STATE_CHAPTER_GROUP_MATCH,
            label: "Chapter Group Name Match",
            options: GROUP_MATCH_OPTIONS,
            fallback: GROUP_MATCH_EXACT,
            getValue: getChapterGroupMatchMode
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

        if (typeof App.createDUIButton === "function") {
          rows.push(App.createDUIButton({
            id: "refresh_filter_catalog",
            label: "Refresh Filter Catalog",
            onTap: async function() {
              await source.refreshFilterData();
            }
          }));
          rows.push(App.createDUIButton({
            id: "reset_settings",
            label: "Reset ComixTo Settings",
            onTap: async function() {
              await resetSourceSettings(stateManager);
              invalidateFilterCatalogCache(source);
            }
          }));
        }

        return rows;
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
    return [
      createSearchField(SEARCH_FIELD_AUTHOR, "Author", "comma-separated names"),
      createSearchField(SEARCH_FIELD_ARTIST, "Artist", "comma-separated names"),
      createSearchField(SEARCH_FIELD_TAGS, "Tags", "comma-separated tags"),
      createSearchField(SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters", "e.g. 10"),
      createSearchField(SEARCH_FIELD_YEAR_FROM, "Release Year From", "e.g. 2015"),
      createSearchField(SEARCH_FIELD_YEAR_TO, "Release Year To", "e.g. " + new Date().getUTCFullYear())
    ];
  };

  ComixTo.prototype.getMangaDetails = async function(seriesId) {
    var details;

    try {
      details = await this.fetchMangaDetailsFromHtml(seriesId);
    } catch (error) {
      if (isCloudflareBypassError(error)) {
        throw error;
      }
      details = extractApiResult(
        await this.fetchJson(buildApiUrl("/manga/" + encodePathSegment(seriesId), {
          includes: ["author", "artist"]
        })),
        "/manga/" + seriesId
      );
    }

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
    var groupSettings = await getChapterGroupSettings(this.stateManager);
    var chapterParams = createChapterListParams(1, groupSettings);
    var pages = [];
    var firstPage;
    var totalPages;
    var chapters;
    var fetchedAt;
    var duplicateDateFallbacks;
    var apiError;
    var seenChapterPageItems = {};
    var followupBatchSize;
    var implicitChapterPageCap = false;
    var chapterPagingComplete = true;

    try {
      firstPage = extractApiResult(await this.fetchJson(buildSignedApiUrl(path, chapterParams)), path);
      pages.push(firstPage);
      rememberChapterPageItems(firstPage, seenChapterPageItems);
      totalPages = getChapterPageFetchLimit(firstPage);
      var hasExplicitPageCount = hasExplicitChapterLastPage(firstPage);
      followupBatchSize = hasExplicitPageCount ? CHAPTER_PAGE_BATCH_SIZE : 1;
      implicitChapterPageCap = !hasExplicitPageCount && totalPages === MAX_CHAPTER_PAGES;
      chapterPagingComplete = !implicitChapterPageCap;

      for (var batchStart = 2; batchStart <= totalPages; batchStart += followupBatchSize) {
        var pendingPages = [];
        var batchEnd = Math.min(totalPages, batchStart + followupBatchSize - 1);

        for (var page = batchStart; page <= batchEnd; page += 1) {
          (function(pageNumber) {
            pendingPages.push(source.fetchJson(buildSignedApiUrl(path, createChapterListParams(pageNumber, groupSettings))).then(function(payload) {
              return {
                page: pageNumber,
                result: extractApiResult(payload, path)
              };
            }));
          })(page);
        }

        var batchResults = await Promise.all(pendingPages);
        var stopPaging = false;
        for (var resultIndex = 0; resultIndex < batchResults.length; resultIndex += 1) {
          var pageResult = batchResults[resultIndex];
          var pageItems = Array.isArray(pageResult.result && pageResult.result.items) ? pageResult.result.items : [];
          var newItemCount = rememberChapterPageItems(pageResult.result, seenChapterPageItems);

          if (pageItems.length > 0 && newItemCount === 0) {
            throw new Error("ComixTo repeated a chapter page while pagination still appeared active. Refusing to return a partial chapter list.");
          }

          pages.push(pageResult.result);
          if (shouldStopChapterPaging(pageResult.result, pageResult.page)) {
            chapterPagingComplete = true;
            stopPaging = true;
            break;
          }
        }

        if (stopPaging) {
          break;
        }
      }

      if (implicitChapterPageCap && !chapterPagingComplete) {
        throw new Error("ComixTo chapter pagination reached the safety limit of " + MAX_CHAPTER_PAGES + " pages while the API still reported more chapters. Refusing to return a truncated chapter list.");
      }
    } catch (error) {
      apiError = error;
      if (isCloudflareBypassError(apiError)) {
        throw apiError;
      }
      var htmlFallback = await this.fetchCompleteChaptersFromHtml(seriesId).catch(function(fallbackError) {
        if (isCloudflareBypassError(fallbackError)) {
          throw fallbackError;
        }
        return null;
      });
      if (!htmlFallback) {
        throw apiError;
      }
      pages = [htmlFallback];
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

      if (index < CHAPTER_SHARE_URL_CACHE_SIZE) {
        cacheChapterShareUrl(source, chapterId, chapter.url);
      }

      return App.createChapter(chapterData);
    });

    if (visibleChapters.length === 0) {
      throw new Error("ComixTo did not return any chapters with readable IDs for " + seriesId + ".");
    }

    return visibleChapters;
  };

  ComixTo.prototype.getChapterDetails = async function(seriesId, chapterId) {
    var path = "/chapters/" + encodePathSegment(chapterId);
    var chapterData;
    var apiError;

    chapterData = await this.fetchChapterDetailsFromHtml(chapterId).catch(function(error) {
      if (isCloudflareBypassError(error)) {
        throw error;
      }
      return null;
    });
    if (!chapterData) {
      try {
        chapterData = extractApiResult(await this.fetchJson(buildSignedApiUrl(path)), path);
      } catch (error) {
        apiError = error;
        throw apiError;
      }
    }
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
    var title = normalizeSearchText(query && query.title || "");
    var filters = extractSearchFilters(query);
    var resolvedSearchInputs = await Promise.all([
      this.resolveTagIdsForNames("author", filters.authorNames, "Author"),
      this.resolveTagIdsForNames("artist", filters.artistNames, "Artist"),
      this.resolveTagIdsForNames("tag", filters.tagNames, "Tag"),
      getHiddenTerms(this.stateManager),
      getRequiredTerms(this.stateManager),
      getRequiredTermsMode(this.stateManager),
      getContentRating(this.stateManager)
    ]);
    var authorIds = resolvedSearchInputs[0];
    var artistIds = resolvedSearchInputs[1];
    var tagIds = resolvedSearchInputs[2];
    var hiddenTermIds = getHiddenTermIds(resolvedSearchInputs[3]);
    var requiredTermIds = getHiddenTermIds(resolvedSearchInputs[4]);
    var localIncludedTermIds = filters.genresIn.slice();
    var localExcludedTermIds = filters.genresEx.slice();
    var hasLocalIncludedTerms = filters.genresIn.length > 0 || tagIds.length > 0;
    tagIds.forEach(function(id) {
      pushUnique(localIncludedTermIds, id);
    });
    // Search-local selections are more specific than global defaults. Avoid
    // emitting the same term in both genres_in and genres_ex when they conflict.
    requiredTermIds = requiredTermIds.filter(function(id) {
      return localExcludedTermIds.indexOf(id) < 0;
    });
    hiddenTermIds = hiddenTermIds.filter(function(id) {
      return requiredTermIds.indexOf(id) < 0 && localIncludedTermIds.indexOf(id) < 0;
    });
    var sort = parseSortOption(filters.sort || (title.length > 0 ? SEARCH_DEFAULT_SORT : DEFAULT_SORT));
    var params = {
      page: page,
      limit: SEARCH_PAGE_SIZE,
      content_rating: getContentRatingsUpTo(resolvedSearchInputs[6]),
      order: sort
    };
    var result;
    var items;

    authorIds.forEach(function(id) {
      pushUnique(filters.authors, id);
    });
    artistIds.forEach(function(id) {
      pushUnique(filters.artists, id);
    });
    tagIds.forEach(function(id) {
      pushUnique(filters.genresIn, id);
    });
    hiddenTermIds.forEach(function(id) {
      pushUnique(filters.genresEx, id);
    });
    requiredTermIds.forEach(function(id) {
      pushUnique(filters.genresIn, id);
    });
    // Comix exposes one shared genres_mode for all included terms. Preserve an
    // explicit/query-local mode when local includes exist; otherwise the global
    // Required Terms setting controls the combined required-term match mode.
    if (requiredTermIds.length > 0 && !hasLocalIncludedTerms) {
      filters.genresMode = resolvedSearchInputs[5];
    }

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

    if (filters.genresIn.length > 0) {
      params.genres_mode = filters.genresMode;
    }

    if (filters.demographics.length > 0) {
      params.demographics = filters.demographics;
    }

    if (toPositiveInteger(filters.minChapters, 0) > 0) {
      params.min_chap = filters.minChapters;
    }

    if (toPositiveInteger(filters.yearFrom, 0) > 0) {
      params.year_from = filters.yearFrom;
    }

    if (toPositiveInteger(filters.yearTo, 0) > 0) {
      params.year_to = filters.yearTo;
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
      limit: TOP_SECTION_PAGE_SIZE
    }, filters))), "/manga/top");
    var items = Array.isArray(result && result.items) ? result.items : Array.isArray(result) ? result : [];

    return App.createPagedResults({
      results: mapSeriesItems(items),
      metadata: void 0
    });
  };

  ComixTo.prototype.getLatestSectionItems = async function(page, homeFilters, latestView) {
    latestView = latestView || (await getLatestUpdatesView(this.stateManager));
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

  ComixTo.prototype.getMostFollowedAllSectionItems = async function(page, homeFilters) {
    return this.getSeriesListSectionItems(page, {
      order: { follows_total: "desc" }
    }, homeFilters);
  };

  ComixTo.prototype.getTrendingMangaSectionItems = async function(page, homeFilters) {
    return this.getSeriesListSectionItems(page, {
      types: ["manga"],
      order: { views_30d: "desc" }
    }, homeFilters);
  };

  ComixTo.prototype.getTrendingWebtoonSectionItems = async function(page, homeFilters) {
    return this.getSeriesListSectionItems(page, {
      types: ["manhwa", "manhua"],
      order: { views_30d: "desc" }
    }, homeFilters);
  };

  ComixTo.prototype.getSeriesListSectionItems = async function(page, baseParams, homeFilters) {
    var filters = homeFilters || (await getHomeFilterParams(this.stateManager));
    var params = Object.assign({
      page: page,
      limit: HOME_PAGE_SIZE
    }, filters, baseParams || {});
    var result;

    result = extractApiResult(await this.fetchJson(buildApiUrl("/manga", params)), "/manga");
    var items = Array.isArray(result && result.items) ? result.items : [];

    return App.createPagedResults({
      results: mapSeriesItems(items),
      metadata: getNextPageMetadata(result, page, items, HOME_PAGE_SIZE)
    });
  };

  ComixTo.prototype.getTitleInitialData = async function(seriesId) {
    var key = cleanText(seriesId || "");
    var cached = this.cachedTitleData[key];
    var source = this;

    if (cached && cached.data && cached.expiresAt > Date.now()) {
      touchTitleDataCacheEntry(this, key);
      return cached.data;
    }
    if (cached && cached.promise) {
      touchTitleDataCacheEntry(this, key);
      return cached.promise;
    }
    if (cached) {
      delete this.cachedTitleData[key];
      removeArrayValue(this.cachedTitleDataOrder, key);
    }

    var pending;
    pending = this.fetchText(this.getMangaShareUrl(seriesId)).then(function(html) {
      var data = parseInitialData(html);
      if (!isObject(data) || !isObject(data.queries)) {
        throw new Error("ComixTo title page did not expose initial-data queries.");
      }
      if (source.cachedTitleData[key] && source.cachedTitleData[key].promise === pending) {
        cacheTitleInitialData(source, key, data);
      }
      return data;
    }).catch(function(error) {
      if (source.cachedTitleData[key] && source.cachedTitleData[key].promise === pending) {
        delete source.cachedTitleData[key];
        removeArrayValue(source.cachedTitleDataOrder, key);
      }
      throw error;
    });

    cachePendingTitleData(this, key, pending);
    return pending;
  };

  function cachePendingTitleData(source, key, pending) {
    removeArrayValue(source.cachedTitleDataOrder, key);
    source.cachedTitleData[key] = { promise: pending };
    source.cachedTitleDataOrder.push(key);
    trimTitleDataCache(source);
  }

  function cacheTitleInitialData(source, key, data) {
    removeArrayValue(source.cachedTitleDataOrder, key);
    source.cachedTitleData[key] = {
      data: data,
      expiresAt: Date.now() + TITLE_DATA_CACHE_TTL_MS
    };
    source.cachedTitleDataOrder.push(key);

    trimTitleDataCache(source);
  }

  function touchTitleDataCacheEntry(source, key) {
    removeArrayValue(source.cachedTitleDataOrder, key);
    source.cachedTitleDataOrder.push(key);
  }

  function trimTitleDataCache(source) {
    while (source.cachedTitleDataOrder.length > TITLE_DATA_CACHE_SIZE) {
      delete source.cachedTitleData[source.cachedTitleDataOrder.shift()];
    }
  }

  ComixTo.prototype.fetchMangaDetailsFromHtml = async function(seriesId) {
    var initialData = await this.getTitleInitialData(seriesId);
    var queries = isObject(initialData && initialData.queries) ? initialData.queries : {};
    var detail = findInitialQueryValueByFamily(queries, "manga", "detail") || findInitialQueryValue(queries, ['"detail"']);

    detail = isObject(detail && detail.result) ? detail.result : detail;
    if (!isObject(detail) || cleanText(detail.title || "").length === 0) {
      detail = findMangaDetailInQueries(queries, seriesId);
    }
    if (!isObject(detail) || cleanText(detail.title || "").length === 0) {
      throw new Error("ComixTo title page did not contain readable manga details for " + seriesId + ".");
    }

    return detail;
  };

  ComixTo.prototype.fetchCompleteChaptersFromHtml = async function(seriesId) {
    var initialData = await this.getTitleInitialData(seriesId);
    var queries = isObject(initialData && initialData.queries) ? initialData.queries : {};
    var result = findCompleteChapterListInQueries(queries);

    if (!result) {
      throw new Error("ComixTo title HTML did not contain a complete embedded chapter list.");
    }

    return result;
  };

  ComixTo.prototype.fetchChapterDetailsFromHtml = async function(chapterId) {
    var chapterUrl = getCachedChapterShareUrl(this, chapterId);
    if (chapterUrl.length === 0) {
      throw new Error("ComixTo does not have a cached chapter URL for the HTML page fallback.");
    }

    var html = await this.fetchText(chapterUrl);
    var initialData = parseInitialData(html);
    var queries = isObject(initialData && initialData.queries) ? initialData.queries : {};
    var result = findChapterPagesInQueries(queries);

    if (!result) {
      throw new Error("ComixTo chapter HTML did not contain an embedded page payload.");
    }

    return result;
  };

  ComixTo.prototype.getEmbeddedHomeSectionItems = async function() {
    // Discover should reflect the current homepage on every refresh. Keep a copy
    // for signer bootstrap, but do not serve display sections from the 5-minute
    // signer bootstrap cache.
    var generation = this.homeHtmlGeneration;
    var html = await this.fetchText(DOMAIN + "/");
    if (generation === this.homeHtmlGeneration) {
      this.cachedHomeHtml = html;
      this.cachedHomeHtmlExpiresAt = Date.now() + HOME_HTML_CACHE_TTL_MS;
    }
    var initialData = parseInitialData(html);
    var queries = isObject(initialData && initialData.queries) ? initialData.queries : {};
    var trending = findInitialQueryValue(queries, ['"manga","top"', '"trending"']);
    var follows = findInitialQueryValue(queries, ['"manga","top"', '"follows"']);
    var latest = findInitialQueryValue(queries, ['"scope":"hot"', '"chapter_updated_at":"desc"']);
    var recent = findInitialQueryValue(queries, ['"manga","list"', '"created_at":"desc"']);

    if (trending === void 0 || follows === void 0 || latest === void 0 || recent === void 0) {
      throw new Error("ComixTo homepage initial-data no longer contains the expected manga sections.");
    }

    return {
      trending: createEmbeddedHomePagedResults(trending, TOP_SECTION_PAGE_SIZE),
      follows: createEmbeddedHomePagedResults(follows, TOP_SECTION_PAGE_SIZE),
      latest: createEmbeddedHomePagedResults(latest, HOME_PAGE_SIZE),
      recent: createEmbeddedHomePagedResults(recent, HOME_PAGE_SIZE)
    };
  };

  ComixTo.prototype.getFilterData = async function() {
    if (this.cachedFilterData && this.cachedFilterDataExpiresAt > Date.now()) {
      return this.cachedFilterData;
    }

    if (this.cachedFilterDataPromise) {
      var pendingCache = await this.cachedFilterDataPromise;
      return pendingCache.data;
    }

    var source = this;
    var generation = this.filterCacheGeneration;
    var localPromise = (async function() {
      var persisted = await getPersistedFilterCache(source.stateManager);
      if (persisted && persisted.ageMs <= FILTER_CACHE_TTL_MS) {
        return {
          data: mergeFilterOptions(FALLBACK_FILTER_OPTIONS, persisted.data),
          ttl: Math.max(1000, FILTER_CACHE_TTL_MS - persisted.ageMs)
        };
      }

      try {
        var options = await source.fetchBrowseOptions();
        var merged = mergeFilterOptions(FALLBACK_FILTER_OPTIONS, options);
        if (generation === source.filterCacheGeneration) {
          await storePersistedFilterCache(source.stateManager, options);
        }
        return {
          data: merged,
          ttl: FILTER_CACHE_TTL_MS
        };
      } catch (error) {
        if (isCloudflareBypassError(error)) {
          throw error;
        }
        if (persisted) {
          return {
            data: mergeFilterOptions(FALLBACK_FILTER_OPTIONS, persisted.data),
            ttl: FALLBACK_FILTER_CACHE_TTL_MS
          };
        }
        return {
          data: FALLBACK_FILTER_OPTIONS,
          ttl: FALLBACK_FILTER_CACHE_TTL_MS
        };
      }
    })();
    this.cachedFilterDataPromise = localPromise;

    try {
      var cached = await localPromise;
      if (generation === this.filterCacheGeneration && this.cachedFilterDataPromise === localPromise) {
        this.cachedFilterData = cached.data;
        this.cachedFilterDataExpiresAt = Date.now() + cached.ttl;
      }
      return cached.data;
    } finally {
      if (this.cachedFilterDataPromise === localPromise) {
        this.cachedFilterDataPromise = null;
      }
    }
  };

  ComixTo.prototype.refreshFilterData = async function() {
    invalidateFilterCatalogCache(this);
    var source = this;
    var generation = this.filterCacheGeneration;
    var localPromise = (async function() {
      await Promise.all([
        source.stateManager.store(STATE_FILTER_CACHE, null),
        source.stateManager.store(STATE_FILTER_CACHE_LEGACY, null)
      ]);
      var options = await source.fetchBrowseOptions();
      var merged = mergeFilterOptions(FALLBACK_FILTER_OPTIONS, options);
      if (generation === source.filterCacheGeneration) {
        await storePersistedFilterCache(source.stateManager, options);
      }
      return {
        data: merged,
        ttl: FILTER_CACHE_TTL_MS
      };
    })();
    this.cachedFilterDataPromise = localPromise;

    try {
      var cached = await localPromise;
      if (generation === this.filterCacheGeneration && this.cachedFilterDataPromise === localPromise) {
        this.cachedFilterData = cached.data;
        this.cachedFilterDataExpiresAt = Date.now() + cached.ttl;
      }
      return cached.data;
    } finally {
      if (this.cachedFilterDataPromise === localPromise) {
        this.cachedFilterDataPromise = null;
      }
    }
  };

  function invalidateFilterCatalogCache(source) {
    source.filterCacheGeneration += 1;
    source.cachedFilterData = null;
    source.cachedFilterDataPromise = null;
    source.cachedFilterDataExpiresAt = 0;
    source.cachedTagSearchIds = {};
    source.cachedTagSearchOrder = [];
  }

  async function getPersistedFilterCache(stateManager) {
    var raw;
    var parsed;

    try {
      raw = await stateManager.retrieve(STATE_FILTER_CACHE);
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (error) {
      return null;
    }

    if (!isObject(parsed) || !isObject(parsed.data) || !isFinite(Number(parsed.ts))) {
      return null;
    }
    if (Date.now() - Number(parsed.ts) > PERSISTED_FILTER_CACHE_TTL_MS) {
      return null;
    }

    return {
      data: parsed.data,
      ageMs: Math.max(0, Date.now() - Number(parsed.ts))
    };
  }

  async function storePersistedFilterCache(stateManager, data) {
    try {
      await stateManager.store(STATE_FILTER_CACHE, JSON.stringify({
        ts: Date.now(),
        data: data
      }));
    } catch (error) {
      // The in-memory cache still works when persistent source state is unavailable.
    }
  }

  ComixTo.prototype.fetchBrowseOptions = async function() {
    // Comix's raw server-rendered browse payload lives at /browse. It already
    // carries the fixed browse options, while free-text Tags resolve on demand.
    var html = await this.fetchText(DOMAIN + "/browse");
    var initialData = parseInitialData(html);
    var options = Object.assign({}, initialData && initialData.list && initialData.list.options || {});

    if (Object.keys(options).length === 0) {
      throw new Error("ComixTo browse filters were missing from initial-data.");
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

  function findInitialQueryValue(queries, fragments) {
    var keys = Object.keys(queries || {});

    for (var index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      var matches = fragments.every(function(fragment) {
        return key.indexOf(fragment) >= 0;
      });

      if (matches) {
        return queries[key];
      }
    }

    return void 0;
  }

  function findInitialQueryValueByFamily(queries, namespace, name) {
    var keys = Object.keys(queries || {});

    for (var index = 0; index < keys.length; index += 1) {
      try {
        var parsedKey = JSON.parse(keys[index]);
        if (Array.isArray(parsedKey) && parsedKey[0] === namespace && parsedKey[1] === name) {
          return queries[keys[index]];
        }
      } catch (error) {
        // Ignore non-JSON query keys and continue scanning.
      }
    }

    return void 0;
  }

  function unwrapInitialQueryValue(value) {
    var current = value;

    for (var depth = 0; depth < 4; depth += 1) {
      if (isObject(current && current.state) && current.state.data !== void 0) {
        current = current.state.data;
        continue;
      }
      if (isObject(current) && current.result !== void 0) {
        current = current.result;
        continue;
      }
      break;
    }

    return current;
  }

  function findCompleteChapterListInQueries(queries) {
    var values = Object.keys(queries || {}).map(function(key) {
      return queries[key];
    });

    for (var index = 0; index < values.length; index += 1) {
      var candidate = unwrapInitialQueryValue(values[index]);
      var items = candidate && candidate.items;
      if (!isObject(candidate) || !Array.isArray(items) || items.length === 0) {
        continue;
      }
      if (!items.every(function(item) {
        return getChapterId(item).length > 0 && isFinite(toNumber(item && item.number, NaN));
      })) {
        continue;
      }
      if (!isCompleteChapterPage(candidate)) {
        continue;
      }
      return candidate;
    }

    return null;
  }

  function findChapterPagesInQueries(queries) {
    var values = Object.keys(queries || {}).map(function(key) {
      return queries[key];
    });

    for (var index = 0; index < values.length; index += 1) {
      var candidate = unwrapInitialQueryValue(values[index]);
      if (isObject(candidate) && candidate.pages && normalizeChapterPages(candidate.pages).length > 0) {
        return candidate;
      }
    }

    return null;
  }

  function findMangaDetailInQueries(queries, seriesId) {
    var keys = Object.keys(queries || {});
    var expectedId = cleanText(seriesId || "");

    for (var index = 0; index < keys.length; index += 1) {
      var value = queries[keys[index]];
      var candidate = isObject(value && value.result) ? value.result : value;
      var id = cleanText(candidate && (candidate.hid || candidate.id) || "");

      if (isObject(candidate) && cleanText(candidate.title || "").length > 0 &&
        (expectedId.length === 0 || id.length === 0 || id === expectedId)) {
        return candidate;
      }
    }

    return null;
  }

  function createEmbeddedHomePagedResults(value, pageSize) {
    var result = isObject(value && value.result) ? value.result : value;
    var items = Array.isArray(result) ? result : Array.isArray(result && result.items) ? result.items : [];

    if (items.length === 0) {
      throw new Error("ComixTo homepage initial-data returned an empty embedded section.");
    }

    return App.createPagedResults({
      results: mapSeriesItems(items),
      // HomeSection only persists containsMoreItems, not the initial PagedResults
      // metadata. Expose all SSR items and avoid a page-1 View More that would
      // duplicate the embedded rows.
      metadata: void 0
    });
  }

  function createEmptyPagedResults() {
    return App.createPagedResults({
      results: []
    });
  }

  function isDefaultHomePayloadCompatible(homeFilters, trendingDays, followedDays, latestView) {
    var ratings = homeFilters && homeFilters.content_rating;

    return trendingDays === TOP_SECTION_RANGE_DEFAULT &&
      followedDays === TOP_SECTION_RANGE_DEFAULT &&
      latestView === LATEST_UPDATES_VIEW_HOT &&
      isObject(homeFilters) &&
      Object.keys(homeFilters).length === 1 &&
      Array.isArray(ratings) &&
      ratings.length === 2 &&
      ratings[0] === "safe" && ratings[1] === "suggestive";
  }

  ComixTo.prototype.fetchTagOptions = async function(type) {
    var result = extractApiResult(await this.fetchJson(buildApiUrl("/tags/search", {
      type: type,
      // Comix v1 rejects limits above 50.
      limit: 50
    })), "/tags/search");

    return Array.isArray(result) ? result : [];
  };

  ComixTo.prototype.resolveTagIdsForNames = async function(type, rawValue, label) {
    var names = splitCommaSeparatedValues(rawValue);
    var resolved = [];
    var batches = await Promise.all(names.map(function(name) {
      return this.resolveTagIdsForName(type, name);
    }, this));

    batches.forEach(function(ids) {
      ids.forEach(function(id) {
        pushUnique(resolved, id);
      });
    });

    if (names.length > 0 && resolved.length === 0) {
      throw new Error("No ComixTo " + String(label || type).toLowerCase() + " matches were found for " + names.join(", ") + ".");
    }

    return resolved;
  };

  ComixTo.prototype.resolveTagIdsForName = async function(type, name) {
    var cacheKey = type + "\u0000" + String(name || "").toLowerCase();
    var cached = this.cachedTagSearchIds[cacheKey];
    var source = this;
    var generation = this.filterCacheGeneration;

    if (isObject(cached) && Array.isArray(cached.ids)) {
      if (cached.expiresAt > Date.now()) {
        touchTagSearchCacheEntry(this, cacheKey);
        return cached.ids;
      }
      delete this.cachedTagSearchIds[cacheKey];
      removeArrayValue(this.cachedTagSearchOrder, cacheKey);
    }
    if (cached && typeof cached.then === "function") {
      return cached;
    }

    var pending;
    pending = this.fetchJson(buildApiUrl("/tags/search", {
      type: type,
      q: name
    })).then(function(payload) {
      var result = extractApiResult(payload, "/tags/search");
      var values = Array.isArray(result) ? result : Array.isArray(result && result.items) ? result.items : [];
      var options = normalizeFilterOptions(values);
      var exactName = cleanText(name || "").toLowerCase();
      var exactMatches = options.filter(function(option) {
        return cleanText(option.label || "").toLowerCase() === exactName;
      });
      var selected = exactMatches.length > 0 ? exactMatches : options;
      var ids = selected.map(function(option) {
        return option.id;
      });
      if (generation === source.filterCacheGeneration && source.cachedTagSearchIds[cacheKey] === pending) {
        cacheTagSearchIds(source, cacheKey, ids);
      }
      return ids;
    }).catch(function(error) {
      if (source.cachedTagSearchIds[cacheKey] === pending) {
        delete source.cachedTagSearchIds[cacheKey];
        removeArrayValue(source.cachedTagSearchOrder, cacheKey);
      }
      throw error;
    });

    this.cachedTagSearchIds[cacheKey] = pending;
    return pending;
  };

  function cacheTagSearchIds(source, cacheKey, ids) {
    removeArrayValue(source.cachedTagSearchOrder, cacheKey);
    source.cachedTagSearchIds[cacheKey] = {
      ids: ids,
      expiresAt: Date.now() + (ids.length > 0 ? TAG_ID_CACHE_TTL_MS : TAG_ID_EMPTY_CACHE_TTL_MS)
    };
    source.cachedTagSearchOrder.push(cacheKey);

    while (source.cachedTagSearchOrder.length > TAG_ID_CACHE_SIZE) {
      delete source.cachedTagSearchIds[source.cachedTagSearchOrder.shift()];
    }
  }

  function touchTagSearchCacheEntry(source, cacheKey) {
    removeArrayValue(source.cachedTagSearchOrder, cacheKey);
    source.cachedTagSearchOrder.push(cacheKey);
  }

  function removeArrayValue(values, value) {
    var index = values.indexOf(value);
    if (index >= 0) {
      values.splice(index, 1);
    }
  }

  ComixTo.prototype.fetchJson = async function(url) {
    var response = await this.fetchResponse(url);
    var liveProtocol = this.cachedLiveProtocol;
    var encrypted = responseHasEncryptedEnvelope(response);

    if (!liveProtocol && encrypted) {
      liveProtocol = await this.getLiveProtocol();
    }

    try {
      return await parseJsonResponse(response, url, liveProtocol);
    } catch (error) {
      if (!encrypted) {
        throw error;
      }

      this.invalidateLiveProtocol();
      try {
        liveProtocol = await this.getLiveProtocol();
        return await parseJsonResponse(response, url, liveProtocol);
      } catch (refreshError) {
        throw error;
      }
    }
  };

  ComixTo.prototype.fetchText = async function(url) {
    var response = await this.fetchResponse(url);

    return parseTextResponse(response, url);
  };

  ComixTo.prototype.getHomeHtml = async function() {
    if (this.cachedHomeHtml && this.cachedHomeHtmlExpiresAt > Date.now()) {
      return this.cachedHomeHtml;
    }

    if (this.cachedHomeHtmlPromise) {
      return this.cachedHomeHtmlPromise;
    }

    var generation = this.homeHtmlGeneration;
    var localPromise = this.fetchText(DOMAIN + "/");
    this.cachedHomeHtmlPromise = localPromise;
    try {
      var html = await localPromise;
      if (generation !== this.homeHtmlGeneration) {
        return this.getHomeHtml();
      }
      if (generation === this.homeHtmlGeneration && this.cachedHomeHtmlPromise === localPromise) {
        this.cachedHomeHtml = html;
        this.cachedHomeHtmlExpiresAt = Date.now() + HOME_HTML_CACHE_TTL_MS;
      }
      return html;
    } finally {
      if (this.cachedHomeHtmlPromise === localPromise) {
        this.cachedHomeHtmlPromise = null;
      }
    }
  };

  ComixTo.prototype.getLiveProtocol = async function() {
    if (this.cachedLiveProtocol) {
      return this.cachedLiveProtocol;
    }
    if (this.cachedLiveProtocolPromise) {
      return this.cachedLiveProtocolPromise;
    }

    var generation = this.liveProtocolGeneration;
    var localPromise = this.bootstrapLiveProtocol();
    this.cachedLiveProtocolPromise = localPromise;

    try {
      var protocol = await localPromise;
      if (generation !== this.liveProtocolGeneration) {
        return this.getLiveProtocol();
      }
      if (generation === this.liveProtocolGeneration && this.cachedLiveProtocolPromise === localPromise) {
        this.cachedLiveProtocol = protocol;
      }
      return protocol;
    } finally {
      if (this.cachedLiveProtocolPromise === localPromise) {
        this.cachedLiveProtocolPromise = null;
      }
    }
  };

  ComixTo.prototype.bootstrapLiveProtocol = async function() {
    var homeHtml = await this.getHomeHtml();
    var mainUrl = extractLiveMainBundleUrl(homeHtml);
    var mainCode = await this.fetchText(mainUrl);
    var secureUrl = extractLiveSecureBundleUrl(mainCode, mainUrl);
    var secureCode = await this.fetchText(secureUrl);

    return createLiveProtocolFromBundle(secureCode, secureUrl);
  };

  ComixTo.prototype.signLiveApiUrl = async function(url) {
    var unsignedUrl = removeQueryParam(url, "_");
    var requestConfig = buildLiveSignerRequestConfig(unsignedUrl);
    var protocol = await this.getLiveProtocol();
    var signedConfig = await protocol.requestInterceptor(requestConfig);
    var token = cleanText(signedConfig && signedConfig.params && signedConfig.params._ || "");

    if (token.length === 0) {
      throw new Error("ComixTo's current signer bundle did not produce a request token.");
    }

    return appendRawQueryParam(unsignedUrl, "_", token);
  };

  ComixTo.prototype.invalidateLiveProtocol = function() {
    this.liveProtocolGeneration += 1;
    this.homeHtmlGeneration += 1;
    this.cachedLiveProtocol = null;
    this.cachedLiveProtocolPromise = null;
    this.cachedHomeHtml = null;
    this.cachedHomeHtmlPromise = null;
    this.cachedHomeHtmlExpiresAt = 0;
  };

  ComixTo.prototype.fetchResponse = async function(url) {
    var lastError;

    for (var attempt = 0; attempt < 2; attempt += 1) {
      try {
        var requestUrl = attempt > 0 && !isSignedApiRequestUrl(url) ? addRetryQueryParam(url, attempt) : url;
        var response = await this.requestManager.schedule(App.createRequest({
          url: requestUrl,
          method: "GET"
        }), 1);

        if (attempt === 0 && isSignerProtectedApiUrl(url) && isSignerRejectedResponse(response)) {
          this.invalidateLiveProtocol();
          continue;
        }

        if (attempt === 0 && shouldRetryResponse(response)) {
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (isCloudflareBypassError(error)) {
          throw error;
        }
        if (attempt > 0 || !shouldRetryThrownError(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error("ComixTo request failed before receiving a response.");
  };

  // Response Helpers

  async function parseJsonResponse(response, url, liveProtocol) {
    var raw = response && typeof response.data === "string" ? response.data : JSON.stringify(response && response.data || "");
    var parsed;
    ensureReadableResponse(response, raw, url);

    if (isObject(response.data)) {
      return await decodeComixEnvelope(response.data, url, liveProtocol, response);
    }

    try {
      parsed = JSON.parse(String(response.data || ""));
    } catch (error) {
      throw new Error("ComixTo returned unreadable JSON from " + formatRequestLabel(url) + ": " + String(error) + "." + buildDiagnosticPreview(raw));
    }

    return await decodeComixEnvelope(parsed, url, liveProtocol, response);
  }

  function responseHasEncryptedEnvelope(response) {
    var data = response && response.data;
    var parsed;

    if (isObject(data)) {
      return typeof data.e === "string";
    }

    if (typeof data !== "string") {
      return false;
    }

    try {
      parsed = JSON.parse(data);
      return isObject(parsed) && typeof parsed.e === "string";
    } catch (error) {
      return false;
    }
  }

  async function decodeComixEnvelope(payload, url, liveProtocol, response) {
    var decrypted;
    var interceptorError;

    if (!isObject(payload) || typeof payload.e !== "string") {
      return payload;
    }

    if (liveProtocol && typeof liveProtocol.responseInterceptor === "function") {
      try {
        var processed = await liveProtocol.responseInterceptor({
          data: payload,
          status: response && response.status,
          headers: response && response.headers || {},
          config: Object.assign({ method: "get" }, buildLiveSignerRequestConfig(removeQueryParam(url, "_")))
        });
        var processedData = processed && Object.prototype.hasOwnProperty.call(processed, "data") ? processed.data : processed;

        if (typeof processedData === "string") {
          processedData = JSON.parse(processedData);
        }
        if (processedData !== void 0 && processedData !== null && !(isObject(processedData) && typeof processedData.e === "string")) {
          return processedData;
        }
      } catch (error) {
        interceptorError = error;
      }
    }

    try {
      if (!liveProtocol || typeof liveProtocol.decodeEnvelope !== "function") {
        throw interceptorError || new Error("the current live protocol decoder is unavailable");
      }

      decrypted = liveProtocol.decodeEnvelope(payload.e);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error("ComixTo returned an unreadable encrypted API envelope from " + formatRequestLabel(url) + ": " + String(interceptorError || error) + ". The site may have rotated its API cipher." + buildDiagnosticPreview(JSON.stringify(payload)));
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

    if (isCloudflareMitigatedResponse(response) || isChallengePage(body)) {
      throw new Error("Cloudflare Bypass Required");
    }

    if (response.status === 404) {
      throw new Error("The requested ComixTo page was not found." + buildResponseDiagnosticContext(response));
    }

    if (isSignerProtectedApiUrl(url) && isSignerRejectedResponse(response)) {
      throw new Error("ComixTo rejected a signer-protected API request with HTTP " + response.status + ". The site may have rotated its request signer and this Paperback source needs a signer refresh." + buildResponseDiagnosticContext(response));
    }

    if (response.status >= 400) {
      throw new Error("ComixTo returned HTTP " + response.status + " from " + formatRequestLabel(url) + "." + buildResponseDiagnosticContext(response) + buildDiagnosticPreview(body));
    }
  }

  function shouldRetryResponse(response) {
    var status = response && response.status;
    var body;

    if (!TRANSIENT_HTTP_STATUSES[status]) {
      return false;
    }

    body = response && typeof response.data === "string" ? response.data : JSON.stringify(response && response.data || "");
    return !isCloudflareMitigatedResponse(response) && !isChallengePage(body);
  }

  function shouldRetryThrownError(error) {
    var message = cleanText(error && error.message || error || "").toLowerCase();

    return /(timeout|timed out|network|connection|socket|temporar|econn|reset by peer|connection reset)/i.test(message);
  }

  function isSignerRejectedResponse(response) {
    var status = response && response.status;
    var body;
    var payload;
    var code;
    var message;
    var signatureErrors;

    if (status !== 401 && status !== 403 && status !== 422) {
      return false;
    }

    body = response && typeof response.data === "string" ? response.data : JSON.stringify(response && response.data || "");
    if (isCloudflareMitigatedResponse(response) || isChallengePage(body)) {
      return false;
    }

    try {
      payload = isObject(response && response.data) ? response.data : JSON.parse(body);
    } catch (error) {
      payload = null;
    }

    code = cleanText(payload && payload.code || "").toLowerCase();
    message = cleanText(payload && payload.message || body || "").toLowerCase();
    signatureErrors = payload && isObject(payload.errors) ? payload.errors._ || payload.errors.token || payload.errors.signature : null;

    if (/^(?:missing|invalid|expired)_(?:token|signature)$/.test(code) || /^(?:token|signature)_(?:missing|invalid|expired)$/.test(code)) {
      return true;
    }
    if (/(?:missing|invalid|expired)\s+(?:request\s+)?(?:token|signature)|(?:token|signature)\s+(?:is\s+)?(?:missing|invalid|expired)/i.test(message)) {
      return true;
    }

    return signatureErrors !== null && signatureErrors !== void 0;
  }

  function addRetryQueryParam(url, attempt) {
    var value = String(url || "");
    var separator = value.indexOf("?") >= 0 ? "&" : "?";

    return value + separator + "r=" + encodeURIComponent(String(attempt));
  }

  function extractLiveMainBundleUrl(html) {
    var match = String(html || "").match(/<script\b[^>]*\bsrc=["']([^"']*\/dist\/main-[^"']+\.js)["'][^>]*>/i);

    if (!match) {
      throw new Error("ComixTo homepage did not expose the current main bundle.");
    }

    return resolveComixAssetUrl(DOMAIN + "/", match[1]);
  }

  function extractLiveSecureBundleUrl(mainCode, mainUrl) {
    var match = String(mainCode || "").match(/(?:\.\/)?(secure-[A-Za-z0-9_-]+\.js)/);

    if (!match) {
      throw new Error("ComixTo main bundle did not expose the current secure bundle.");
    }

    return resolveComixAssetUrl(mainUrl, match[1]);
  }

  function resolveComixAssetUrl(baseUrl, value) {
    var asset = cleanText(value || "");
    var base = String(baseUrl || DOMAIN + "/");

    if (/^https?:\/\//i.test(asset)) {
      return asset;
    }
    if (asset.indexOf("//") === 0) {
      return "https:" + asset;
    }
    if (asset.charAt(0) === "/") {
      return DOMAIN + asset;
    }

    return base.slice(0, base.lastIndexOf("/") + 1) + asset.replace(/^\.\//, "");
  }

  function createLiveProtocolFromBundle(code, secureUrl) {
    var source = String(code || "");
    var exportMatch = source.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
    var exportedNames = [];
    var sandboxGlobal;
    var sandboxWindow;
    var evaluator;

    if (typeof Function !== "function" || typeof Proxy !== "function") {
      throw new Error("This Paperback runtime cannot execute ComixTo's live signer bundle.");
    }

    if (exportMatch) {
      exportMatch[1].split(",").forEach(function(part) {
        var match = cleanText(part).match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);
        if (match && exportedNames.indexOf(match[1]) < 0) {
          exportedNames.push(match[1]);
        }
      });
      source = source.slice(0, exportMatch.index);
    }

    var document = createLiveSandboxProxy("document", {
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      createElement: function() {
        return createLiveSandboxProxy("element", {
          style: createLiveSandboxProxy("element.style"),
          setAttribute: function() {}
        });
      },
      head: createLiveSandboxProxy("document.head"),
      body: createLiveSandboxProxy("document.body")
    });
    var location = createLiveSandboxProxy("location", {
      href: DOMAIN + "/",
      origin: DOMAIN,
      protocol: "https:",
      host: "comix.to",
      hostname: "comix.to",
      pathname: "/",
      search: "",
      hash: "",
      toString: function() { return DOMAIN + "/"; }
    });
    var navigator = createLiveSandboxProxy("navigator", {
      appCodeName: "Mozilla",
      userAgent: "Mozilla/5.0"
    });
    var fakeFetch = async function() {
      return {
        ok: true,
        status: 200,
        text: async function() { return "{}"; },
        json: async function() { return {}; },
        headers: {}
      };
    };
    var noTimer = function() { return 0; };
    var clearTimer = function() {};
    var LiveTextEncoder = createLiveTextEncoder();
    var LiveTextDecoder = createLiveTextDecoder();

    sandboxGlobal = {
      document: document,
      location: location,
      navigator: navigator,
      fetch: fakeFetch,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Date: Date,
      Math: Math,
      JSON: JSON,
      Promise: Promise,
      Function: Function,
      Map: typeof Map === "function" ? Map : void 0,
      Set: typeof Set === "function" ? Set : void 0,
      WeakMap: typeof WeakMap === "function" ? WeakMap : void 0,
      WeakSet: typeof WeakSet === "function" ? WeakSet : void 0,
      Reflect: typeof Reflect === "object" ? Reflect : void 0,
      Symbol: typeof Symbol === "function" ? Symbol : void 0,
      Error: Error,
      TypeError: TypeError,
      RangeError: RangeError,
      ArrayBuffer: typeof ArrayBuffer === "function" ? ArrayBuffer : void 0,
      DataView: typeof DataView === "function" ? DataView : void 0,
      Uint8Array: typeof Uint8Array === "function" ? Uint8Array : void 0,
      Uint16Array: typeof Uint16Array === "function" ? Uint16Array : void 0,
      Uint32Array: typeof Uint32Array === "function" ? Uint32Array : void 0,
      Int8Array: typeof Int8Array === "function" ? Int8Array : void 0,
      Int16Array: typeof Int16Array === "function" ? Int16Array : void 0,
      Int32Array: typeof Int32Array === "function" ? Int32Array : void 0,
      Float32Array: typeof Float32Array === "function" ? Float32Array : void 0,
      Float64Array: typeof Float64Array === "function" ? Float64Array : void 0,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isFinite: isFinite,
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent,
      TextEncoder: LiveTextEncoder,
      TextDecoder: LiveTextDecoder,
      atob: liveAtob,
      btoa: liveBtoa,
      console: { log: function() {}, error: function() {}, warn: function() {} },
      setTimeout: noTimer,
      clearTimeout: clearTimer,
      setInterval: noTimer,
      clearInterval: clearTimer
    };
    sandboxWindow = createLiveSandboxProxy("window", sandboxGlobal);
    sandboxGlobal.window = sandboxWindow;
    sandboxGlobal.self = sandboxWindow;
    sandboxGlobal.global = sandboxWindow;

    try {
      evaluator = Function(
        "window", "document", "location", "navigator", "fetch", "self", "global", "globalThis",
        "TextEncoder", "TextDecoder", "atob", "btoa", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
        source
      );
      evaluator(
        sandboxWindow, document, location, navigator, fakeFetch, sandboxWindow, sandboxWindow, sandboxGlobal,
        LiveTextEncoder, LiveTextDecoder, liveAtob, liveBtoa, noTimer, clearTimer, noTimer, clearTimer
      );
    } catch (error) {
      throw new Error("ComixTo could not initialize the current secure bundle " + formatRequestLabel(secureUrl) + ": " + String(error) + ".");
    }

    if (typeof sandboxGlobal.Bf === "function") {
      exportedNames = ["Bf"].concat(exportedNames.filter(function(name) {
        return name !== "Bf";
      }));
    } else if (exportedNames.indexOf("Bf") < 0) {
      exportedNames.push("Bf");
    }

    var liveCodec = findLiveProtocolCodec(sandboxGlobal);

    for (var index = 0; index < exportedNames.length; index += 1) {
      var candidate = sandboxGlobal[exportedNames[index]];
      var requestInterceptor;
      var responseInterceptor;
      var axiosMock;

      if (typeof candidate !== "function") {
        continue;
      }

      axiosMock = {
        interceptors: {
          request: {
            use: function(success) {
              requestInterceptor = success;
            }
          },
          response: {
            use: function(success) {
              responseInterceptor = success;
            }
          }
        },
        defaults: { headers: { common: {} } }
      };

      try {
        candidate(axiosMock);
      } catch (error) {
        continue;
      }

      if (typeof requestInterceptor === "function") {
        return {
          requestInterceptor: requestInterceptor,
          responseInterceptor: responseInterceptor,
          encodeEnvelope: liveCodec && typeof liveCodec.O === "function" ? function(value) {
            return liveCodec.O(value);
          } : null,
          decodeEnvelope: liveCodec && typeof liveCodec.D === "function" ? function(value) {
            return liveCodec.D(value);
          } : null
        };
      }
    }

    throw new Error("ComixTo's current secure bundle did not expose a usable request signer.");
  }

  function findLiveProtocolCodec(sandboxGlobal) {
    var keys = Object.keys(sandboxGlobal || {});

    for (var index = 0; index < keys.length; index += 1) {
      var value = sandboxGlobal[keys[index]];
      if (isObject(value) && typeof value.O === "function" && typeof value.D === "function" && typeof value.A === "function") {
        return value;
      }
    }

    return null;
  }

  function createLiveSandboxProxy(name, overrides) {
    var values = overrides || {};
    var target = function() {};

    return new Proxy(target, {
      get: function(_target, property) {
        if (typeof property === "string" && Object.prototype.hasOwnProperty.call(values, property)) {
          return values[property];
        }
        if (property === "then" || typeof property === "symbol") {
          return void 0;
        }
        return createLiveSandboxProxy(name + "." + String(property));
      },
      set: function(_target, property, value) {
        if (typeof property === "string") {
          values[property] = value;
        }
        return true;
      },
      apply: function() {
        return createLiveSandboxProxy(name + "()");
      },
      construct: function() {
        return createLiveSandboxProxy("new " + name);
      }
    });
  }

  function createLiveTextEncoder() {
    function LiveTextEncoder() {}
    LiveTextEncoder.prototype.encode = function(value) {
      var bytes = stringToUtf8Bytes(value);
      return typeof Uint8Array === "function" ? new Uint8Array(bytes) : bytes;
    };
    return LiveTextEncoder;
  }

  function createLiveTextDecoder() {
    function LiveTextDecoder() {}
    LiveTextDecoder.prototype.decode = function(value) {
      return utf8BytesToString(Array.prototype.slice.call(value || []));
    };
    return LiveTextDecoder;
  }

  function liveAtob(value) {
    return b64Decode(value).map(function(byte) {
      return String.fromCharCode(byte);
    }).join("");
  }

  function liveBtoa(value) {
    var bytes = [];
    var source = String(value || "");
    var encoded;

    for (var index = 0; index < source.length; index += 1) {
      bytes.push(source.charCodeAt(index) & 255);
    }

    encoded = b64UrlEncode(bytes).replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4 !== 0) {
      encoded += "=";
    }
    return encoded;
  }

  function buildLiveSignerRequestConfig(url) {
    var value = String(url || "");
    var pathAndQuery;
    var queryIndex;

    if (value.indexOf(DOMAIN) !== 0) {
      throw new Error("ComixTo cannot sign a non-Comix API URL.");
    }

    pathAndQuery = value.slice(DOMAIN.length);
    queryIndex = pathAndQuery.indexOf("?");

    return {
      url: queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery,
      headers: {},
      params: parseLiveSignerParams(queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "")
    };
  }

  function parseLiveSignerParams(rawQuery) {
    var params = {};

    String(rawQuery || "").split("&").forEach(function(part) {
      var equalsIndex;
      var key;
      var value;
      var arrayMatch;
      var objectMatch;

      if (!part) {
        return;
      }

      equalsIndex = part.indexOf("=");
      key = decodeQueryComponent(equalsIndex >= 0 ? part.slice(0, equalsIndex) : part);
      value = decodeQueryComponent(equalsIndex >= 0 ? part.slice(equalsIndex + 1) : "");
      if (key === "_") {
        return;
      }

      arrayMatch = key.match(/^([^\[]+)\[\]$/);
      if (arrayMatch) {
        if (!Array.isArray(params[arrayMatch[1]])) {
          params[arrayMatch[1]] = [];
        }
        params[arrayMatch[1]].push(value);
        return;
      }

      objectMatch = key.match(/^([^\[]+)\[([^\]]+)\]$/);
      if (objectMatch) {
        if (!isObject(params[objectMatch[1]])) {
          params[objectMatch[1]] = {};
        }
        params[objectMatch[1]][objectMatch[2]] = value;
        return;
      }

      if (params[key] === void 0) {
        params[key] = value;
      } else if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [params[key], value];
      }
    });

    return params;
  }

  function decodeQueryComponent(value) {
    try {
      return decodeURIComponent(String(value || "").replace(/\+/g, " "));
    } catch (error) {
      return String(value || "");
    }
  }

  function removeQueryParam(url, name) {
    var value = String(url || "");
    var hashIndex = value.indexOf("#");
    var fragment = hashIndex >= 0 ? value.slice(hashIndex) : "";
    var withoutFragment = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    var queryIndex = withoutFragment.indexOf("?");
    var base = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
    var query = queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : "";
    var kept = query.split("&").filter(function(part) {
      var equalsIndex = part.indexOf("=");
      var key = decodeQueryComponent(equalsIndex >= 0 ? part.slice(0, equalsIndex) : part);
      return part.length > 0 && key !== name;
    });

    return base + (kept.length > 0 ? "?" + kept.join("&") : "") + fragment;
  }

  function appendRawQueryParam(url, key, value) {
    var source = String(url || "");
    var hashIndex = source.indexOf("#");
    var fragment = hashIndex >= 0 ? source.slice(hashIndex) : "";
    var base = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
    var separator = base.indexOf("?") >= 0 ? "&" : "?";

    return base + separator + encodeURIComponent(key) + "=" + encodeURIComponent(String(value)) + fragment;
  }

  function isImageRequestUrl(url) {
    var value = String(url || "");

    if (/\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(value)) {
      return true;
    }

    return /^https:\/\/static\.comix\.to(?:\/|$)/i.test(value);
  }

  async function processComixImageResponse(response) {
    if (!response || !response.rawData) {
      return response;
    }

    var hasScrambleHeaders = getHeaderIgnoreCase(response.headers, "x-scramble-seed") !== void 0 || getHeaderIgnoreCase(response.headers, "x-scramble-grid") !== void 0;
    var scramble = readComixScrambleHeaders(response.headers);
    if (hasScrambleHeaders && !scramble) {
      throw new Error("ComixTo returned an unsupported scrambled image header set.");
    }
    if (scramble) {
      if (!canUsePaperbackCanvas()) {
        throw new Error("This Paperback runtime cannot descramble the protected ComixTo image.");
      }
      try {
        var decoded = descrambleComixImage(response.rawData, scramble);
        if (decoded && decoded.data) {
          response.rawData = decoded.data;
          response.mimeType = decoded.mime;
          setHeaderIgnoreCase(response.headers, "content-type", decoded.mime);
        }
      } catch (error) {
        throw new Error("ComixTo image descrambling failed: " + String(error) + ".");
      }
      return response;
    }

    var hasEncryptionHeaders = getHeaderIgnoreCase(response.headers, "x-enc-seed") !== void 0 ||
      getHeaderIgnoreCase(response.headers, "x-enc-len") !== void 0 ||
      getHeaderIgnoreCase(response.headers, "x-enc-algo") !== void 0;
    var encrypted = readComixEncryptionHeaders(response.headers);
    if (hasEncryptionHeaders && !encrypted) {
      throw new Error("ComixTo returned an unsupported encrypted image header set.");
    }
    if (encrypted) {
      if (typeof App.createByteArray !== "function") {
        throw new Error("This Paperback runtime cannot decrypt the protected ComixTo image.");
      }
      try {
        var bytes = App.createByteArray(response.rawData);
        if (encrypted.algo === 1) {
          decryptComixImageAlgo1(bytes, encrypted.seed, encrypted.length);
        } else if (encrypted.algo === 2) {
          decryptComixImageAlgo2(bytes, encrypted.seed, encrypted.length);
        } else {
          throw new Error("unsupported X-Enc algorithm " + encrypted.algo);
        }
      } catch (error) {
        throw new Error("ComixTo image decryption failed: " + String(error) + ".");
      }
    }

    return response;
  }

  function getHeaderIgnoreCase(headers, name) {
    var normalized = String(name || "").toLowerCase();
    var keys = Object.keys(headers || {});

    for (var index = 0; index < keys.length; index += 1) {
      if (String(keys[index]).toLowerCase() === normalized) {
        return headers[keys[index]];
      }
    }

    return void 0;
  }

  function setHeaderIgnoreCase(headers, name, value) {
    if (!headers) {
      return;
    }

    removeHeaderIgnoreCase(headers, name);
    headers[name] = value;
  }

  function readComixEncryptionHeaders(headers) {
    var seed = toPositiveInteger(getHeaderIgnoreCase(headers, "x-enc-seed"), 0);
    var length = toPositiveInteger(getHeaderIgnoreCase(headers, "x-enc-len"), 0);
    var rawAlgo = getHeaderIgnoreCase(headers, "x-enc-algo");
    var algo = rawAlgo === void 0 ? 1 : toPositiveInteger(rawAlgo, 0);

    if (seed <= 0 || length <= 0 || algo <= 0) {
      return null;
    }

    return {
      seed: seed >>> 0,
      length: length,
      algo: algo
    };
  }

  function decryptComixImageAlgo1(bytes, seed, length) {
    var state = seed >>> 0;
    var limit = Math.min(toPositiveInteger(length, 0), bytes.length || 0);

    for (var index = 0; index < limit; index += 1) {
      state = (Math.imul(state, 1000005) + 0x499602d3) >>> 0;
      bytes[index] = (bytes[index] ^ (state >>> 24 & 255)) & 255;
    }
  }

  function decryptComixImageAlgo2(bytes, seed, length) {
    var table = getComixImageAlgo2Table();
    var limit = Math.min(toPositiveInteger(length, 0), bytes.length || 0);
    var wordCount = Math.ceil(limit / 4);
    var words = [];
    var wordIndex;
    var seedBits;
    var bitIndex;
    var value;
    var tapIndex;
    var byteIndex;
    var word;

    if (limit <= 0) {
      return;
    }

    for (wordIndex = 0; wordIndex < 32; wordIndex += 1) {
      value = table[wordIndex] >>> 0;
      seedBits = seed >>> 0;
      bitIndex = 0;
      while (seedBits !== 0) {
        if (seedBits & 1) {
          value ^= table[32 + bitIndex * 32 + wordIndex] >>> 0;
        }
        seedBits >>>= 1;
        bitIndex += 1;
      }
      words[wordIndex] = value >>> 0;
    }

    for (wordIndex = 32; wordIndex < wordCount; wordIndex += 1) {
      value = 0;
      for (tapIndex = 0; tapIndex < 32; tapIndex += 1) {
        if ((COMIX_IMAGE_ALGO2_TAPS >>> tapIndex) & 1) {
          value ^= words[wordIndex - 32 + tapIndex] >>> 0;
        }
      }
      words[wordIndex] = value >>> 0;
    }

    for (wordIndex = 0; wordIndex < wordCount; wordIndex += 1) {
      word = words[wordIndex] >>> 0;
      for (byteIndex = 0; byteIndex < 4; byteIndex += 1) {
        var offset = wordIndex * 4 + byteIndex;
        if (offset >= limit) {
          break;
        }
        bytes[offset] = (bytes[offset] ^ (word >>> byteIndex * 8 & 255)) & 255;
      }
    }
  }

  function getComixImageAlgo2Table() {
    var bytes;
    var table;
    var index;

    if (decodedComixImageAlgo2Table) {
      return decodedComixImageAlgo2Table;
    }

    bytes = b64Decode(COMIX_IMAGE_ALGO2_PACKED);
    table = [];
    for (index = 0; index + 3 < bytes.length; index += 4) {
      table.push((
        bytes[index] |
        bytes[index + 1] << 8 |
        bytes[index + 2] << 16 |
        bytes[index + 3] << 24
      ) >>> 0);
    }

    decodedComixImageAlgo2Table = table;
    return decodedComixImageAlgo2Table;
  }

  function readComixScrambleHeaders(headers) {
    var seedRaw = getHeaderIgnoreCase(headers, "x-scramble-seed");
    var gridRaw = cleanText(getHeaderIgnoreCase(headers, "x-scramble-grid") || "");
    var algoRaw = getHeaderIgnoreCase(headers, "x-scramble-algo");
    var hashRaw = cleanText(getHeaderIgnoreCase(headers, "x-scramble-hash") || "");
    var gridMatch = gridRaw.match(/^(\d+)\s*x\s*(\d+)$/i);
    var seed = Number(seedRaw);
    var cols;
    var rows;
    var algo;
    var hashXor;

    if (!isFinite(seed) || seed < 0 || !gridMatch) {
      return null;
    }

    cols = toPositiveInteger(gridMatch[1], 0);
    rows = toPositiveInteger(gridMatch[2], 0);
    if (cols <= 0 || rows <= 0 || cols * rows > 400) {
      return null;
    }

    algo = toPositiveInteger(algoRaw, 2);
    hashXor = decodeComixScrambleHash(hashRaw);
    if (hashRaw.length > 0 && hashXor === null) {
      // Unknown keyed seed mapping is safer to leave untouched than mis-shuffle.
      return null;
    }

    return {
      seed: seed >>> 0,
      cols: cols,
      rows: rows,
      algo: algo,
      hashXor: hashXor || 0
    };
  }

  function decodeComixScrambleHash(value) {
    var token = cleanText(value || "");

    if (token.length === 0) {
      return 0;
    }
    if (token === "03632") {
      return 58414;
    }
    if (token === "02900") {
      return 117532;
    }

    return null;
  }

  function canUsePaperbackCanvas() {
    return typeof App.createPBImage === "function" && typeof App.createPBCanvas === "function";
  }

  function descrambleComixImage(rawData, params) {
    var sourceImage = App.createPBImage({ data: rawData });
    var width = toPositiveInteger(sourceImage && sourceImage.width, 0);
    var height = toPositiveInteger(sourceImage && sourceImage.height, 0);
    var tileWidth = Math.floor(width / params.cols);
    var tileHeight = Math.floor(height / params.rows);
    var tileCount = params.cols * params.rows;
    var mode = params.algo === 3 && params.cols === 5 && params.rows === 5 ? "gf2affine" : "xorshift";
    var lookup = computeComixDescrambleLookup(mode, (params.seed ^ params.hashXor) >>> 0, tileCount);
    var canvas;
    var encoded;
    var mime;

    if (width <= 0 || height <= 0 || tileWidth <= 0 || tileHeight <= 0) {
      throw new Error("ComixTo returned an invalid scrambled image size.");
    }

    canvas = App.createPBCanvas();
    canvas.setSize(width, height);
    canvas.drawImage(sourceImage, 0, 0, width, height, 0, 0);

    lookup.forEach(function(sourceIndex, cleanIndex) {
      var cleanRow = Math.floor(cleanIndex / params.cols);
      var cleanCol = cleanIndex % params.cols;
      var sourceRow = Math.floor(sourceIndex / params.cols);
      var sourceCol = sourceIndex % params.cols;

      canvas.drawImage(
        sourceImage,
        sourceCol * tileWidth,
        sourceRow * tileHeight,
        tileWidth,
        tileHeight,
        cleanCol * tileWidth,
        cleanRow * tileHeight
      );
    });

    encoded = canvas.encode("image/webp");
    mime = "image/webp";
    if (!encoded) {
      encoded = canvas.encode("image/png");
      mime = "image/png";
    }
    if (!encoded) {
      throw new Error("Paperback could not encode the descrambled ComixTo image.");
    }

    return {
      data: encoded,
      mime: mime
    };
  }

  function computeComixDescrambleLookup(mode, seed, tileCount) {
    var permutation = [];
    var state = mode === "gf2affine" ? (seed | 1) >>> 0 : seed >>> 0;
    var index;
    var swapIndex;
    var temporary;
    var inverse = [];

    for (index = 0; index < tileCount; index += 1) {
      permutation[index] = index;
    }

    for (index = tileCount - 1; index > 0; index -= 1) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      swapIndex = state % (index + 1);
      temporary = permutation[index];
      permutation[index] = permutation[swapIndex];
      permutation[swapIndex] = temporary;
    }

    for (index = 0; index < tileCount; index += 1) {
      inverse[permutation[index]] = index;
    }

    return inverse;
  }

  function removeHeaderIgnoreCase(headers, name) {
    var normalized = String(name || "").toLowerCase();

    Object.keys(headers || {}).forEach(function(key) {
      if (String(key).toLowerCase() === normalized) {
        delete headers[key];
      }
    });
  }

  function isSignedApiRequestUrl(url) {
    var value = String(url || "");
    return value.indexOf(API_BASE) === 0 && /[?&]_=/.test(value);
  }

  function isSignerProtectedApiUrl(url) {
    var value = String(url || "");
    var path;

    if (value.indexOf(API_BASE) !== 0) {
      return false;
    }

    path = value.slice(API_BASE.length).split("?")[0];
    return /^\/manga(?:\/|$)/.test(path) || /^\/chapters\/[^/]+/.test(path);
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

  function buildResponseDiagnosticContext(response) {
    var headers = response && response.headers;
    var values = [
      ["content-type", getHeaderIgnoreCase(headers, "content-type")],
      ["server", getHeaderIgnoreCase(headers, "server")],
      ["cf-ray", getHeaderIgnoreCase(headers, "cf-ray")]
    ];
    var parts = [];

    values.forEach(function(entry) {
      var value = cleanText(entry[1] || "");
      if (value.length > 0) {
        parts.push(entry[0] + "=" + value);
      }
    });

    return parts.length > 0 ? " [" + parts.join(" ") + "]" : "";
  }

  function isCloudflareMitigatedResponse(response) {
    return cleanText(getHeaderIgnoreCase(response && response.headers, "cf-mitigated") || "").toLowerCase() === "challenge";
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
    var value = String(url || "").replace(/([?&]_)=([^&]*)/g, "$1=<redacted>");
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
    var parts = [];
    var updateLabel = getSeriesUpdateLabel(item);
    var year = toPositiveInteger(item && item.year, 0);
    var status = formatStatus(item && item.status);

    if (isFinite(latestChapter) && (latestChapter > 0 || (item && item.hasChapters === true && latestChapter >= 0))) {
      parts.push("Ch. " + formatChapterNumber(latestChapter));
    }

    if (updateLabel.length > 0) {
      parts.push(updateLabel);
    }
    if (year > 0) {
      parts.push(String(year));
    }
    if (status.length > 0) {
      parts.push(status);
    }

    return parts.length > 0 ? parts.join(" · ") : void 0;
  }

  function getSeriesUpdateLabel(item) {
    var formatted = [
      item && item.chapterUpdatedAtFormatted,
      item && item.chapter_updated_at_formatted,
      item && item.updatedAtFormatted,
      item && item.updated_at_formatted
    ];
    var absolute = [
      item && item.chapterUpdatedAt,
      item && item.chapter_updated_at,
      item && item.updatedAt,
      item && item.updated_at
    ];
    var index;
    var clean;
    var date;

    for (index = 0; index < formatted.length; index += 1) {
      clean = cleanText(formatted[index] || "");
      if (clean.length > 0) {
        return clean;
      }
    }

    for (index = 0; index < absolute.length; index += 1) {
      date = parseAbsoluteDate(absolute[index]);
      if (date) {
        return date.toISOString().slice(0, 10);
      }
    }

    return "";
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

  function streamHomeSection(sectionCallback, id, title, type, pagedResultsPromise) {
    return Promise.resolve(pagedResultsPromise).then(function(pagedResults) {
      var section = createHomeSection(id, title, type, pagedResults);

      if (Array.isArray(section.items) && section.items.length > 0) {
        sectionCallback(section);
        return true;
      }
      return false;
    }).catch(function(error) {
      if (isCloudflareBypassError(error)) {
        throw error;
      }
      if (typeof console !== "undefined" && console && typeof console.warn === "function") {
        console.warn("[ComixTo] Home section " + id + " failed: " + String(error));
      }
      // Keep other Discover sections usable when one endpoint is slow or fails.
      return false;
    });
  }

  function isCloudflareBypassError(error) {
    return cleanText(error && error.message || error || "").toLowerCase().indexOf("cloudflare bypass required") >= 0;
  }

  // Search / Filter Helpers

  function buildHiddenTermOptions(filterData) {
    var options = [];
    var seen = {};

    function addOptions(prefix, labelPrefix, values) {
      normalizeFilterOptions(values).forEach(function(option) {
        var id = prefix + option.id;
        if (seen[id]) {
          return;
        }
        seen[id] = true;
        options.push({
          id: id,
          label: labelPrefix + ": " + option.label
        });
      });
    }

    addOptions(TAG_PREFIX_GENRE, "Genre", filterData && filterData.genres);
    addOptions(TAG_PREFIX_FORMAT, "Format", filterData && filterData.formats);
    addOptions(TAG_PREFIX_THEME, "Tag", filterData && filterData.themes);
    return options;
  }

  function appendSavedTermOptions(options, savedValues) {
    var result = Array.isArray(options) ? options.slice() : [];
    var seen = {};

    result.forEach(function(option) {
      seen[String(option.id)] = true;
    });
    normalizeHiddenTermValues(savedValues).forEach(function(value) {
      if (seen[value]) {
        return;
      }
      seen[value] = true;
      result.push({
        id: value,
        label: "Saved unavailable term: " + value
      });
    });

    return result;
  }

  function normalizeHiddenTermValues(value) {
    var values = Array.isArray(value) ? value : normalizeArray(value);
    var selected = [];

    values.forEach(function(entry) {
      var clean = cleanText(entry || "");
      if ((clean.indexOf(TAG_PREFIX_GENRE) === 0 || clean.indexOf(TAG_PREFIX_FORMAT) === 0 || clean.indexOf(TAG_PREFIX_THEME) === 0) && selected.indexOf(clean) < 0) {
        selected.push(clean);
      }
    });

    return selected;
  }

  function getHiddenTermIds(values) {
    var ids = [];

    normalizeHiddenTermValues(values).forEach(function(value) {
      var id = value.replace(/^(genre:|format:|theme:)/, "");
      if (id.length > 0) {
        pushUnique(ids, id);
      }
    });

    return ids;
  }

  function buildSearchTagSections(filterData) {
    var sections = [];
    var genres = normalizeFilterOptions(filterData && filterData.genres);
    var demographics = normalizeFilterOptions(filterData && filterData.demographics);
    var formats = normalizeFilterOptions(filterData && filterData.formats);
    var themes = normalizeFilterOptions(filterData && filterData.themes);
    var years = normalizeFilterOptions(filterData && filterData.years);
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
    pushSearchTagSection(sections, "years", "Release Year", TAG_PREFIX_YEAR, years);
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
      authorNames: extractSearchFieldValue(query, SEARCH_FIELD_AUTHOR),
      artistNames: extractSearchFieldValue(query, SEARCH_FIELD_ARTIST),
      tagNames: extractSearchFieldValue(query, SEARCH_FIELD_TAGS),
      minChapters: extractPositiveIntegerSearchFieldValue(query, SEARCH_FIELD_MIN_CHAPTERS, "Minimum Chapters"),
      yearFrom: extractReleaseYearSearchFieldValue(query, SEARCH_FIELD_YEAR_FROM, "Release Year From"),
      yearTo: extractReleaseYearSearchFieldValue(query, SEARCH_FIELD_YEAR_TO, "Release Year To")
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
        if (/^\d+$/.test(value)) {
          pushUnique(filters.authors, value);
        } else {
          filters.authorNames = appendCommaSeparatedValue(filters.authorNames, stripTagLabelPrefix(tag && tag.label, "Author") || value);
        }
      } else if (tagId.indexOf(TAG_PREFIX_ARTIST) === 0) {
        value = tagId.slice(TAG_PREFIX_ARTIST.length);
        if (/^\d+$/.test(value)) {
          pushUnique(filters.artists, value);
        } else {
          filters.artistNames = appendCommaSeparatedValue(filters.artistNames, stripTagLabelPrefix(tag && tag.label, "Artist") || value);
        }
      } else if (tagId.indexOf(TAG_PREFIX_YEAR) === 0) {
        value = toPositiveInteger(tagId.slice(TAG_PREFIX_YEAR.length), 0);
        if (value >= OLDEST_RELEASE_YEAR && value <= 9999) {
          filters.yearFrom = value;
          filters.yearTo = value;
        }
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

    if (filters.yearFrom !== void 0 && filters.yearTo !== void 0 && filters.yearFrom > filters.yearTo) {
      throw new Error("Release Year From cannot be greater than Release Year To.");
    }

    return filters;
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

    return rawValue;
  }

  function splitCommaSeparatedValues(value) {
    var seen = {};
    var values = [];

    String(value || "").split(",").forEach(function(part) {
      var clean = cleanText(part);
      var key = clean.toLowerCase();

      if (clean.length > 0 && !seen[key]) {
        seen[key] = true;
        values.push(clean);
      }
    });

    return values;
  }

  function normalizeSearchText(value) {
    return cleanText(value || "")
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  }

  function appendCommaSeparatedValue(existing, value) {
    var clean = cleanText(value || "");

    if (clean.length === 0) {
      return existing;
    }

    return cleanText(existing || "").length > 0 ? existing + "," + clean : clean;
  }

  function stripTagLabelPrefix(value, prefix) {
    var clean = cleanText(value || "");
    var marker = String(prefix || "") + ":";

    return clean.toLowerCase().indexOf(marker.toLowerCase()) === 0 ? clean.slice(marker.length).trim() : clean;
  }

  function extractPositiveIntegerSearchFieldValue(query, fieldId, label) {
    var rawValue = extractSearchFieldValue(query, fieldId);
    var value;

    if (rawValue.length === 0) {
      return void 0;
    }
    if (!/^\d+$/.test(rawValue)) {
      throw new Error(label + " must be a positive whole number.");
    }

    value = parseInt(rawValue, 10);
    if (!isFinite(value) || value <= 0) {
      throw new Error(label + " must be a positive whole number.");
    }

    return value;
  }

  function extractReleaseYearSearchFieldValue(query, fieldId, label) {
    var rawValue = extractSearchFieldValue(query, fieldId);
    var year;

    if (rawValue.length === 0) {
      return void 0;
    }
    if (!/^\d{4}$/.test(rawValue)) {
      throw new Error(label + " must be a four-digit year.");
    }

    year = parseInt(rawValue, 10);
    if (!isFinite(year) || year < OLDEST_RELEASE_YEAR || year > 9999) {
      throw new Error(label + " must be between " + OLDEST_RELEASE_YEAR + " and 9999.");
    }

    return year;
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
        var liveOptions = normalizeFilterOptions(fetched[key]);

        if (key === "sorts") {
          var seen = {};
          liveOptions.forEach(function(option) {
            seen[String(option.id).toLowerCase()] = true;
          });
          normalizeFilterOptions(fallback && fallback[key]).forEach(function(option) {
            var id = String(option.id).toLowerCase();
            if (!seen[id]) {
              seen[id] = true;
              liveOptions.push(option);
            }
          });
        }

        merged[key] = liveOptions;
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
    pushReleaseYearMetadataTag(metadataTags, details.year);
    pushMetadataTag(metadataTags, "language", "Language", details.originalLanguage || details.original_language);
    pushMetadataTag(metadataTags, "content-rating", "Content Rating", formatOptionLabel(details.contentRating || details.content_rating));
    pushMetadataTag(metadataTags, "rated-by", "Rated By", formatPositiveCount(details.ratedCount || details.rated_count || details.ratingCount || details.rating_count));
    pushMetadataTag(metadataTags, "followers", "Followers", formatPositiveCount(details.followsTotal || details.follows_total));

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

  function pushReleaseYearMetadataTag(tags, value) {
    var year = toPositiveInteger(value, 0);

    if (year >= OLDEST_RELEASE_YEAR && year <= 9999) {
      tags.push(createPrefixedTag(TAG_PREFIX_YEAR, String(year), "Year: " + year));
    }
  }

  function pushMetadataTag(tags, id, label, value) {
    var clean = cleanText(value || "");

    if (clean.length > 0) {
      tags.push(App.createTag({
        id: "metadata:" + id + ":" + clean.toLowerCase(),
        label: label + ": " + clean
      }));
    }
  }

  function formatPositiveCount(value) {
    var count = toNumber(value, NaN);

    return isFinite(count) && count > 0 ? String(Math.floor(count)) : "";
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
    var volume = cleanText(chapter && chapter.volume !== void 0 && chapter.volume !== null ? chapter.volume : "");
    var chapterLabel;
    var prefix;

    if (!isFinite(chapterNumber) || chapterNumber <= 0) {
      return rawName.length > 0 ? rawName : "Chapter";
    }

    chapterLabel = "Chapter " + formatChapterNumber(chapterNumber);
    prefix = (volume.length > 0 ? "Vol. " + volume + " · " : "") + chapterLabel;
    if (rawName.length === 0 || rawName.toLowerCase() === chapterLabel.toLowerCase() || rawName.toLowerCase() === prefix.toLowerCase()) {
      return prefix;
    }

    return prefix + ": " + rawName;
  }

  function compareChaptersDesc(a, b) {
    return toNumber(b && b.number, 0) - toNumber(a && a.number, 0);
  }

  function createChapterListParams(page, settings) {
    var params = {
      page: page,
      limit: CHAPTERS_PAGE_SIZE,
      order: { number: "desc" }
    };
    var groupId = getServerChapterGroupId(settings);

    if (groupId.length > 0) {
      params.scanlation_group_id = groupId;
    }

    return params;
  }

  function getServerChapterGroupId(settings) {
    var tokens = settings && Array.isArray(settings.tokens) ? settings.tokens : [];

    if (settings && settings.mode === GROUP_MODE_ONLY && tokens.length === 1 && /^\d+$/.test(tokens[0])) {
      return tokens[0];
    }

    return "";
  }

  function getChapterPageFetchLimit(firstPage) {
    var lastPage = getResultLastPage(firstPage);
    var items = Array.isArray(firstPage && firstPage.items) ? firstPage.items : [];

    if (lastPage > 1) {
      if (lastPage > MAX_CHAPTER_PAGES) {
        throw new Error("ComixTo reported " + lastPage + " chapter pages, above the safety limit of " + MAX_CHAPTER_PAGES + ". Refusing to return a truncated chapter list.");
      }
      return lastPage;
    }

    return getNextPageMetadata(firstPage, 1, items, CHAPTERS_PAGE_SIZE) ? MAX_CHAPTER_PAGES : 1;
  }

  function hasExplicitChapterLastPage(result) {
    var meta = result && (isObject(result.meta) ? result.meta : result.pagination);

    return firstPositiveInteger([meta && meta.lastPage, meta && meta.last_page]) > 1;
  }

  function rememberChapterPageItems(result, seen) {
    var items = Array.isArray(result && result.items) ? result.items : [];
    var added = 0;

    items.forEach(function(item, index) {
      var id = getChapterId(item);
      var number = item && item.number !== void 0 && item.number !== null ? String(item.number) : "";
      var url = cleanText(item && item.url || "");
      var key = id.length > 0 ? "id:" + id : number.length > 0 || url.length > 0 ? "fallback:" + number + "|" + url : "page-item:" + index + "|" + JSON.stringify(item || {});

      if (!seen[key]) {
        seen[key] = true;
        added += 1;
      }
    });

    return added;
  }

  function shouldStopChapterPaging(result, page) {
    var items = Array.isArray(result && result.items) ? result.items : [];
    var meta = result && (isObject(result.meta) ? result.meta : result.pagination);
    var hasNext;
    var lastPage;

    if (items.length === 0) {
      return true;
    }

    if (isObject(meta)) {
      hasNext = meta.hasNext;
      if (hasNext === void 0) {
        hasNext = meta.has_next;
      }
      if (hasNext === false) {
        return true;
      }
      if (hasNext === true) {
        return false;
      }

      lastPage = firstPositiveInteger([meta.lastPage, meta.last_page]);
      if (lastPage > 0 && page >= lastPage) {
        return true;
      }
    }

    return items.length < CHAPTERS_PAGE_SIZE;
  }

  function isCompleteChapterPage(result) {
    var meta = result && (isObject(result.meta) ? result.meta : result.pagination);
    var hasNext;
    var page;
    var lastPage;

    if (!isObject(meta)) {
      return false;
    }

    hasNext = meta.hasNext;
    if (hasNext === void 0) {
      hasNext = meta.has_next;
    }
    if (hasNext === false) {
      return true;
    }
    if (hasNext === true) {
      return false;
    }

    page = firstPositiveInteger([meta.page, meta.currentPage, meta.current_page]);
    lastPage = firstPositiveInteger([meta.lastPage, meta.last_page]);
    return page > 0 && lastPage > 0 && page >= lastPage;
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
      url = "https:" + url;
      return normalizeReadableChapterImageUrl(url);
    }

    if (baseUrl.length === 0) {
      return normalizeReadableChapterImageUrl(url);
    }

    url = baseUrl.replace(/\/+$/, "") + "/" + url.replace(/^\/+/, "");
    return normalizeReadableChapterImageUrl(url);
  }

  function normalizeReadableChapterImageUrl(url) {
    // Keep the API-provided image path. The request interceptor removes headers
    // current Comix image hosts reject and decodes supported encrypted/scrambled
    // responses from the response headers instead of guessing CDN path variants.
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
    var matchMode = settings && settings.matchMode || GROUP_MATCH_EXACT;

    if (tokens.length === 0 || mode === GROUP_MODE_ALL) {
      return chapters;
    }

    if (mode === GROUP_MODE_HIDE) {
      return chapters.filter(function(chapter) {
        return !chapterMatchesGroupTokens(chapter, tokens, matchMode);
      });
    }

    if (mode === GROUP_MODE_ONLY) {
      return chapters.filter(function(chapter) {
        return chapterMatchesGroupTokens(chapter, tokens, matchMode);
      });
    }

    if (mode === GROUP_MODE_PREFER) {
      return collapseDuplicateChapterGroups(chapters, tokens, matchMode);
    }

    return chapters;
  }

  function hasActiveChapterGroupFilter(settings) {
    return !!settings &&
      settings.mode !== GROUP_MODE_ALL &&
      Array.isArray(settings.tokens) &&
      settings.tokens.length > 0;
  }

  function collapseDuplicateChapterGroups(chapters, tokens, matchMode) {
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
      output.push(selectPreferredChapter(grouped[key], tokens, matchMode));
    });

    return output;
  }

  function selectPreferredChapter(chapters, tokens, matchMode) {
    var selected = chapters[0];
    var selectedIndex = getGroupTokenIndex(selected, tokens, matchMode);

    chapters.forEach(function(chapter) {
      var tokenIndex = getGroupTokenIndex(chapter, tokens, matchMode);

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
      var token = normalizeGroupMatchText(part);
      if (token.length > 0 && !seen[token]) {
        seen[token] = true;
        tokens.push(token);
      }
    });

    return tokens;
  }

  function chapterMatchesGroupTokens(chapter, tokens, matchMode) {
    return getGroupTokenIndex(chapter, tokens, matchMode) >= 0;
  }

  function getGroupTokenIndex(chapter, tokens, matchMode) {
    var groupId = cleanText(getChapterGroupId(chapter)).toLowerCase();
    var groupName = normalizeGroupMatchText(getChapterGroupName(chapter));
    var allowContains = matchMode === GROUP_MATCH_CONTAINS;

    for (var index = 0; index < tokens.length; index += 1) {
      if (tokens[index] === groupId || tokens[index] === groupName || (allowContains && groupName.indexOf(tokens[index]) >= 0)) {
        return index;
      }
    }

    return -1;
  }

  function normalizeGroupMatchText(value) {
    return cleanText(value || "")
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .toLowerCase();
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
    var cleanUrl = normalizeChapterShareUrl(url);
    var existingIndex;

    if (cleanId.length > 0 && cleanUrl.indexOf(DOMAIN + "/title/") === 0) {
      existingIndex = source.cachedChapterShareUrlOrder.indexOf(cleanId);
      if (existingIndex >= 0) {
        source.cachedChapterShareUrlOrder.splice(existingIndex, 1);
      }
      source.cachedChapterShareUrls[cleanId] = cleanUrl;
      source.cachedChapterShareUrlOrder.push(cleanId);

      while (source.cachedChapterShareUrlOrder.length > CHAPTER_SHARE_URL_CACHE_SIZE) {
        delete source.cachedChapterShareUrls[source.cachedChapterShareUrlOrder.shift()];
      }
    }
  }

  function getCachedChapterShareUrl(source, chapterId) {
    var cleanId = cleanText(chapterId || "");
    var url = cleanText(source && source.cachedChapterShareUrls && source.cachedChapterShareUrls[cleanId] || "");

    if (url.length > 0 && source && Array.isArray(source.cachedChapterShareUrlOrder)) {
      removeArrayValue(source.cachedChapterShareUrlOrder, cleanId);
      source.cachedChapterShareUrlOrder.push(cleanId);
    }

    return url;
  }

  function normalizeChapterShareUrl(url) {
    var cleanUrl = cleanText(url || "");

    if (cleanUrl.indexOf(DOMAIN + "/title/") === 0) {
      return cleanUrl;
    }
    if (cleanUrl.indexOf("/title/") === 0) {
      return DOMAIN + cleanUrl;
    }
    if (cleanUrl.indexOf("title/") === 0) {
      return DOMAIN + "/" + cleanUrl;
    }

    return "";
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

    return createUnknownChapterDate();
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

  function createUnknownChapterDate() {
    return new Date(0);
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

  async function resetSourceSettings(stateManager) {
    var keys = [
      STATE_CONTENT_RATING,
      STATE_LATEST_UPDATES_VIEW,
      STATE_TRENDING_RANGE,
      STATE_MOST_FOLLOWED_RANGE,
      STATE_HOME_DEMOGRAPHICS,
      STATE_HOME_TYPES,
      STATE_EXTRA_HOME_SECTIONS,
      STATE_HIDDEN_TERMS,
      STATE_REQUIRED_TERMS,
      STATE_REQUIRED_TERMS_MODE,
      STATE_CHAPTER_GROUP_MODE,
      STATE_CHAPTER_GROUP_MATCH,
      STATE_CHAPTER_GROUP_FILTER,
      STATE_FILTER_CACHE,
      STATE_FILTER_CACHE_LEGACY
    ];

    for (var index = 0; index < keys.length; index += 1) {
      await stateManager.store(keys[index], null);
    }
  }

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

  function createOptionalMultiSelectSetting(stateManager, config) {
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
          await stateManager.store(config.id, normalizeOptionalMultiOptionValues(newValue, config.options));
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

  function getContentRatingsUpTo(value) {
    var selected = normalizeOptionValue(value, CONTENT_RATING_OPTIONS, CONTENT_RATING_DEFAULT);
    var ratings = [];

    for (var index = 0; index < CONTENT_RATING_OPTIONS.length; index += 1) {
      ratings.push(CONTENT_RATING_OPTIONS[index].id);
      if (CONTENT_RATING_OPTIONS[index].id === selected) {
        break;
      }
    }

    return ratings;
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

  async function getExtraHomeSections(stateManager) {
    return normalizeOptionalMultiOptionValues(await stateManager.retrieve(STATE_EXTRA_HOME_SECTIONS), EXTRA_HOME_SECTION_OPTIONS);
  }

  async function getHiddenTerms(stateManager) {
    return normalizeHiddenTermValues(await stateManager.retrieve(STATE_HIDDEN_TERMS));
  }

  async function getRequiredTerms(stateManager) {
    return normalizeHiddenTermValues(await stateManager.retrieve(STATE_REQUIRED_TERMS));
  }

  async function getRequiredTermsMode(stateManager) {
    return normalizeOptionValue(await stateManager.retrieve(STATE_REQUIRED_TERMS_MODE), REQUIRED_TERM_MODE_OPTIONS, "and");
  }

  async function getHomeFilterParams(stateManager) {
    var values = await Promise.all([
      getContentRating(stateManager),
      getHomeDemographics(stateManager),
      getHomeTypes(stateManager),
      getHiddenTerms(stateManager),
      getRequiredTerms(stateManager),
      getRequiredTermsMode(stateManager)
    ]);
    var contentRating = values[0];
    var demographics = values[1];
    var types = values[2];
    var hiddenTerms = getHiddenTermIds(values[3]);
    var requiredTerms = getHiddenTermIds(values[4]);
    hiddenTerms = hiddenTerms.filter(function(id) {
      return requiredTerms.indexOf(id) < 0;
    });
    var params = {
      content_rating: getContentRatingsUpTo(contentRating)
    };

    if (demographics.length > 0 && demographics.length < HOME_DEMOGRAPHIC_OPTIONS.length) {
      // The browse API uses numeric demographics, but the homepage/top frontend uses
      // slug-valued genders[] for the same concept.
      params.genders = demographics;
    }

    if (types.length > 0 && types.length < HOME_TYPE_OPTIONS.length) {
      params.types = types;
    }

    if (hiddenTerms.length > 0) {
      params.genres_ex = hiddenTerms;
    }

    if (requiredTerms.length > 0) {
      params.genres_in = requiredTerms;
      params.genres_mode = values[5];
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

  async function getChapterGroupMatchMode(stateManager) {
    return normalizeOptionValue(await stateManager.retrieve(STATE_CHAPTER_GROUP_MATCH), GROUP_MATCH_OPTIONS, GROUP_MATCH_EXACT);
  }

  async function getChapterGroupFilterText(stateManager) {
    return cleanText(await stateManager.retrieve(STATE_CHAPTER_GROUP_FILTER) || "");
  }

  async function getChapterGroupSettings(stateManager) {
    var values = await Promise.all([
      getChapterGroupMode(stateManager),
      getChapterGroupFilterText(stateManager),
      getChapterGroupMatchMode(stateManager)
    ]);

    return {
      mode: values[0],
      tokens: parseGroupFilterTokens(values[1]),
      matchMode: values[2]
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

  function normalizeOptionalMultiOptionValues(value, options) {
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

    return selected;
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
    return buildApiUrl(path, params);
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
    var meta = result && (isObject(result.meta) ? result.meta : result.pagination);
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

  function getResultLastPage(result) {
    var meta = result && result.meta;
    var pagination = result && result.pagination;
    var lastPage = firstPositiveInteger([
      meta && meta.lastPage,
      meta && meta.last_page,
      pagination && pagination.lastPage,
      pagination && pagination.last_page
    ]);

    return lastPage > 0 ? lastPage : 1;
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
