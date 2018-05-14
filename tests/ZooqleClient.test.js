import { readFileSync } from 'fs'
import ZooqleClient from '../src/ZooqleClient'


const MOVIE_PAGE_AUTHORIZED = readFileSync(`${__dirname}/moviePageAuthorized.html`, 'utf8')
const MOVIE_PAGE_GUEST = readFileSync(`${__dirname}/moviePageGuest.html`, 'utf8')
const SHOW_RESPONSE = readFileSync(`${__dirname}/showResponse.html`, 'utf8')


describe('ZooqleClient', () => {
  let client

  beforeEach(() => {
    client = new ZooqleClient({ userName: 'foo', password: 'bar' })
  })

  describe('#_extractTorrentsFromPage()', () => {
    test('extracts torrents with magnet links from the sample authorized movie page', () => {
      let results = client._extractTorrentsFromPage(MOVIE_PAGE_AUTHORIZED)

      expect(results).toHaveLength(25)
      results.forEach((item) => {
        expect(item.category).toBeTruthy()
        expect(item.magnetLink).toBeTruthy()
        expect(item.seeders).toBeGreaterThanOrEqual(0)
        expect(item.languages).toBeInstanceOf(Array)
      })
    })

    test('extracts torrents without magnet links from the sample guest movie page', () => {
      let results = client._extractTorrentsFromPage(MOVIE_PAGE_GUEST)

      expect(results).toHaveLength(17)
      results.forEach((item) => {
        expect(item.category).toBeTruthy()
        expect(item.magnetLink).toBeFalsy()
        expect(item.seeders).toBeGreaterThanOrEqual(0)
        expect(item.languages).toBeInstanceOf(Array)
      })
    })

    test('extracts torrents with magnet links from the sample show response', () => {
      let results = client._extractTorrentsFromPage(SHOW_RESPONSE)

      expect(results).toHaveLength(2)
      results.forEach((item) => {
        expect(item.category).toBe('Std')
        expect(item.magnetLink).toBeTruthy()
        expect(item.seeders).toBeGreaterThanOrEqual(0)
        expect(item.audio).toBe('2.0')
        expect(item.languages).toEqual([])
      })
    })
  })
})
