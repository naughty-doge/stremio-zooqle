import magnet from 'magnet-uri'
import parseTorrentName from 'torrent-name-parser'


const MIN_SEEDERS = 0
const STREAMS_PER_CATEGORY = 2


function makeDetailsString(prefix, ...args) {
  let string = args
    .filter((arg, i) => arg && args.indexOf(arg) === i)
    .join(' ')
  return string ? `${prefix} ${string}` : undefined
}

function isEligibleTorrent(torrent, torrentsByCategory) {
  let { category, seeders = 0, languages = [] } = torrent

  if (seeders < MIN_SEEDERS || (
    languages.length && !languages.includes('EN')
  )) {
    return false
  }

  torrentsByCategory[category] = torrentsByCategory[category] || 0
  torrentsByCategory[category]++
  return torrentsByCategory[category] <= STREAMS_PER_CATEGORY
}

function torrentToStream(torrent) {
  let { magnetLink, category, seeders, audio, languages = [] } = torrent
  let { infoHash, name } = magnet.decode(magnetLink)
  let { resolution, quality } = parseTorrentName(name)
  let videoDetails = makeDetailsString('📺', category, resolution, quality)
  let audioDetails = makeDetailsString('🔉', audio, ...languages)
  let seedersDetails = makeDetailsString('👤', seeders)
  let tag = resolution ? [resolution] : undefined
  let title = [videoDetails, audioDetails, seedersDetails]
    .filter((v) => v)
    .join(', ')
  let availability = 0

  if (seeders >= 50) {
    availability = 3
  } else if (seeders >= 20) {
    availability = 2
  } else if (seeders) {
    availability = 1
  }

  return { tag, availability, title, infoHash }
}

function convertTorrentsToStreams(torrents) {
  let torrentsByCategory = {}
  return torrents
    .filter((torrent) => isEligibleTorrent(torrent, torrentsByCategory))
    .map(torrentToStream)
}


export default convertTorrentsToStreams
