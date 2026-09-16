# PulseTube Music

A static YouTube-powered music streaming web app built with HTML, CSS, and vanilla JavaScript.

## Features

- YouTube Data API v3 search and discovery
- Official YouTube IFrame Player API playback
- Home rails, Search, Explore, Categories, Library, Favorites, and Recently Played
- Persistent bottom player with play, pause, previous, next, seek, volume, mute, shuffle, repeat, full player, and queue
- Unplayable / embed-blocked videos are filtered out before they reach a card; anything that still fails is remembered, hidden from future results, and automatically replaced with another upload of the same song when one exists
- "<Artist> - Topic" Art Track uploads are hidden by default (`excludeTopicChannels` in `js/config.js`) because they are the ones YouTube most often blocks in external players
- localStorage favorites, liked songs, recently played, queue, search history, cached YouTube responses, and activity-based recommendations
- Fully static and ready for Netlify

## Configure YouTube

The key lives in code only. Edit `js/config.js`:

```js
export const YOUTUBE_API_KEY = "YOUR_API_KEY";
```

There is no in-app API key screen. The app uses legitimate YouTube Data API requests and the official IFrame Player API. It does not download videos, extract audio, scrape YouTube, or bypass YouTube restrictions.

## If a song still says the owner blocked it

Some labels whitelist specific domains for embedding. Those videos return error 150 no matter what the app does, and on `127.0.0.1` more of them fail than on a real host. Try `http://localhost:8787` instead of `127.0.0.1:8787`, and check again on the deployed Netlify URL before assuming a track is dead. The app now blocks and replaces those videos automatically either way.

## Run Locally

Because the project uses ES modules, serve it with any static server:

```bash
npx serve .
```

or:

```bash
python -m http.server 8787
```

## Deploy To Netlify

Drag this folder into Netlify or connect it as a static site. `netlify.toml` publishes the project root and redirects all routes to `index.html`.
