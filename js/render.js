import { isInCollection } from "./storage.js";

export const CATEGORIES = [
  "Hindi", "Punjabi", "Haryanvi", "Bollywood", "English", "Tamil", "Telugu", "Bengali",
  "Instrumental", "Lo-fi", "Romantic", "Party", "Workout", "Sad", "Chill"
];

export const HOME_SECTIONS = [
  { title: "Trending music", query: "Trending music", mode: "popular" },
  { title: "New music", query: "latest new music videos" },
  { title: "Popular songs", query: "popular songs" },
  { title: "Hindi music", query: "Hindi songs" },
  { title: "Punjabi music", query: "Punjabi songs" },
  { title: "Haryanvi music", query: "Haryanvi songs" },
  { title: "Bollywood music", query: "Bollywood songs" },
  { title: "English music", query: "English songs" },
  { title: "Romantic songs", query: "romantic songs" },
  { title: "Party songs", query: "party songs" },
  { title: "Sad songs", query: "sad songs" },
  { title: "Chill music", query: "chill music" },
  { title: "Latest music videos", query: "latest music videos" },
  { title: "Recommended music", query: "recommended music" }
];

export function pageHeader(title, subtitle = "", actions = "") {
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">PulseTube</p>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="head-actions">${actions}</div>` : ""}
    </div>
  `;
}

export function trackCard(item) {
  const fav = isInCollection("favorites", item.videoId);
  const liked = isInCollection("liked", item.videoId);
  return `
    <article class="music-card" data-video-id="${escapeAttr(item.videoId)}">
      <div class="card-art">
        <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" />
        <button class="play-fab" data-action="play" data-video-id="${escapeAttr(item.videoId)}" aria-label="Play ${escapeAttr(item.title)}">▶</button>
        <span class="duration">${escapeHtml(item.duration || "0:00")}</span>
      </div>
      <div class="card-copy">
        <h3 title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</h3>
        <p title="${escapeAttr(item.channelTitle)}">${escapeHtml(item.channelTitle)}</p>
      </div>
      <div class="card-actions">
        <button class="mini-btn ${fav ? "active" : ""}" data-action="favorite" data-video-id="${escapeAttr(item.videoId)}" aria-label="Toggle favorite">♡</button>
        <button class="mini-btn ${liked ? "active" : ""}" data-action="like" data-video-id="${escapeAttr(item.videoId)}" aria-label="Toggle like">♥</button>
        <button class="mini-btn" data-action="queue" data-video-id="${escapeAttr(item.videoId)}" aria-label="Add to queue">＋</button>
      </div>
    </article>
  `;
}

export function trackGrid(items, empty = "No music found.") {
  if (!items?.length) return `<div class="empty-state">${escapeHtml(empty)}</div>`;
  return `<div class="track-grid">${items.map(trackCard).join("")}</div>`;
}

export function loadingRow(count = 6) {
  return `<div class="track-grid">${Array.from({ length: count }, () => `
    <div class="music-card skeleton-card">
      <div class="card-art skeleton"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line short"></div>
    </div>
  `).join("")}</div>`;
}

export function apiEmpty(message) {
  return `
    <div class="empty-state api-empty">
      <h3>Live music needs your YouTube API key</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

export function errorState(error) {
  const detail = error?.reason === "quotaExceeded"
    ? "This API key has reached its YouTube quota. Try another key or wait for quota reset."
    : error?.message || "Something went wrong while loading YouTube results.";
  return `<div class="empty-state error-state"><h3>Could not load music</h3><p>${escapeHtml(detail)}</p></div>`;
}

export function formatViews(count) {
  const value = Number(count || 0);
  if (!value) return "";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
