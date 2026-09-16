const PREFIX = "pulsetube.v1.";

const DEFAULTS = {
  favorites: [],
  liked: [],
  recent: [],
  queue: [],
  blocked: [],
  history: [],
  activity: {},
  settings: {
    volume: 80,
    muted: false,
    repeat: "off",
    shuffle: false
  },
  cache: {}
};

export function readStore(key, fallback = undefined) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback ?? structuredClone(DEFAULTS[key]);
    return JSON.parse(raw);
  } catch {
    return fallback ?? structuredClone(DEFAULTS[key]);
  }
}

export function writeStore(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("store:update", { detail: { key } }));
  return value;
}

export function getSettings() {
  return { ...DEFAULTS.settings, ...readStore("settings", DEFAULTS.settings) };
}

export function saveSettings(patch) {
  return writeStore("settings", { ...getSettings(), ...patch });
}

export function getCollection(name) {
  return readStore(name, []);
}

export function isInCollection(name, videoId) {
  return getCollection(name).some((item) => item.videoId === videoId);
}

export function toggleCollectionItem(name, item) {
  const collection = getCollection(name);
  const exists = collection.some((entry) => entry.videoId === item.videoId);
  const next = exists
    ? collection.filter((entry) => entry.videoId !== item.videoId)
    : [normalizeTrack(item), ...collection].slice(0, 300);
  writeStore(name, next);
  return !exists;
}

export function addRecent(item) {
  const track = normalizeTrack(item);
  const recent = [track, ...getCollection("recent").filter((entry) => entry.videoId !== track.videoId)].slice(0, 80);
  writeStore("recent", recent);
}

// Video ids YouTube refused to play in an embed. Remembered across reloads so
// the same dead tracks never show up in results again.
let blockedCache = null;

export function getBlockedIds() {
  if (!blockedCache) blockedCache = new Set(readStore("blocked", []));
  return blockedCache;
}

export function isBlocked(videoId) {
  return getBlockedIds().has(videoId);
}

export function blockVideo(videoId) {
  if (!videoId) return;
  const set = getBlockedIds();
  if (set.has(videoId)) return;
  set.add(videoId);
  const list = [...set].slice(-800);
  blockedCache = new Set(list);
  writeStore("blocked", list);
}

export function clearBlocked() {
  blockedCache = new Set();
  writeStore("blocked", []);
}

export function saveSearch(query) {
  const clean = query.trim();
  if (!clean) return;
  const history = [clean, ...readStore("history", []).filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 30);
  writeStore("history", history);
  bumpActivity(clean, 2);
}

export function bumpActivity(label, weight = 1) {
  const clean = label.trim();
  if (!clean) return;
  const activity = readStore("activity", {});
  activity[clean] = (activity[clean] || 0) + weight;
  writeStore("activity", activity);
}

export function getTopActivity(limit = 8) {
  const activity = readStore("activity", {});
  return Object.entries(activity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

export function readCache(cacheKey) {
  const cache = readStore("cache", {});
  const hit = cache[cacheKey];
  if (!hit || Date.now() > hit.expiresAt) return null;
  return hit.value;
}

export function writeCache(cacheKey, value, ttlMs) {
  const cache = readStore("cache", {});
  cache[cacheKey] = { value, expiresAt: Date.now() + ttlMs };
  const entries = Object.entries(cache)
    .filter(([, hit]) => hit.expiresAt > Date.now())
    .slice(-120);
  writeStore("cache", Object.fromEntries(entries));
  return value;
}

export function normalizeTrack(item) {
  return {
    videoId: item.videoId,
    title: item.title || "Untitled video",
    channelTitle: item.channelTitle || "YouTube",
    thumbnail: item.thumbnail || "",
    duration: item.duration || "0:00",
    durationSeconds: Number(item.durationSeconds || 0),
    query: item.query || "",
    publishedAt: item.publishedAt || "",
    viewCount: item.viewCount || ""
  };
}
