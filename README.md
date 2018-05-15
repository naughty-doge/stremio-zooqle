<div align="center">
  <br><br><br>
  <img src="/static/logo.png">
  <br><br><br>
</div>
<h1 align="center" style="border: 0">Zooqle Addon for Stremio</h1>

This is a [Stremio](https://www.stremio.com/) addon that provides movies and series indexed by [Zooqle](https://zooqle.com/) from various torrent trackers.


## Features

- Works in Stremio v4 and v3.6
- Supports Docker out of the box
- Caches results in memory or Redis
- Supports HTTPS proxy
- Configurable via environment variables


## Running

The addon is a web server that fetches torrent files from Zooqle, which indexes them from various trackers. It uses environment variables for configuration and includes a handful of npm scripts to run with or without Docker.

It requires a Zooqle account to scrape magnet links from movie pages. Before starting the addon, set the `STREMIO_ZOOQLE_USERNAME` and `STREMIO_ZOOQLE_PASSWORD` environment variables to the corresponding values of a Zooqle account.

To install and quickly start the addon, do:

```
git clone https://github.com/naughty-doge/stremio-zooqle
cd stremio-zooqle
npm install
npm start
```

By default the server starts on `localhost:80` in development mode and doesn't announce itself to the Stremio addon tracker. To add the addon to Stremio app, open its endpoint in the browser and click the Install button, or enter the URL in the app's Addons section.

In order for the addon to work publicly, the following environment variables must be set in addition to the account variables:
- `NODE_ENV` to `production`
- `STREMIO_ZOOQLE_ENDPOINT` to a public URL of the addon
- `STREMIO_ZOOQLE_ID` to a non-default value


## npm scripts

Each of these scripts can be used with `npm run <script>` or `yarn <script>`:

- `start` launches the addon
- `prod` sets `NODE_ENV` to `production` and launches the addon
- `dev` sets `NODE_ENV` to `development` and launches the addon with node inspector activated
- `build` builds the addon in the `dist` dir

* `docker-build` builds the Docker image
* `docker-start` launches the addon in a `stremio-zooqle` Docker container
* `docker-dev` sets `NODE_ENV` to `development` and launches the addon in a `stremio-zooqle` Docker container
* `docker-prod` sets `NODE_ENV` to `production` and launches the addon in a `stremio-zooqle` Docker container
* `docker-stop` stops the Docker container


## Configuration

To configure the addon, set the following environment variables before running it:

- `NODE_ENV` — when set to `production`, the addon will announce its endpoint to the Stremio addon tracker
- `STREMIO_ZOOQLE_USERNAME` — Zooqle username, required (unset by default)
- `STREMIO_ZOOQLE_PASSWORD` — Zooqle password, required (unset by default)
- `STREMIO_ZOOQLE_ID` — addon identifier, must be non-default in production mode (defaults to `stremio_zooqle`)
- `STREMIO_ZOOQLE_ENDPOINT` — URL to use as the endpoint, must be public in production mode (defaults to `http://localhost`)
- `STREMIO_ZOOQLE_PORT` — port to listen to (defaults to `80`)
- `STREMIO_ZOOQLE_EMAIL` — email address that can be used to contact you (unset by default)
- `STREMIO_ZOOQLE_PROXY` — HTTPS proxy address to route all the outbound requests to (unset by default)
- `STREMIO_ZOOQLE_CACHE` — 0 to turn caching off, 1 to cache in memory, or a Redis URL (e.g. `redis://example.com:6379`) to cache in Redis (defaults to 1)


## Screenshots

![Discover](/static/screenshot_movie.jpg)
