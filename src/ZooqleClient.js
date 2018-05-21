import needle from 'needle'
import cheerio from 'cheerio'
import cacheManager from 'cache-manager'
import redisStore from 'cache-manager-redis-store'
import Bottleneck from 'bottleneck'


const BASE_URL = 'https://zooqle.com'
const CACHE_PREFIX = 'stremio_zooqle|'
const MAX_CONCURRENT_REQUESTS = 6
const CACHE_TTLS = {
  // Item URLs aren't supposed to change, so we cache them for long
  getItemUrl: 7 * 24 * 60 * 60, // a week
  getMovieTorrents: 4 * 60 * 60, // 4 hours
  getShowTorrents: 4 * 60 * 60, // 4 hours
  NO_RESULTS: 10 * 60, // 10 minutes
}


class ZooqleClient {
  constructor({ userName, password, userAgent, cache, proxy } = {}) {
    if (!userName || !password) {
      throw new Error('Username and password are required')
    }

    this._userName = userName
    this._password = password
    this._userAgent = userAgent
    this._scheduler = new Bottleneck({ maxConcurrent: MAX_CONCURRENT_REQUESTS })

    if (cache === '1') {
      this.cache = cacheManager.caching({ store: 'memory' })
    } else if (cache && cache !== '0') {
      this.cache = cacheManager.caching({
        store: redisStore,
        url: cache,
      })
    }

    if (proxy) {
      this._proxy = proxy
    }
  }

  _extractTorrentsFromPage(body) {
    let $ = cheerio.load(body)
    let currentCategory = 'Std'

    return $('.table-torrents tr').toArray().reduce((results, row, i) => {
      let $cells = $(row).find('td')

      if (i === 0 || $cells.length === 1) {
        // Sometimes a category is specified as a header on a separate row...
        let newCategory = $cells.eq(0).find('a ~ span').prev().text().trim()
        currentCategory = newCategory || currentCategory
      } else {
        let magnetLink = $cells.find('a[href^="magnet"]').attr('href')

        let $audioSpans = $cells.eq(1).find('div > span:not(.smallest)')
        let audio = $audioSpans.eq(0).text() || undefined
        let languages = $audioSpans.eq(1).text().toUpperCase()
        languages = languages ? languages.split(',') : []

        // ...and sometimes as a small icon along the audio specs
        let $category = $cells.eq(1).find('.zqf-mi-width, .zqf-mi-3d').parent()
        let category = $category.text().trim() || currentCategory

        let users = $cells.find('.progress').last().attr('title')
        let seedersMatch = users && users.match(/seeders:\s*([0-9,]+)/i)
        let seeders = seedersMatch && Number(seedersMatch[1].replace(',', ''))

        results.push({ category, magnetLink, seeders, audio, languages })
      }

      return results
    }, [])
  }

  _getShowIdFromPage(body) {
    let match = body.match(/data-href="[^"]+show=(\d+)/)
    return match && match[1]
  }

  _getAuthStatusFromResponse(res) {
    return Boolean(res.body) && res.body.includes('href="/user/tv"')
  }

  async _request(url, method = 'get', headers = {}, data = null) {
    return this._scheduler.schedule(async () => {
      let options = {
        headers: {
          'user-agent': this._userAgent,
          ...headers,
        },
        cookies: this._cookies,
        proxy: this._proxy,
      }
      let res = await needle(method, url, data, options)

      if (res.statusCode > 399) {
        throw new Error(`Error ${res.statusCode} when requesting ${url}`)
      }

      if (res.cookies) {
        this._cookies = { ...this.cookies, ...res.cookies }
      }

      return res
    })
  }

  async _authenticate() {
    let url = `${BASE_URL}/user/register?ajax=1`
    let data = {
      action: 'login',
      remember: 1,
      user: this._userName,
      password: this._password,
    }
    let headers = {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    }

    let res = await this._request(url, 'post', headers, data)

    if (!res.cookies || !res.cookies.zqt) {
      throw new Error('Unable to authenticate')
    }
  }

  async _getItemUrl(imdbId) {
    let searchUrl = `${BASE_URL}/search?q=${imdbId}`
    let res = await this._request(searchUrl)

    if (res.statusCode < 300) {
      return
    }

    return `${BASE_URL}${res.headers.location}`
  }

  async _getMovieTorrents(imdbId) {
    if (!this._cookies) {
      await this._authenticate()
    }

    let url = await this.getItemUrl(imdbId)

    if (!url) {
      return []
    }

    let res = await this._request(url)

    // In case the session has been terminated for whatever reason
    // (like cookie expiration)
    if (!this._getAuthStatusFromResponse(res)) {
      await this._authenticate()
      res = await this._request(url)
    }

    return this._extractTorrentsFromPage(res.body) || []
  }

  async _getShowTorrents(imdbId, season, episode) {
    let itemUrl = await this.getItemUrl(imdbId)

    if (!itemUrl) {
      return []
    }

    let itemRes = await this._request(itemUrl)
    let showId = this._getShowIdFromPage(itemRes.body)

    if (!showId) {
      return []
    }

    let torrentsUrl = `${BASE_URL}/misc/tveps.php` +
      `?show=${showId}&se=${season}&ep=${episode}`
    let torrentsRes = await this._request(torrentsUrl)

    return this._extractTorrentsFromPage(torrentsRes.body) || []
  }

  async getItemUrl(imdbId) {
    if (!this.cache) {
      return this._getItemUrl(imdbId)
    }

    let cacheKey = `${CACHE_PREFIX}itemUrl:${imdbId}`
    let cacheOptions = {
      ttl: CACHE_TTLS.getItemUrl,
    }
    let method = this._getItemUrl.bind(this, imdbId)
    return this.cache.wrap(cacheKey, method, cacheOptions)
  }

  async getMovieTorrents(imdbId) {
    if (!this.cache) {
      return this._getMovieTorrents(imdbId)
    }

    let cacheKey = `${CACHE_PREFIX}movie:${imdbId}`
    let cacheOptions = {
      ttl: (res) => {
        return res.length ? CACHE_TTLS.getMovieTorrents : CACHE_TTLS.NO_RESULTS
      },
    }
    let method = this._getMovieTorrents.bind(this, imdbId)
    return this.cache.wrap(cacheKey, method, cacheOptions)
  }

  async getShowTorrents(imdbId, season, episode) {
    if (!this.cache) {
      return this._getMovieTorrents(imdbId, season, episode)
    }

    let cacheKey = `${CACHE_PREFIX}show:${imdbId}:${season}:${episode}`
    let cacheOptions = {
      ttl: (res) => {
        return res.length ? CACHE_TTLS.getShowTorrents : CACHE_TTLS.NO_RESULTS
      },
    }
    let method = this._getShowTorrents.bind(this, imdbId, season, episode)
    return this.cache.wrap(cacheKey, method, cacheOptions)
  }
}


export default ZooqleClient
