import { getCollection, readStore } from "./storage.js";
import { pageHeader, trackGrid, escapeHtml } from "./render.js";

export function renderLibrary(ctx) {
  const favorites = getCollection("favorites");
  const liked = getCollection("liked");
  const recent = getCollection("recent");
  const history = readStore("history", []);
  ctx.view.innerHTML = `
    ${pageHeader("Library", "Your saved music lives in localStorage on this device.")}
    <div class="stat-grid">
      <a href="#/favorites" class="stat-card"><span>Favorites</span><strong>${favorites.length}</strong></a>
      <a href="#/library?tab=liked" class="stat-card"><span>Liked songs</span><strong>${liked.length}</strong></a>
      <a href="#/recent" class="stat-card"><span>Recently played</span><strong>${recent.length}</strong></a>
    </div>
    <section class="rail">
      <div class="rail-head"><div><p class="eyebrow">Recently played</p><h2>Keep listening</h2></div></div>
      ${trackGrid(recent.slice(0, 12), "Play a song to build your history.")}
    </section>
    <section class="rail">
      <div class="rail-head"><div><p class="eyebrow">Search history</p><h2>Recent searches</h2></div></div>
      ${history.length ? `<div class="chips">${history.map((query) => `<a class="chip" href="#/search?q=${encodeURIComponent(query)}">${escapeHtml(query)}</a>`).join("")}</div>` : `<div class="empty-state">No searches yet.</div>`}
    </section>
  `;
}

export function renderFavorites(ctx) {
  ctx.view.innerHTML = `
    ${pageHeader("Favorites", "Songs you marked for quick access.")}
    ${trackGrid(getCollection("favorites"), "Favorite songs from any music card.")}
  `;
}

export function renderRecent(ctx) {
  ctx.view.innerHTML = `
    ${pageHeader("Recently Played", "A local listening history that remains after refresh.")}
    ${trackGrid(getCollection("recent"), "Your recently played songs will appear here.")}
  `;
}

export function renderLiked(ctx) {
  ctx.view.innerHTML = `
    ${pageHeader("Liked Songs", "A local list of tracks you liked.")}
    ${trackGrid(getCollection("liked"), "Like songs from any card to fill this page.")}
  `;
}
