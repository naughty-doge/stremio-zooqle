'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true,
})
exports.default = void 0

let _http = _interopRequireDefault(require('http'))

let _stremioAddons = _interopRequireDefault(require('stremio-addons'))

let _serveStatic = _interopRequireDefault(require('serve-static'))

let _chalk = _interopRequireDefault(require('chalk'))

let _package = _interopRequireDefault(require('../package.json'))

let _ZooqleClient = _interopRequireDefault(require('./ZooqleClient'))

let _convertTorrentsToStreams = _interopRequireDefault(require('./convertTorrentsToStreams'))


function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj }
}

function _asyncToGenerator(fn) {
  return function() {
    let self = this,
      args = arguments; return new Promise(((resolve, reject) => {
      let gen = fn.apply(self, args); function step(key, arg) {
        try {
          var info = gen[key](arg); var value = info.value
        } catch (error) {
          reject(error); return
        } if (info.done) {
          resolve(value)
        } else {
          Promise.resolve(value).then(_next, _throw)
        }
      } function _next(value) {
        step('next', value)
      } function _throw(err) {
        step('throw', err)
      } _next()
    }))
  }
}

const STATIC_DIR = 'static'
const USER_AGENT = 'stremio-zooqle'
const DEFAULT_ID = 'stremio_zooqle'
const ID_PROPERTY = 'imdb_id'
const ID = process.env.STREMIO_ZOOQLE_ID || DEFAULT_ID
const ENDPOINT = process.env.STREMIO_ZOOQLE_ENDPOINT || 'http://localhost'
const PORT = process.env.STREMIO_ZOOQLE_PORT || process.env.PORT || '80'
const PROXY = process.env.STREMIO_ZOOQLE_PROXY || process.env.HTTPS_PROXY
const CACHE = process.env.STREMIO_ZOOQLE_CACHE || process.env.REDIS_URL || '1'
const EMAIL = process.env.STREMIO_ZOOQLE_EMAIL || process.env.EMAIL
const USERNAME = process.env.STREMIO_ZOOQLE_USERNAME
const PASSWORD = process.env.STREMIO_ZOOQLE_PASSWORD
const IS_PROD = process.env.NODE_ENV === 'production'

if (!USERNAME || !PASSWORD) {
  // eslint-disable-next-line no-console
  console.error(_chalk.default.red('\nZooqle username and password must be specified\n'))
  process.exit(1)
}

if (IS_PROD && ID === DEFAULT_ID) {
  // eslint-disable-next-line no-console
  console.error(_chalk.default.red('\nWhen running in production, a non-default addon identifier must be specified\n'))
  process.exit(1)
}

const MANIFEST = {
  name: 'Zooqle',
  id: ID,
  version: _package.default.version,
  description: 'Watch movies and series indexed by Zooqle from various torrent trackers',
  types: ['movie', 'series'],
  idProperty: ID_PROPERTY,
  dontAnnounce: !IS_PROD,
  // The docs mention `contactEmail`, but the template uses `email`
  email: EMAIL,
  contactEmail: EMAIL,
  endpoint: `${ENDPOINT}/stremioget/stremio/v1`,
  logo: `${ENDPOINT}/logo-white.png`,
  icon: `${ENDPOINT}/logo-white.png`,
  background: `${ENDPOINT}/bg.jpg`,
  // OBSOLETE: used in pre-4.0 stremio instead of idProperty/types
  filter: {
    [`query.${ID_PROPERTY}`]: {
      $exists: true,
    },
    'query.type': {
      $in: ['movie', 'series'],
    },
  },
}

function findStreams(_x, _x2) {
  return _findStreams.apply(this, arguments)
}

function _findStreams() {
  _findStreams = _asyncToGenerator(function* (client, req) {
    let imdbId = req.query && req.query.imdb_id

    if (!imdbId) {
      return
    }

    let {
      type,
      season,
      episode,
    } = req.query
    let torrents

    if (type === 'movie') {
      torrents = yield client.getMovieTorrents(imdbId)
    } else {
      torrents = yield client.getShowTorrents(imdbId, season, episode)
    }

    return (0, _convertTorrentsToStreams.default)(torrents)
  })
  return _findStreams.apply(this, arguments)
}

let client = new _ZooqleClient.default({
  userName: USERNAME,
  password: PASSWORD,
  userAgent: USER_AGENT,
  proxy: PROXY,
  cache: CACHE,
})
let methods = {
  'stream.find': (req, cb) => {
    findStreams(client, req).then((res) => cb(null, res), (err) => {
      /* eslint-disable no-console */
      console.error('An error has occurred while processing the following request:')
      console.error(req)
      console.error(err)
      /* eslint-enable no-console */

      cb(err)
    })
  },
}
let addon = new _stremioAddons.default.Server(methods, MANIFEST)

let server = _http.default.createServer((req, res) => {
  (0, _serveStatic.default)(STATIC_DIR)(req, res, () => {
    addon.middleware(req, res, () => res.end())
  })
})

server.on('listening', () => {
  let values = {
    endpoint: _chalk.default.green(MANIFEST.endpoint),
    id: ID === DEFAULT_ID ? _chalk.default.red(ID) : _chalk.default.green(ID),
    email: EMAIL ? _chalk.default.green(EMAIL) : _chalk.default.red('undefined'),
    env: IS_PROD ? _chalk.default.green('production') : _chalk.default.green('development'),
    proxy: PROXY ? _chalk.default.green(PROXY) : _chalk.default.red('off'),
    cache: CACHE === '0' ? _chalk.default.red('off') : _chalk.default.green(CACHE === '1' ? 'on' : CACHE),
    userName: _chalk.default.green(USERNAME), // eslint-disable-next-line no-console

  }
  console.log(`
    ${MANIFEST.name} Addon is listening on port ${PORT}

    Endpoint:    ${values.endpoint}
    Addon Id:    ${values.id}
    Email:       ${values.email}
    Environment: ${values.env}
    Cache:       ${values.cache}
    Proxy:       ${values.proxy}
    Username:    ${values.userName}
    `)
}).listen(PORT)
let _default = server
exports.default = _default
// # sourceMappingURL=index.js.map
