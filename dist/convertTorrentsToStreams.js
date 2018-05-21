"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _magnetUri = _interopRequireDefault(require("magnet-uri"));

var _torrentNameParser = _interopRequireDefault(require("torrent-name-parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MIN_SEEDERS = 0;
const STREAMS_PER_CATEGORY = 2;

function makeDetailsString(prefix, ...args) {
  let string = args.filter((arg, i) => arg && args.indexOf(arg) === i).join(' ');
  return string ? `${prefix} ${string}` : undefined;
}

function isEligibleTorrent(torrent, torrentsByCategory) {
  let {
    category,
    seeders = 0,
    languages = []
  } = torrent; // When languages are specified and there is no English, ignore the torrent

  if (seeders < MIN_SEEDERS || languages.length && !languages.includes('EN')) {
    return false;
  }

  torrentsByCategory[category] = torrentsByCategory[category] || 0;
  torrentsByCategory[category]++;
  return torrentsByCategory[category] <= STREAMS_PER_CATEGORY;
}

function torrentToStream(torrent) {
  let {
    magnetLink,
    category,
    seeders,
    audio,
    languages = []
  } = torrent;

  let {
    infoHash,
    name
  } = _magnetUri.default.decode(magnetLink);

  let {
    resolution,
    quality
  } = (0, _torrentNameParser.default)(name);
  let videoDetails = makeDetailsString('📺', category, resolution, quality);
  let audioDetails = makeDetailsString('🔉', audio, ...languages);
  let seedersDetails = makeDetailsString('👤', seeders);
  let tag = resolution ? [resolution] : undefined;
  let title = [videoDetails, audioDetails, seedersDetails].filter(v => v).join(', '); // The Stremio app seems to replace commas with line breaks

  let availability = 0;

  if (seeders >= 50) {
    availability = 3;
  } else if (seeders >= 20) {
    availability = 2;
  } else if (seeders) {
    availability = 1;
  }

  return {
    tag,
    availability,
    title,
    infoHash
  };
}

function convertTorrentsToStreams(torrents) {
  let torrentsByCategory = {};
  return torrents.filter(torrent => isEligibleTorrent(torrent, torrentsByCategory)).map(torrentToStream);
}

var _default = convertTorrentsToStreams;
exports.default = _default;
//# sourceMappingURL=convertTorrentsToStreams.js.map