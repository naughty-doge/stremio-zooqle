import http from 'http'
import Stremio from 'stremio-addons'
import serveStatic from 'serve-static'
import chalk from 'chalk'
import magnet from 'magnet-uri'
import parseTorrentName from 'torrent-name-parser'
import pkg from '../package.json'
import ZooqleClient from './ZooqleClient'


const STATIC_DIR = 'static'
const USER_AGENT = 'stremio-zooqle'
const DEFAULT_ID = 'stremio_zooqle'
const ID_PROPERTY = 'imdb_id'
const MIN_SEEDERS = 7
const STREAMS_PER_CATEGORY = 2

const ID = process.env.STREMIO_ZOOQLE_ID || DEFAULT_ID
const ENDPOINT = process.env.STREMIO_ZOOQLE_ENDPOINT || 'http://localhost'
const PORT = process.env.STREMIO_ZOOQLE_PORT || '80'
const EMAIL = process.env.STREMIO_ZOOQLE_EMAIL
const USERNAME = process.env.STREMIO_ZOOQLE_USERNAME
const PASSWORD = process.env.STREMIO_ZOOQLE_PASSWORD
const IS_PROD = process.env.NODE_ENV === 'production'


if (IS_PROD && ID === DEFAULT_ID) {
  // eslint-disable-next-line no-console
  console.error(
    chalk.red(
      '\nWhen running in production, a non-default addon identifier must be specified\n'
    )
  )
  process.exit(1)
}


const MANIFEST = {
  name: 'Zooqle',
  id: ID,
  version: pkg.version,
  description: '',
  types: ['movie', 'series'],
  idProperty: ID_PROPERTY,
  dontAnnounce: !IS_PROD,
  email: EMAIL,
  contactEmail: EMAIL,
  endpoint: ENDPOINT,
  logo: `${ENDPOINT}/logo.png`,
  icon: `${ENDPOINT}/logo.png`,
  background: `${ENDPOINT}/bg.jpg`,
}


let client = new ZooqleClient({
  userName: USERNAME,
  password: PASSWORD,
  userAgent: USER_AGENT,
})


async function findStreams(req) {
  let imdbId = req.query && req.query.imdb_id

  if (!imdbId) {
    return
  }

  let torrents = await client.getTorrents(imdbId)
  let streamsByCategory = {}

  return torrents
    .filter(({ category, seeders }) => {
      if (seeders < MIN_SEEDERS) {
        return false
      }

      streamsByCategory[category] = streamsByCategory[category] || 0
      streamsByCategory[category]++
      return streamsByCategory[category] <= STREAMS_PER_CATEGORY
    })
    .map(({ magnetLink, category }) => {
      let { infoHash, name } = magnet.decode(magnetLink)
      let { resolution, quality, group } = parseTorrentName(name)
      let prefix

      if (category === '3D') {
        prefix = '3D'
      } else if (!resolution) {
        resolution = category
      }

      let title = [prefix, resolution, quality, group]
        .filter((val) => val)
        .join(' - ')

      return {
        name: 'Zooqle',
        isFree: true,
        availability: 2,
        tag: [resolution],
        title,
        infoHash,
      }
    })
}


let methods = {
  'stream.find': (req, cb) => {
    findStreams(req).then(
      (res) => cb(null, res),
      (err) => {
        /* eslint-disable no-console */
        console.error(
          'An error has occurred while processing the following request:'
        )
        console.error(req)
        console.error(err)
        /* eslint-enable no-console */
        cb(err)
      }
    )
  },
}
let addon = new Stremio.Server(methods, MANIFEST)
let server = http.createServer((req, res) => {
  serveStatic(STATIC_DIR)(req, res, () => {
    addon.middleware(req, res, () => res.end())
  })
})

server
  .on('listening', () => {
    let values = {
      endpoint: chalk.green(ENDPOINT),
      id: ID === DEFAULT_ID ? chalk.red(ID) : chalk.green(ID),
      email: EMAIL ? chalk.green(EMAIL) : chalk.red('undefined'),
      env: IS_PROD ? chalk.green('production') : chalk.green('development'),
    }

    // eslint-disable-next-line no-console
    console.log(`
    Zooqle Addon is live

    Endpoint:    ${values.endpoint}
    Addon Id:    ${values.id}
    Email:       ${values.email}
    Environment: ${values.env}
    `)
  })
  .listen(PORT)


export default server
