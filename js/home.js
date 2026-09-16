import { popularMusic, searchVideos, hasApiKey } from "./youtube.js";
import { HOME_SECTIONS, apiEmpty, errorState, loadingRow, pageHeader, trackGrid } from "./render.js";
import { getRecommendationQueries } from "./recommendations.js";

const loadedSections = new Map();

export function renderHome(ctx) {
  const sections = withRecommendations();
  ctx.view.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">YouTube powered</p>
        <h1>Discover and play music without uploading a single file.</h1>
        <p>Search, queue, and stream through the official YouTube IFrame Player API.</p>
        <div class="hero-actions">
          <a class="primary-btn" href="#/search">Search music</a>
          <a class="soft-btn" href="#/categories">Browse categories</a>
        </div>
      </div>
      <div class="hero-panel">
        <span>Trending</span>
        <strong>Live results from YouTube</strong>
        <p>Cached locally to reduce quota usage.</p>
      </div>
    </section>
    ${sections.map((section, index) => `
      <section class="rail" data-section-index="${index}">
        <div class="rail-head">
          <div>
            <p class="eyebrow">${section.mode === "popular" ? "YouTube chart" : "Search"}</p>
            <h2>${section.title}</h2>
          </div>
          <a href="#/search?q=${encodeURIComponent(section.query)}">See all</a>
        </div>
        <div class="rail-body">${loadingRow(6)}</div>
      </section>
    `).join("")}
  `;

  if (!hasApiKey()) {
    ctx.view.querySelectorAll(".rail-body").forEach((body) => {
      body.innerHTML = apiEmpty("Home sections are ready, but YouTube discovery is paused until a valid API key is configured.");
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const section = sections[Number(entry.target.dataset.sectionIndex)];
      loadSection(entry.target, section, ctx);
    });
  }, { rootMargin: "600px" });

  ctx.view.querySelectorAll(".rail").forEach((rail) => observer.observe(rail));
}

export function renderExplore(ctx) {
  ctx.view.innerHTML = `
    ${pageHeader("Explore", "Fresh category mixes and activity-based suggestions from YouTube.")}
    <div class="feature-grid">
      ${withRecommendations().slice(0, 9).map((section) => `
        <a class="feature-tile" href="#/search?q=${encodeURIComponent(section.query)}">
          <span>${section.title}</span>
          <strong>${section.query}</strong>
        </a>
      `).join("")}
    </div>
    <section class="rail" data-section-index="0">
      <div class="rail-head"><div><p class="eyebrow">Explore</p><h2>Popular right now</h2></div></div>
      <div class="rail-body">${hasApiKey() ? loadingRow(8) : apiEmpty("Add an API key to explore live YouTube music.")}</div>
    </section>
  `;
  const rail = ctx.view.querySelector(".rail");
  if (hasApiKey() && rail) loadSection(rail, { mode: "popular", query: "Trending music" }, ctx);
}

async function loadSection(sectionEl, section, ctx) {
  const body = sectionEl.querySelector(".rail-body");
  const cacheKey = `${section.mode || "search"}:${section.query}`;
  if (loadedSections.has(cacheKey)) {
    const items = loadedSections.get(cacheKey);
    ctx.registerTracks(items);
    body.innerHTML = trackGrid(items);
    return;
  }
  try {
    const response = section.mode === "popular"
      ? await popularMusic("", 10)
      : await searchVideos(section.query, "", 10);
    loadedSections.set(cacheKey, response.items);
    ctx.registerTracks(response.items);
    body.innerHTML = trackGrid(response.items, "No results in this section.");
  } catch (error) {
    body.innerHTML = errorState(error);
  }
}

function withRecommendations() {
  const recommended = getRecommendationQueries().map((query) => ({
    title: `More like ${query}`,
    query
  }));
  return [...HOME_SECTIONS.slice(0, -1), ...recommended.slice(0, 3), HOME_SECTIONS.at(-1)];
}
