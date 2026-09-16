import { getTopActivity, readStore } from "./storage.js";

const FALLBACKS = ["Punjabi songs", "Arijit Singh", "Bollywood romantic songs", "Lo-fi Hindi", "English pop songs"];

export function getRecommendationQueries() {
  const activity = getTopActivity(6);
  const history = readStore("history", []).slice(0, 6);
  const recent = readStore("recent", [])
    .map((item) => item.query || item.channelTitle)
    .filter(Boolean)
    .slice(0, 6);
  return [...new Set([...activity, ...history, ...recent, ...FALLBACKS])].slice(0, 8);
}
