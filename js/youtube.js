import { APP_CONFIG, YOUTUBE_API_KEY } from "./config.js";
import { isBlocked, readCache, writeCache } from "./storage.js";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  constructor(message, reason = "unknown") {
    super(message);
    this.name = "YouTubeApiError";
    this.reason = reason;
  }
}

export function getApiKey() {
  const configured = YOUTUBE_API_KEY && YOUTUBE_API_KEY !== "YOUR_API_KEY" ? YOUTUBE_API_KEY : "";
  return configured.trim();
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

async function apiRequest(path, params, cacheKey) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new YouTubeApiError("Add a YouTube Data API key in js/config.js to load music.", "missing-key");
  }

  if (cacheKey) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const url = new URL(`${API_ROOT}/${path}`);
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new YouTubeApiError("Network error while contacting YouTube.", "network");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.status || "api-error";
    const message = reason === "quotaExceeded"
      ? "YouTube API quota is exhausted for this key."
      : payload?.error?.message || "YouTube API request failed.";
    throw new YouTubeApiError(message, reason);
  }

  if (cacheKey) writeCache(cacheKey, payload, APP_CONFIG.cacheTtlMs);
  return payload;
}

export async function searchVideos(query, pageToken = "", maxResults = APP_CONFIG.maxResults) {
  const q = query.toLowerCase().includes("music") ? query : `${query} music`;
  const searchKey = `v2:search:${q}:${pageToken}:${maxResults}`;
  const searchPayload = await apiRequest("search", {
    part: "snippet",
    q,
    type: "video",
    maxResults,
    pageToken,
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "none",
    regionCode: APP_CONFIG.regionCode
  }, searchKey);

  const ids = (searchPayload.items || []).map((item) => item.id?.videoId).filter(Boolean);
  const details = ids.length ? await getVideoDetails(ids) : new Map();

  const items = (searchPayload.items || [])
    .map((item) => {
      const detail = details.get(item.id?.videoId);
      if (!detail || !isPlayable(detail, item.snippet)) return null;
      if (isBlocked(item.id.videoId)) return null;
      return mapVideo({
        id: item.id.videoId,
        snippet: item.snippet,
        contentDetails: detail.contentDetails,
        statistics: detail.statistics,
        query
      });
    })
    .filter(Boolean);

  return {
    items,
    nextPageToken: searchPayload.nextPageToken || "",
    totalResults: searchPayload.pageInfo?.totalResults || 0
  };
}

export async function popularMusic(pageToken = "", maxResults = APP_CONFIG.maxResults) {
  const cacheKey = `v2:popular:${APP_CONFIG.regionCode}:${pageToken}:${maxResults}`;
  const payload = await apiRequest("videos", {
    part: "snippet,contentDetails,statistics,status",
    chart: "mostPopular",
    videoCategoryId: "10",
    regionCode: APP_CONFIG.regionCode,
    maxResults,
    pageToken
  }, cacheKey);

  return {
    items: (payload.items || [])
      .filter((item) => isPlayable(item, item.snippet) && !isBlocked(item.id))
      .map((item) => mapVideo({
        id: item.id,
        snippet: item.snippet,
        contentDetails: item.contentDetails,
        statistics: item.statistics,
        query: "Trending music"
      })),
    nextPageToken: payload.nextPageToken || "",
    totalResults: payload.pageInfo?.totalResults || 0
  };
}

async function getVideoDetails(ids) {
  const cacheKey = `v2:details:${ids.join(",")}`;
  const payload = await apiRequest("videos", {
    part: "contentDetails,statistics,status",
    id: ids.join(",")
  }, cacheKey);
  return new Map((payload.items || []).map((item) => [item.id, item]));
}

// Only keep videos YouTube says can actually be embedded and played outside
// youtube.com. This is what removes the cards that used to sit there silent.
function isPlayable(detail, snippet) {
  const status = detail?.status || {};
  if (status.embeddable === false) return false;
  if (status.privacyStatus && status.privacyStatus !== "public") return false;
  if (status.uploadStatus && status.uploadStatus !== "processed") return false;

  const restriction = detail?.contentDetails?.regionRestriction;
  if (restriction?.blocked?.includes(APP_CONFIG.regionCode)) return false;
  if (restriction?.allowed && !restriction.allowed.includes(APP_CONFIG.regionCode)) return false;

  const live = snippet?.liveBroadcastContent;
  if (live && live !== "none") return false;

  if (APP_CONFIG.excludeTopicChannels && / - Topic$/i.test(snippet?.channelTitle || "")) return false;

  return parseIsoDuration(detail?.contentDetails?.duration || "PT0S") > 0;
}

function mapVideo({ id, snippet, contentDetails, statistics, query }) {
  const durationSeconds = parseIsoDuration(contentDetails?.duration || "PT0S");
  return {
    videoId: id,
    title: decodeHtml(snippet?.title || "Untitled video"),
    channelTitle: decodeHtml(snippet?.channelTitle || "YouTube"),
    thumbnail: snippet?.thumbnails?.maxres?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || "",
    duration: formatTime(durationSeconds),
    durationSeconds,
    publishedAt: snippet?.publishedAt || "",
    viewCount: statistics?.viewCount || "",
    query
  };
}

export function parseIsoDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h = 0, m = 0, s = 0] = match.map((part) => Number(part || 0));
  return h * 3600 + m * 60 + s;
}

export function formatTime(seconds = 0) {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
