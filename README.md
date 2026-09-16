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
