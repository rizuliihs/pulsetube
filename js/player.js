import { addRecent, blockVideo, bumpActivity, getSettings, isBlocked, normalizeTrack, saveSettings, writeStore, readStore } from "./storage.js";
import { formatTime, searchVideos } from "./youtube.js";

let ytPlayer = null;
let readyPromise = null;
let current = null;
let currentIndex = -1;
let queue = readStore("queue", []);
let isReady = false;
let isPlaying = false;
let progressTimer = null;
let stateListener = () => {};
let settings = getSettings();

// Videos YouTube refuses to play inside an embed. They are remembered in
// localStorage, dropped from the queue, and swapped for another upload of the
// same song when one exists.
let startWatchdog = null;
let startedCurrent = false;
let swapping = false;
const swapAttempts = new Map();

export function initPlayer(onChange) {
  stateListener = onChange || (() => {});
  queue = queue.filter((entry) => entry.videoId && !isBlocked(entry.videoId));
  updateUi();
  bindControls();
  loadIframeApi();
  progressTimer = window.setInterval(tickProgress, 800);
  return getState();
}

export function getState() {
  return {
    current,
    currentIndex,
    queue: [...queue],
    isReady,
    isPlaying,
    shuffle: settings.shuffle,
    repeat: settings.repeat,
    muted: settings.muted,
    volume: settings.volume
  };
}

export function playTrack(item, sourceList = []) {
  const track = normalizeTrack(item);
  if (isBlocked(track.videoId)) {
    announceChange({ type: "playback-error", videoId: track.videoId, message: "That video cannot be played here." });
    return;
  }
  const source = (sourceList.length ? sourceList.map(normalizeTrack) : queue)
    .filter((entry) => entry.videoId && !isBlocked(entry.videoId));
  const sourceHasTrack = source.some((entry) => entry.videoId === track.videoId);
  queue = sourceHasTrack ? source : [track, ...source.filter((entry) => entry.videoId !== track.videoId)];
  currentIndex = Math.max(0, queue.findIndex((entry) => entry.videoId === track.videoId));
  current = queue[currentIndex] || track;
  saveQueue();
  addRecent(current);
  if (current.query) bumpActivity(current.query, 3);
  loadCurrentVideo();
  announceChange();
}

export function addToQueue(item) {
  const track = normalizeTrack(item);
  if (!queue.some((entry) => entry.videoId === track.videoId)) queue.push(track);
  saveQueue();
  announceChange();
}

export function playNext(item) {
  const track = normalizeTrack(item);
  const insertAt = currentIndex >= 0 ? currentIndex + 1 : 0;
  queue = queue.filter((entry) => entry.videoId !== track.videoId);
  queue.splice(insertAt, 0, track);
  if (!current) currentIndex = 0;
  saveQueue();
  announceChange();
}

export function removeFromQueue(videoId) {
  const removingCurrent = current?.videoId === videoId;
  queue = queue.filter((entry) => entry.videoId !== videoId);
  if (!queue.length) {
    current = null;
    currentIndex = -1;
    if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
  } else if (removingCurrent) {
    currentIndex = Math.min(currentIndex, queue.length - 1);
    current = queue[currentIndex];
    loadCurrentVideo();
  } else {
    currentIndex = queue.findIndex((entry) => entry.videoId === current?.videoId);
  }
  saveQueue();
  announceChange();
}

export function moveQueueItem(videoId, direction) {
  const from = queue.findIndex((entry) => entry.videoId === videoId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= queue.length) return;
  [queue[from], queue[to]] = [queue[to], queue[from]];
  currentIndex = queue.findIndex((entry) => entry.videoId === current?.videoId);
  saveQueue();
  announceChange();
}

export function clearQueue() {
  queue = current ? [current] : [];
  currentIndex = current ? 0 : -1;
  saveQueue();
  announceChange();
}

export function shuffleQueue() {
  const playing = current;
  const rest = queue.filter((entry) => entry.videoId !== playing?.videoId);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  queue = playing ? [playing, ...rest] : rest;
  currentIndex = playing ? 0 : -1;
  saveQueue();
  announceChange();
}

export function next() {
  if (!queue.length) return;
  if (settings.repeat === "one" && current) {
    loadCurrentVideo();
    return;
  }
  if (settings.shuffle && queue.length > 1) {
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * queue.length);
    currentIndex = nextIndex;
  } else if (currentIndex < queue.length - 1) {
    currentIndex += 1;
  } else if (settings.repeat === "all") {
    currentIndex = 0;
  } else {
    isPlaying = false;
    announceChange();
    return;
  }
  current = queue[currentIndex];
  addRecent(current);
  loadCurrentVideo();
  announceChange();
}

export function previous() {
  if (!queue.length) return;
  currentIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
  current = queue[currentIndex];
  addRecent(current);
  loadCurrentVideo();
  announceChange();
}

function loadIframeApi() {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    const createPlayer = () => {
      ytPlayer = new YT.Player("youtube-frame", {
        height: "180",
        width: "320",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            isReady = true;
            ytPlayer.setVolume(settings.volume);
            if (settings.muted) ytPlayer.mute();
            updateUi();
            resolve();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING) {
              startedCurrent = true;
              window.clearTimeout(startWatchdog);
            }
            isPlaying = event.data === YT.PlayerState.PLAYING;
            if (event.data === YT.PlayerState.ENDED) next();
            updateUi();
            announceChange();
          },
          onError: (event) => handlePlayerError(event?.data)
        }
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }
  });
  return readyPromise;
}

async function loadCurrentVideo() {
  await loadIframeApi();
  if (!current || !ytPlayer?.loadVideoById) return;
  startedCurrent = false;
  ytPlayer.loadVideoById(current.videoId);
  ytPlayer.setVolume(settings.volume);
  if (settings.muted) ytPlayer.mute();
  else ytPlayer.unMute();
  isPlaying = true;
  armStartWatchdog(current.videoId);
  updateUi();
}

// Some embeds load but never start on their own. Nudge them once, then treat
// them as unplayable and move on instead of leaving a stuck player bar.
function armStartWatchdog(videoId) {
  window.clearTimeout(startWatchdog);
  startWatchdog = window.setTimeout(() => {
    if (current?.videoId !== videoId || startedCurrent) return;
    try {
      ytPlayer?.playVideo?.();
    } catch {
      /* ignore */
    }
    startWatchdog = window.setTimeout(() => {
      if (current?.videoId !== videoId || startedCurrent) return;
      handleUnplayable(videoId, "This song will not start in an external player.");
    }, 4500);
  }, 2500);
}

function handlePlayerError(code) {
  const videoId = current?.videoId;
  if (!videoId) return;
  const reason = code === 101 || code === 150
    ? "The owner blocked this song from external players."
    : code === 100
      ? "This video was removed or made private."
      : "This song could not be played.";
  handleUnplayable(videoId, reason);
}

// A blocked upload usually has a playable twin on another channel, so look for
// one before giving up and moving to the next queue item.
async function handleUnplayable(videoId, reason) {
  window.clearTimeout(startWatchdog);
  if (swapping) return;
  const failed = queue.find((entry) => entry.videoId === videoId) || current;
  blockVideo(videoId);

  const attempts = swapAttempts.get(videoId) || 0;
  if (failed && attempts < 2) {
    swapAttempts.set(videoId, attempts + 1);
    swapping = true;
    announceChange({ type: "playback-error", videoId, message: `${reason} Looking for another version…` });
    try {
      const replacement = await findAlternative(failed);
      if (replacement) {
        const position = Math.max(queue.findIndex((entry) => entry.videoId === videoId), 0);
        queue = queue.filter((entry) => entry.videoId !== videoId && entry.videoId !== replacement.videoId);
        queue.splice(position, 0, replacement);
        currentIndex = position;
        current = replacement;
        saveQueue();
        addRecent(current);
        swapping = false;
        announceChange({ type: "playback-swap", videoId, message: `Playing another upload of "${replacement.title}".` });
        loadCurrentVideo();
        return;
      }
    } catch {
      /* fall through to skipping */
    }
    swapping = false;
  }

  skipUnplayable(videoId, `${reason} Skipping.`);
}

async function findAlternative(track) {
  const query = buildAlternativeQuery(track);
  if (!query) return null;
  const response = await searchVideos(query, "", 8);
  const target = track.durationSeconds || 0;
  const candidates = response.items
    .filter((item) => item.videoId !== track.videoId && !isBlocked(item.videoId))
    .filter((item) => !target || Math.abs(item.durationSeconds - target) <= 45);
  return candidates[0] || response.items.find((item) => item.videoId !== track.videoId && !isBlocked(item.videoId)) || null;
}

function buildAlternativeQuery(track) {
  const title = String(track.title || "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(official|video|audio|lyrical|full|song|hd|4k|teaser|status|reels?)\b/gi, " ")
    .split("|")[0]
    .replace(/\s+/g, " ")
    .trim();
  const channel = String(track.channelTitle || "").replace(/ - Topic$/i, "").trim();
  const query = `${title} ${channel}`.trim();
  return query.length > 2 ? query : String(track.title || "").trim();
}

function bindControls() {
  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-player-action]");
    if (!control) return;
    const action = control.dataset.playerAction;
    if (action === "toggle") togglePlay();
    if (action === "next") next();
    if (action === "previous") previous();
    if (action === "shuffle") toggleShuffle();
    if (action === "repeat") toggleRepeat();
    if (action === "mute") toggleMute();
    if (action === "fullscreen") openModal("playerModal");
    if (action === "clearQueue") clearQueue();
    if (action === "shuffleQueue") shuffleQueue();
  });

  document.getElementById("seekBar")?.addEventListener("input", (event) => {
    if (!ytPlayer?.seekTo || !ytPlayer.getDuration) return;
    const duration = ytPlayer.getDuration() || 0;
    ytPlayer.seekTo((Number(event.target.value) / 1000) * duration, true);
  });

  document.getElementById("volumeBar")?.addEventListener("input", (event) => {
    settings = saveSettings({ volume: Number(event.target.value), muted: false });
    if (ytPlayer?.setVolume) {
      ytPlayer.unMute();
      ytPlayer.setVolume(settings.volume);
    }
    updateUi();
  });
}

function togglePlay() {
  if (!ytPlayer || !current) return;
  if (isPlaying) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
}

function toggleShuffle() {
  settings = saveSettings({ shuffle: !settings.shuffle });
  updateUi();
}

function toggleRepeat() {
  const nextMode = settings.repeat === "off" ? "all" : settings.repeat === "all" ? "one" : "off";
  settings = saveSettings({ repeat: nextMode });
  updateUi();
}

function toggleMute() {
  settings = saveSettings({ muted: !settings.muted });
  if (ytPlayer?.mute) {
    if (settings.muted) ytPlayer.mute();
    else ytPlayer.unMute();
  }
  updateUi();
}

function tickProgress() {
  if (!ytPlayer?.getCurrentTime || !ytPlayer?.getDuration) return;
  const currentTime = ytPlayer.getCurrentTime() || 0;
  const duration = ytPlayer.getDuration() || current?.durationSeconds || 0;
  const seek = document.getElementById("seekBar");
  const currentEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("durationTime");
  if (seek && duration) seek.value = String(Math.round((currentTime / duration) * 1000));
  if (currentEl) currentEl.textContent = formatTime(currentTime);
  if (durationEl) durationEl.textContent = formatTime(duration);
}

function updateUi() {
  const thumb = current?.thumbnail || "";
  setText("playerTitle", current?.title || "Choose a song");
  setText("playerArtist", current?.channelTitle || "Music from YouTube");
  setText("modalTitle", current?.title || "Choose a song");
  setText("modalArtist", current?.channelTitle || "Music from YouTube");
  setImage("playerThumb", thumb);
  setImage("modalThumb", thumb);
  document.querySelectorAll("[data-player-action='toggle']").forEach((button) => {
    if (button.classList.contains("primary-btn")) return;
    button.textContent = isPlaying ? "⏸" : "▶";
  });
  document.querySelectorAll("[data-player-action='shuffle']").forEach((button) => {
    button.classList.toggle("active", settings.shuffle);
  });
  document.querySelectorAll("[data-player-action='repeat']").forEach((button) => {
    button.classList.toggle("active", settings.repeat !== "off");
    button.textContent = settings.repeat === "one" ? "↺1" : "↻";
  });
  document.querySelectorAll("[data-player-action='mute']").forEach((button) => {
    button.textContent = settings.muted ? "🔇" : "🔊";
  });
  const volume = document.getElementById("volumeBar");
  if (volume) volume.value = String(settings.volume);
  renderQueue();
}

function renderQueue() {
  const list = document.getElementById("queueList");
  if (!list) return;
  if (!queue.length) {
    list.className = "queue-list empty-state";
    list.textContent = "No songs in queue yet.";
    return;
  }
  list.className = "queue-list";
  list.innerHTML = queue.map((item, index) => `
    <article class="queue-item ${item.videoId === current?.videoId ? "is-current" : ""}">
      <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" />
      <button class="queue-main" data-queue-play="${escapeAttr(item.videoId)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.channelTitle)} · ${escapeHtml(item.duration)}</span>
      </button>
      <div class="queue-tools">
        <button class="mini-btn" data-queue-move="${escapeAttr(item.videoId)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="mini-btn" data-queue-move="${escapeAttr(item.videoId)}" data-dir="1" ${index === queue.length - 1 ? "disabled" : ""}>↓</button>
        <button class="mini-btn" data-queue-remove="${escapeAttr(item.videoId)}">×</button>
      </div>
    </article>
  `).join("");
  list.querySelectorAll("[data-queue-play]").forEach((button) => {
    button.addEventListener("click", () => {
      currentIndex = queue.findIndex((entry) => entry.videoId === button.dataset.queuePlay);
      current = queue[currentIndex];
      loadCurrentVideo();
      announceChange();
    });
  });
  list.querySelectorAll("[data-queue-remove]").forEach((button) => {
    button.addEventListener("click", () => removeFromQueue(button.dataset.queueRemove));
  });
  list.querySelectorAll("[data-queue-move]").forEach((button) => {
    button.addEventListener("click", () => moveQueueItem(button.dataset.queueMove, Number(button.dataset.dir)));
  });
}

function saveQueue() {
  writeStore("queue", queue);
}

function announceChange(event) {
  updateUi();
  stateListener(getState(), event);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setImage(id, src) {
  const image = document.getElementById(id);
  if (!image) return;
  image.src = src || "";
  image.hidden = !src;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = false;
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

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
