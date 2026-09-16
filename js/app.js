import { renderCategories } from "./categories.js";
import { renderExplore, renderHome } from "./home.js";
import { renderFavorites, renderLibrary, renderLiked, renderRecent } from "./library.js";
import {
  addToQueue,
  getState,
  initPlayer,
  playTrack
} from "./player.js";
import { pageHeader, trackGrid } from "./render.js";
import { renderSearch } from "./search.js";
import {
  isInCollection,
  normalizeTrack,
  toggleCollectionItem
} from "./storage.js";
import { hasApiKey } from "./youtube.js";

const view = document.getElementById("view");
const trackRegistry = new Map();

const ctx = {
  view,
  registerTracks,
  getTrack,
  toast
};

initPlayer((state, event) => {
  if (event?.type === "playback-error" || event?.type === "playback-swap") {
    toast(event.message || "That song could not be played. Skipping.");
    if (event.videoId) dropDeadCard(event.videoId);
  }
  if (getRoute().name === "now-playing") renderNowPlaying();
});

bindChrome();
route();
window.addEventListener("hashchange", route);
window.addEventListener("store:update", (event) => {
  if (["favorites", "liked", "recent"].includes(event.detail.key)) {
    refreshCurrentRouteSoftly();
  }
});

function route() {
  const { name, params } = getRoute();
  setActiveNav(name);
  document.body.classList.remove("queue-open");
  view.scrollTo({ top: 0 });

  if (name === "home") renderHome(ctx);
  else if (name === "search") renderSearch(ctx, params.get("q") || "");
  else if (name === "explore") renderExplore(ctx);
  else if (name === "categories") renderCategories(ctx, params.get("name") || "Hindi");
  else if (name === "library") params.get("tab") === "liked" ? renderLiked(ctx) : renderLibrary(ctx);
  else if (name === "favorites") renderFavorites(ctx);
  else if (name === "recent") renderRecent(ctx);
  else if (name === "now-playing") renderNowPlaying();
  else location.hash = "#/home";

  updateApiBanner();
}

function getRoute() {
  const raw = location.hash.replace(/^#\/?/, "") || "home";
  const [path, query = ""] = raw.split("?");
  return {
    name: path || "home",
    params: new URLSearchParams(query)
  };
}

function bindChrome() {
  document.getElementById("topSearch")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("topSearchInput");
    const query = input.value.trim();
    if (query) {
      location.hash = `#/search?q=${encodeURIComponent(query)}`;
      input.value = "";
    }
  });

  document.getElementById("closeQueue")?.addEventListener("click", () => {
    document.body.classList.remove("queue-open");
  });

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeModals();
    const actionButton = event.target.closest("[data-action][data-video-id]");
    if (actionButton) handleTrackAction(actionButton);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModals();
      document.body.classList.remove("queue-open");
    }
  });

  updateApiBanner();
}

function handleTrackAction(button) {
  const track = getTrack(button.dataset.videoId);
  if (!track) return;
  const cards = Array.from(document.querySelectorAll(".music-card[data-video-id]"));
  const visibleTracks = cards.map((card) => getTrack(card.dataset.videoId)).filter(Boolean);

  if (button.dataset.action === "play") {
    playTrack(track, visibleTracks);
    toast("Playing from YouTube");
  }
  if (button.dataset.action === "queue") {
    addToQueue(track);
    toast("Added to queue");
    document.body.classList.add("queue-open");
  }
  if (button.dataset.action === "favorite") {
    const added = toggleCollectionItem("favorites", track);
    button.classList.toggle("active", added);
    toast(added ? "Added to favorites" : "Removed from favorites");
  }
  if (button.dataset.action === "like") {
    const added = toggleCollectionItem("liked", track);
    button.classList.toggle("active", added);
    toast(added ? "Liked song" : "Removed like");
  }
}

// A video that just failed should not stay on screen waiting to be clicked.
function dropDeadCard(videoId) {
  trackRegistry.delete(videoId);
  document.querySelectorAll(`.music-card[data-video-id="${CSS.escape(videoId)}"]`).forEach((card) => card.remove());
}

function renderNowPlaying() {
  const state = getState();
  const current = state.current;
  const queue = state.queue;
  view.innerHTML = `
    ${pageHeader("Now Playing", "Full player view with your current queue.")}
    ${current ? `
      <section class="now-page">
        <div class="now-art-large"><img src="${escapeHtml(current.thumbnail)}" alt="" /></div>
        <div class="now-details">
          <p class="eyebrow">Streaming through YouTube</p>
          <h2>${escapeHtml(current.title)}</h2>
          <p>${escapeHtml(current.channelTitle)} · ${escapeHtml(current.duration)}</p>
          <div class="hero-actions">
            <button class="primary-btn" data-player-action="toggle">Play / Pause</button>
            <button class="soft-btn" data-player-action="previous">Previous</button>
            <button class="soft-btn" data-player-action="next">Next</button>
          </div>
        </div>
      </section>
      <section class="rail">
        <div class="rail-head"><div><p class="eyebrow">Queue</p><h2>Coming up</h2></div></div>
        ${trackGrid(queue, "Queue is empty.")}
      </section>
    ` : `<div class="empty-state"><h3>No song playing</h3><p>Start playback from Home, Search, or Categories.</p><a class="primary-btn" href="#/home">Go home</a></div>`}
  `;
  registerTracks(queue);
}

function updateApiBanner() {
  const banner = document.getElementById("apiBanner");
  if (!banner) return;
  if (hasApiKey()) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `
    <strong>YouTube discovery is waiting for an API key.</strong>
    <span>Add your key in <code>js/config.js</code>, then refresh this page.</span>
  `;
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.hidden = true;
  });
}

function setActiveNav(name) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === name);
  });
}

function refreshCurrentRouteSoftly() {
  const { name } = getRoute();
  if (["library", "favorites", "recent", "now-playing"].includes(name)) route();
  document.querySelectorAll(".music-card[data-video-id]").forEach((card) => {
    const videoId = card.dataset.videoId;
    card.querySelector("[data-action='favorite']")?.classList.toggle("active", isInCollection("favorites", videoId));
    card.querySelector("[data-action='like']")?.classList.toggle("active", isInCollection("liked", videoId));
  });
}

function registerTracks(items = []) {
  items.map(normalizeTrack).forEach((item) => {
    if (item.videoId) trackRegistry.set(item.videoId, item);
  });
}

function getTrack(videoId) {
  return trackRegistry.get(videoId);
}

function toast(message) {
  const stack = document.getElementById("toastStack");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  stack.appendChild(item);
  window.setTimeout(() => item.classList.add("show"), 20);
  window.setTimeout(() => {
    item.classList.remove("show");
    window.setTimeout(() => item.remove(), 200);
  }, 2600);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}
