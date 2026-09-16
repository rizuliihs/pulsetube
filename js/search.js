import { searchVideos, hasApiKey } from "./youtube.js";
import { apiEmpty, errorState, loadingRow, pageHeader, trackGrid, escapeAttr, escapeHtml } from "./render.js";
import { readStore, saveSearch } from "./storage.js";

let lastQuery = "";
let nextPageToken = "";
let currentItems = [];
let loading = false;

export function renderSearch(ctx, query = "") {
  lastQuery = query.trim();
  nextPageToken = "";
  currentItems = [];
  const history = readStore("history", []);
  ctx.view.innerHTML = `
    ${pageHeader("Search", "Find music videos, artists, moods, and genres directly from YouTube.")}
    <form class="search-page-form" id="searchForm">
      <input id="searchInput" type="search" value="${escapeAttr(lastQuery)}" placeholder="Try Arijit Singh, Punjabi songs, Tum Hi Ho" autofocus />
      <button class="primary-btn" type="submit">Search</button>
    </form>
    ${history.length ? `<div class="chips">${history.slice(0, 10).map((item) => `<button class="chip" data-search-chip="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join("")}</div>` : ""}
    <div id="searchStatus"></div>
    <div id="searchResults">${!hasApiKey() ? apiEmpty("Search is ready. Add a YouTube API key to fetch real videos.") : ""}</div>
    <div class="load-wrap"><button class="soft-btn" id="loadMore" hidden>Load more</button></div>
  `;

  ctx.view.querySelector("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = ctx.view.querySelector("#searchInput").value.trim();
    if (value) location.hash = `#/search?q=${encodeURIComponent(value)}`;
  });

  ctx.view.querySelectorAll("[data-search-chip]").forEach((chip) => {
    chip.addEventListener("click", () => {
      location.hash = `#/search?q=${encodeURIComponent(chip.dataset.searchChip)}`;
    });
  });

  ctx.view.querySelector("#loadMore").addEventListener("click", () => loadResults(ctx, true));

  if (lastQuery && hasApiKey()) loadResults(ctx, false);
}

async function loadResults(ctx, append) {
  if (loading || !lastQuery) return;
  loading = true;
  const resultEl = ctx.view.querySelector("#searchResults");
  const statusEl = ctx.view.querySelector("#searchStatus");
  const loadMore = ctx.view.querySelector("#loadMore");
  loadMore.hidden = true;
  if (!append) {
    resultEl.innerHTML = loadingRow(8);
    statusEl.innerHTML = "";
  }

  try {
    const response = await searchVideos(lastQuery, append ? nextPageToken : "", 12);
    saveSearch(lastQuery);
    nextPageToken = response.nextPageToken;
    currentItems = append ? [...currentItems, ...response.items] : response.items;
    ctx.registerTracks(currentItems);
    resultEl.innerHTML = trackGrid(currentItems, "No YouTube music results matched that search.");
    statusEl.innerHTML = `<p class="result-count">${currentItems.length} results for <strong>${escapeHtml(lastQuery)}</strong></p>`;
    loadMore.hidden = !nextPageToken;
  } catch (error) {
    resultEl.innerHTML = errorState(error);
  } finally {
    loading = false;
  }
}
