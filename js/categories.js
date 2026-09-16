import { searchVideos, hasApiKey } from "./youtube.js";
import { CATEGORIES, apiEmpty, errorState, loadingRow, pageHeader, trackGrid, escapeAttr, escapeHtml } from "./render.js";
import { bumpActivity } from "./storage.js";

const CATEGORY_QUERIES = {
  Hindi: "Hindi songs latest",
  Punjabi: "Punjabi songs latest",
  Haryanvi: "Haryanvi songs latest",
  Bollywood: "Bollywood songs",
  English: "English pop songs",
  Tamil: "Tamil songs latest",
  Telugu: "Telugu songs latest",
  Bengali: "Bengali songs latest",
  Instrumental: "instrumental music",
  "Lo-fi": "lofi songs",
  Romantic: "romantic songs",
  Party: "party songs",
  Workout: "workout music",
  Sad: "sad songs",
  Chill: "chill music"
};

export function renderCategories(ctx, selected = "Hindi") {
  const category = CATEGORIES.includes(selected) ? selected : "Hindi";
  ctx.view.innerHTML = `
    ${pageHeader("Categories", "Pick a mood, language, or listening context.")}
    <div class="category-tabs">
      ${CATEGORIES.map((item) => `<button class="category-tab ${item === category ? "active" : ""}" data-category="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join("")}
    </div>
    <section class="rail">
      <div class="rail-head">
        <div><p class="eyebrow">Category</p><h2>${escapeHtml(category)} music</h2></div>
        <a href="#/search?q=${encodeURIComponent(CATEGORY_QUERIES[category])}">Open as search</a>
      </div>
      <div id="categoryResults">${hasApiKey() ? loadingRow(10) : apiEmpty("Add a YouTube API key to load category results.")}</div>
    </section>
  `;

  ctx.view.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#/categories?name=${encodeURIComponent(button.dataset.category)}`;
    });
  });

  if (hasApiKey()) loadCategory(ctx, category);
}

async function loadCategory(ctx, category) {
  const resultEl = ctx.view.querySelector("#categoryResults");
  try {
    bumpActivity(category, 1);
    const response = await searchVideos(CATEGORY_QUERIES[category] || `${category} music`, "", 14);
    ctx.registerTracks(response.items);
    resultEl.innerHTML = trackGrid(response.items, `No ${category} results found.`);
  } catch (error) {
    resultEl.innerHTML = errorState(error);
  }
}
