"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _needle = _interopRequireDefault(require("needle"));

var _cheerio = _interopRequireDefault(require("cheerio"));

var _cacheManager = _interopRequireDefault(require("cache-manager"));

var _cacheManagerRedisStore = _interopRequireDefault(require("cache-manager-redis-store"));

var _bottleneck = _interopRequireDefault(require("bottleneck"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } } function _next(value) { step("next", value); } function _throw(err) { step("throw", err); } _next(); }); }; }

const BASE_URL = 'https://zooqle.com';
const CACHE_PREFIX = 'stremio_zooqle|';
const MAX_CONCURRENT_REQUESTS = 6;
const CACHE_TTLS = {
  // Item URLs aren't supposed to change, so we cache them for long
  getItemUrl: 7 * 24 * 60 * 60,
  // a week
  getMovieTorrents: 4 * 60 * 60,
  // 4 hours
  getShowTorrents: 4 * 60 * 60,
  // 4 hours
  NO_RESULTS: 10 * 60 // 10 minutes

};

class ZooqleClient {
  constructor({
    userName,
    password,
    userAgent,
    cache,
    proxy
  } = {}) {
    if (!userName || !password) {
      throw new Error('Username and password are required');
    }

    this._userName = userName;
    this._password = password;
    this._userAgent = userAgent;
    this._scheduler = new _bottleneck.default({
      maxConcurrent: MAX_CONCURRENT_REQUESTS
    });

    if (cache === '1') {
      this._cache = _cacheManager.default.caching({
        store: 'memory'
      });
    } else if (cache && cache !== '0') {
      this._cache = _cacheManager.default.caching({
        store: _cacheManagerRedisStore.default,
        url: cache
      });
    }

    if (proxy) {
      this._proxy = proxy;
    }
  }

  _extractTorrentsFromPage(body) {
    let $ = _cheerio.default.load(body);

    let currentCategory = 'Std';
    return $('.table-torrents tr').toArray().reduce((results, row, i) => {
      let $cells = $(row).find('td');

      if (i === 0 || $cells.length === 1) {
        // Sometimes a category is specified as a header on a separate row...
        let newCategory = $cells.eq(0).find('a ~ span').prev().text().trim();
        currentCategory = newCategory || currentCategory;
      } else {
        let magnetLink = $cells.find('a[href^="magnet"]').attr('href');
        let $audioSpans = $cells.eq(1).find('div > span:not(.smallest)');
        let audio = $audioSpans.eq(0).text() || undefined;
        let languages = $audioSpans.eq(1).text().toUpperCase();
        languages = languages ? languages.split(',') : []; // ...and sometimes as a small icon along the audio specs

        let $category = $cells.eq(1).find('.zqf-mi-width, .zqf-mi-3d').parent();
        let category = $category.text().trim() || currentCategory;
        let users = $cells.find('.progress').last().attr('title');
        let seedersMatch = users && users.match(/seeders:\s*([0-9,]+)/i);
        let seeders = seedersMatch && Number(seedersMatch[1].replace(',', ''));
        results.push({
          category,
          magnetLink,
          seeders,
          audio,
          languages
        });
      }

      return results;
    }, []);
  }

  _getShowIdFromPage(body) {
    let match = body.match(/data-href="[^"]+show=(\d+)/);
    return match && match[1];
  }

  _getAuthStatusFromResponse(res) {
    return Boolean(res.body) && res.body.includes('href="/user/tv"');
  }

  _request(url, method = 'get', headers = {}, data = null) {
    var _this = this;

    return _asyncToGenerator(function* () {
      return _this._scheduler.schedule(
      /*#__PURE__*/
      _asyncToGenerator(function* () {
        let options = {
          headers: _objectSpread({
            'user-agent': _this._userAgent
          }, headers),
          cookies: _this._cookies,
          proxy: _this._proxy
        };
        let res = yield (0, _needle.default)(method, url, data, options);

        if (res.statusCode > 399) {
          throw new Error(`Error ${res.statusCode} when requesting ${url}`);
        }

        if (res.cookies) {
          _this._cookies = _objectSpread({}, _this.cookies, res.cookies);
        }

        return res;
      }));
    })();
  }

  _authenticate() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      let url = `${BASE_URL}/user/register?ajax=1`;
      let data = {
        action: 'login',
        remember: 1,
        user: _this2._userName,
        password: _this2._password
      };
      let headers = {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      };
      let res = yield _this2._request(url, 'post', headers, data);

      if (!res.cookies || !res.cookies.zqt) {
        throw new Error('Unable to authenticate');
      }
    })();
  }

  _getItemUrl(imdbId) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      let searchUrl = `${BASE_URL}/search?q=${imdbId}`;
      let res = yield _this3._request(searchUrl);

      if (res.statusCode < 300) {
        return;
      }

      return `${BASE_URL}${res.headers.location}`;
    })();
  }

  _getMovieTorrents(imdbId) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      if (!_this4._cookies) {
        yield _this4._authenticate();
      }

      let url = yield _this4.getItemUrl(imdbId);

      if (!url) {
        return [];
      }

      let res = yield _this4._request(url); // In case the session has been terminated for whatever reason
      // (like cookie expiration)

      if (!_this4._getAuthStatusFromResponse(res)) {
        yield _this4._authenticate();
        res = yield _this4._request(url);
      }

      return _this4._extractTorrentsFromPage(res.body) || [];
    })();
  }

  _getShowTorrents(imdbId, season, episode) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      let itemUrl = yield _this5.getItemUrl(imdbId);

      if (!itemUrl) {
        return [];
      }

      let itemRes = yield _this5._request(itemUrl);

      let showId = _this5._getShowIdFromPage(itemRes.body);

      if (!showId) {
        return [];
      }

      let torrentsUrl = `${BASE_URL}/misc/tveps.php` + `?show=${showId}&se=${season}&ep=${episode}`;
      let torrentsRes = yield _this5._request(torrentsUrl);
      return _this5._extractTorrentsFromPage(torrentsRes.body) || [];
    })();
  }

  getItemUrl(imdbId) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      if (!_this6._cache) {
        return _this6._getItemUrl(imdbId);
      }

      let cacheKey = `${CACHE_PREFIX}itemUrl:${imdbId}`;
      let cacheOptions = {
        ttl: CACHE_TTLS.getItemUrl
      };

      let method = _this6._getItemUrl.bind(_this6, imdbId);

      return _this6._cache.wrap(cacheKey, method, cacheOptions);
    })();
  }

  getMovieTorrents(imdbId) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      if (!_this7._cache) {
        return _this7._getMovieTorrents(imdbId);
      }

      let cacheKey = `${CACHE_PREFIX}movie:${imdbId}`;
      let cacheOptions = {
        ttl: res => {
          return res.length ? CACHE_TTLS.getMovieTorrents : CACHE_TTLS.NO_RESULTS;
        }
      };

      let method = _this7._getMovieTorrents.bind(_this7, imdbId);

      return _this7._cache.wrap(cacheKey, method, cacheOptions);
    })();
  }

  getShowTorrents(imdbId, season, episode) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      if (!_this8._cache) {
        return _this8._getMovieTorrents(imdbId, season, episode);
      }

      let cacheKey = `${CACHE_PREFIX}show:${imdbId}:${season}:${episode}`;
      let cacheOptions = {
        ttl: res => {
          return res.length ? CACHE_TTLS.getShowTorrents : CACHE_TTLS.NO_RESULTS;
        }
      };

      let method = _this8._getShowTorrents.bind(_this8, imdbId, season, episode);

      return _this8._cache.wrap(cacheKey, method, cacheOptions);
    })();
  }

}

var _default = ZooqleClient;
exports.default = _default;
//# sourceMappingURL=ZooqleClient.js.map