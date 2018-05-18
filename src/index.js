import http from 'http'
import Stremio from 'stremio-addons'
import serveStatic from 'serve-static'
import chalk from 'chalk'
import pkg from '../package.json'
import ZooqleClient from './ZooqleClient'
import convertTorrentsToStreams from './convertTorrentsToStreams'


const STATIC_DIR = 'static'
const USER_AGENT = 'stremio-zooqle'
const DEFAULT_ID = 'stremio_zooqle'
const ID_PROPERTY = 'imdb_id'


const ID = process.env.STREMIO_ZOOQLE_ID || DEFAULT_ID
const ENDPOINT = process.env.STREMIO_ZOOQLE_ENDPOINT || 'http://localhost'
const PORT = process.env.STREMIO_ZOOQLE_PORT || '80'
const PROXY = process.env.STREMIO_ZOOQLE_PROXY
const CACHE = process.env.STREMIO_ZOOQLE_CACHE || '1'
const EMAIL = process.env.STREMIO_ZOOQLE_EMAIL
const USERNAME = process.env.STREMIO_ZOOQLE_USERNAME
const PASSWORD = process.env.STREMIO_ZOOQLE_PASSWORD
const IS_PROD = process.env.NODE_ENV === 'production'


if (!USERNAME || !PASSWORD) {
  // eslint-disable-next-line no-console
  console.error(
    chalk.red(
      '\nZooqle username and password must be specified\n'
    )
  )
  process.exit(1)
}

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
  description: 'Watch movies and series indexed by Zooqle from various torrent trackers',
  types: ['movie', 'series'],
  idProperty: ID_PROPERTY,
  dontAnnounce: !IS_PROD,
  // The docs mention `contactEmail`, but the template uses `email`
  email: EMAIL,
  contactEmail: EMAIL,
  endpoint: ENDPOINT,
  logo: `${ENDPOINT}/logo-white.png`,
  icon: `${ENDPOINT}/logo-white.png`,
  background: `${ENDPOINT}/bg.jpg`,
  // OBSOLETE: used in pre-4.0 stremio instead of idProperty/types
  filter: {
    [`query.${ID_PROPERTY}`]: { $exists: true },
    'query.type': { $in: ['movie', 'series'] },
  },
}


async function findStreams(client, req) {
  let imdbId = req.query && req.query.imdb_id

  if (!imdbId) {
    return
  }

  let { type, season, episode } = req.query
  let torrents

  if (type === 'movie') {
    torrents = await client.getMovieTorrents(imdbId)
  } else {
    torrents = await client.getShowTorrents(imdbId, season, episode)
  }

  return convertTorrentsToStreams(torrents)
}


let client = new ZooqleClient({
  userName: USERNAME,
  password: PASSWORD,
  userAgent: USER_AGENT,
  proxy: PROXY,
  cache: CACHE,
})
let methods = {
  'stream.find': (req, cb) => {
    findStreams(client, req).then(
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
      proxy: PROXY ? chalk.green(PROXY) : chalk.red('off'),
      cache: (CACHE === '0') ?
        chalk.red('off') :
        chalk.green(CACHE === '1' ? 'on' : CACHE),
      userName: chalk.green(USERNAME),
    }

    // eslint-disable-next-line no-console
    console.log(`
    ${MANIFEST.name} Addon is live

    Endpoint:    ${values.endpoint}
    Addon Id:    ${values.id}
    Email:       ${values.email}
    Environment: ${values.env}
    Cache:       ${values.cache}
    Proxy:       ${values.proxy}
    Username:    ${values.userName}
    `)
  })
  .listen(PORT)


export default server
