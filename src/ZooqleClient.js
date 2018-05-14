import needle from 'needle'
import cheerio from 'cheerio'


const BASE_URL = 'https://zooqle.com'


class ZooqleClient {
  constructor({ userName, password, userAgent } = {}) {
    if (!userName || !password) {
      throw new Error('Username and password are required')
    }

    this.userName = userName
    this.password = password
    this.userAgent = userAgent
  }

  _extractTorrentsFromPage(body) {
    let $ = cheerio.load(body)
    let category

    return $('.table-torrents tr').toArray().reduce((results, row, i) => {
      let $cells = $(row).find('td')

      if (i === 0 || $cells.length === 1) {
        let newCategory = $cells.eq(0).find('a ~ span').prev().text().trim()
        category = newCategory || category
      } else {
        let magnetLink = $cells.find('a[href^="magnet"]').attr('href')

        let $audioSpans = $cells.eq(1).find('div > span')
        let audio = $audioSpans.eq(0).text()
        let languages = $audioSpans.eq(1).text().toUpperCase()
        languages = languages ? languages.split(',') : undefined

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
    let options = {
      headers: {
        'user-agent': this.userAgent,
        ...headers,
      },
      cookies: this._cookies,
    }
    let res = await needle(method, url, data, options)

    if (res.statusCode > 399) {
      let err = new Error(`Error ${res.statusCode} when requesting ${url}`)
      err.res = res
      throw err
    }

    if (res.cookies) {
      this._cookies = { ...this.cookies, ...res.cookies }
    }

    return res
  }

  async _authenticate() {
    let url = `${BASE_URL}/user/register?ajax=1`
    let data = {
      action: 'login',
      remember: 1,
      user: this.userName,
      password: this.password,
    }
    let headers = {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    }

    let res = await this._request(url, 'post', headers, data)

    if (!res.cookies || !res.cookies.zqt) {
      let err = new Error('Unable to authenticate')
      err.res = res
      throw err
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

  async getMovieTorrents(imdbId) {
    if (!this._cookies) {
      await this._authenticate()
    }

    let url = await this._getItemUrl(imdbId)

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

  async getShowTorrents(imdbId, season, episode) {
    let itemUrl = await this._getItemUrl(imdbId)

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
}


export default ZooqleClient
