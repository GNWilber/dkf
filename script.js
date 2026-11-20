// DYSKUSYJNY KLUB FILMOWY — logika strony v9
const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];
const RANKING_PREFIX = "Ranking DKF";
const RANKING_STORAGE_KEY = "dkf_ranking_v1";

// GENERAL HELPERS
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pluralizeFilms(count) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (abs === 1) return "film";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "filmy";
  return "filmów";
}

function normalizeSearch(str) {
  return String(str ?? "")
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function canHover() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function getPosterUrl(url, size) {
  if (!url) return "";
  return url.replace(
    /^https:\/\/(?:image\.tmdb\.org|www\.themoviedb\.org)\/t\/p\/[^/]+(\/.+)$/,
    `https://image.tmdb.org/t/p/${size}$1`
  );
}

function attachImgFallback(img, originalUrl, onFail) {
  if (!img) return;
  let triedOriginal = false;
  img.addEventListener("error", () => {
    if (!triedOriginal && originalUrl && img.src !== originalUrl) {
      triedOriginal = true;
      img.src = originalUrl;
      return;
    }
    if (onFail) onFail();
  });
}

// DATE HELPERS
function parseDate(str) {
  const [d, m, y] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}
function isUpcoming(movieDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return movieDate >= today;
}
function getNextMovie(sortedMovies) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sortedMovies.find(m => parseDate(m.date) >= today) || null;
}

// DISPLAY HELPERS
function displayName(movie) {
  const base = movie.romaji ? `${movie.name} / ${movie.romaji}` : movie.name;
  return movie.altName ? `${base} (${movie.altName})` : base;
}
function extractFlags(movie) {
  if (!movie.flag) return [];
  return [...movie.flag.matchAll(/\p{Regional_Indicator}\p{Regional_Indicator}/gu)].map(m => m[0]);
}

// COPY FORMAT BUILDERS
function buildUpcomingCopyText(upcomingMovies) {
  return upcomingMovies
    .map(m => `### ${m.date}: [*${displayName(m)} [${m.year}]*](${m.filmweb})`)
    .join("  \n") + "  \n";
}
function buildArchiveCopyText(archiveMovies, globalIndexMap) {
  return [...archiveMovies]
    .reverse()
    .map(m => `${globalIndexMap.get(m)}. ${m.date}: ${displayName(m)} [${m.year}]`)
    .join("\n");
}
function buildRankingCopyText(rankingMovies, code) {
  const header = `${RANKING_PREFIX} {${code}}:`;
  const body = rankingMovies
    .map((m, i) => `${i + 1}. ${displayName(m)} [${m.year}]`)
    .join("\n");
  return `${header}\n${body}`;
}

// RANKING SEED CODE — encode stable movie IDs into a short base36 string (100% compatible with legacy codes)
function encodeRanking(orderIds) {
  return orderIds.map(i => i.toString(36).padStart(2, "0")).join("");
}
function decodeRanking(code) {
  const clean = String(code ?? "").trim().replace(/[^0-9a-z]/gi, "").toLowerCase();
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  const out = [];
  for (let i = 0; i < clean.length; i += 2) {
    const n = parseInt(clean.slice(i, i + 2), 36);
    if (Number.isNaN(n)) return null;
    out.push(n);
  }
  return out;
}
function extractCodeFromInput(raw) {
  const m = String(raw ?? "").match(/\{([^}]+)\}/);
  return m ? m[1] : String(raw ?? "");
}
function resolveRankingFromCode(code, archiveById, defaultOrder) {
  const order = decodeRanking(code);
  if (!order || order.length === 0) return null;
  const seen = new Set();
  const restored = [];
  for (const id of order) {
    const movie = archiveById.get(id);
    if (movie && !seen.has(movie)) {
      seen.add(movie);
      restored.push(movie);
    }
  }
  if (restored.length === 0) return null;
  const missing = defaultOrder.filter(m => !seen.has(m));
  return { movies: [...restored, ...missing], matchedCount: restored.length };
}

// TOAST SYSTEM
let _toastTimer = null;
function showToast(message) {
  const existing = document.getElementById("copy-toast");
  if (existing) existing.remove();
  const footer = document.querySelector("footer");
  if (footer && !document.body.classList.contains("screenshot-mode")) {
    const toastMsg = footer.querySelector(".footer-toast-msg");
    if (toastMsg) {
      toastMsg.textContent = message;
      footer.classList.add("toast-active");
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(() => footer.classList.remove("toast-active"), 2400);
      return;
    }
  }
  const toast = document.createElement("div");
  toast.id = "copy-toast";
  toast.className = "copy-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  toast.getBoundingClientRect();
  toast.classList.add("visible");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 2400);
}

async function copyToClipboard(text, toastMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(toastMessage);
}

// HINT POPUP SYSTEM — viewport-clamped tooltip, desktop/keyboard only
let _hintEl = null;
function getHintEl() {
  if (!_hintEl) {
    _hintEl = document.createElement("div");
    _hintEl.className = "hint-popup";
    _hintEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(_hintEl);
  }
  return _hintEl;
}
function showHint(target) {
  const text = target.dataset.hint;
  if (!text) return;
  const hint = getHintEl();
  hint.textContent = text;
  hint.classList.remove("is-below");

  const rect = target.getBoundingClientRect();
  const margin = 10;
  const hintW = hint.offsetWidth || 160;
  const idealCenter = rect.left + rect.width / 2;
  const clampedCenter = Math.max(margin + hintW / 2, Math.min(window.innerWidth - margin - hintW / 2, idealCenter));
  const arrowShift = idealCenter - clampedCenter;

  hint.style.left = clampedCenter + "px";
  hint.style.setProperty("--arrow-shift", `${Math.max(-hintW / 2 + 12, Math.min(hintW / 2 - 12, arrowShift))}px`);

  const showBelow = rect.top < 46;
  hint.classList.toggle("is-below", showBelow);
  hint.style.top = (showBelow ? rect.bottom + 10 : rect.top - 10) + "px";

  hint.getBoundingClientRect();
  hint.classList.add("is-visible");
}
function hideHint() {
  if (_hintEl) _hintEl.classList.remove("is-visible");
}
function attachHint(el) {
  if (!el) return;
  el.addEventListener("mouseenter", () => {
    if (canHover()) showHint(el);
  });
  el.addEventListener("mouseleave", hideHint);
  el.addEventListener("click", hideHint);
  el.addEventListener("focus", () => {
    if (el.matches(":focus-visible")) showHint(el);
  });
  el.addEventListener("blur", hideHint);
}
function initHints() {
  document.querySelectorAll("[data-hint]").forEach(attachHint);
}

// UPCOMING CARD BUILDER (exact 2:3 poster aspect ratio)
function buildCard(movie) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const monthFull = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();

  const card = document.createElement("article");
  card.className = "movie-card" + (isToday ? " is-today" : "");

  const posterSrc = movie.poster ? getPosterUrl(movie.poster, "w780") : "";
  const posterHtml = posterSrc
    ? `<img class="card-poster-bg" src="${escapeHtml(posterSrc)}" alt="" aria-hidden="true" decoding="async" />`
    : "";

  card.innerHTML = `
    ${posterHtml}
    <div class="card-poster-scrim" aria-hidden="true"></div>
    <div class="card-date">
      <span class="date-day">${day}</span>
      <div class="date-gap"></div>
      <span class="date-month-year">${escapeHtml(monthFull)} ${year}</span>
      ${isToday ? '<span class="badge-today">Dziś!</span>' : ""}
    </div>
    <div class="card-divider"></div>
    <div class="card-info">
      <h2 class="card-title">${escapeHtml(movie.name)}</h2>
      ${movie.romaji ? `<p class="card-romaji">${escapeHtml(movie.romaji)}</p>` : ""}
      ${movie.altName ? `<p class="card-alt">${escapeHtml(movie.altName)}</p>` : ""}
      <p class="card-year">${movie.flag ? escapeHtml(movie.flag) + " " : ""}${escapeHtml(movie.year)}</p>
      ${movie.author ? `<p class="card-author">${escapeHtml(movie.author)}</p>` : ""}
    </div>
    <a class="card-link" href="${escapeHtml(movie.filmweb)}" target="_blank" rel="noopener noreferrer" data-hint="Otwórz na Filmwebie">
      <img src="filmwebfull.svg" alt="Filmweb" class="filmweb-logo-full" />
    </a>
  `;

  const bgImg = card.querySelector(".card-poster-bg");
  attachImgFallback(bgImg, movie.poster, () => bgImg.remove());

  const link = card.querySelector(".card-link");
  link.addEventListener("click", e => e.stopPropagation());
  attachHint(link);

  card.addEventListener("click", () => {
    if (document.body.classList.contains("screenshot-mode")) return;
    copyToClipboard(`${displayName(movie)} [${movie.year}]`, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  return card;
}

// POSTER-MODE CARD (archive, exact 2:3 with lazy loading & touch-friendly overlay)
let _openPosterCard = null;
function closeOpenPosterCard() {
  if (_openPosterCard) {
    _openPosterCard.classList.remove("is-open");
    _openPosterCard = null;
  }
}

function buildPosterCard(movie, globalNum) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const card = document.createElement("article");
  card.className = "poster-card";

  const posterSrc = movie.poster ? getPosterUrl(movie.poster, "w342") : "";
  card.innerHTML = `
    <div class="poster-card-img">
      ${posterSrc
        ? `<img class="poster-card-img-el" src="${escapeHtml(posterSrc)}" alt="${escapeHtml(displayName(movie))}" loading="lazy" decoding="async" />`
        : `<span class="poster-card-noimg">${escapeHtml(movie.name)}</span>`}
    </div>
    <div class="poster-card-overlay">
      <span class="poster-card-count">#${globalNum}</span>
      <h3 class="poster-card-title">${escapeHtml(movie.name)}</h3>
      ${movie.romaji ? `<p class="poster-card-romaji">${escapeHtml(movie.romaji)}</p>` : ""}
      ${movie.altName ? `<p class="poster-card-alt">${escapeHtml(movie.altName)}</p>` : ""}
      <p class="poster-card-meta">${movie.flag ? escapeHtml(movie.flag) + " " : ""}${escapeHtml(movie.year)}</p>
      <p class="poster-card-date">${day} ${escapeHtml(month)} ${year}</p>
      ${movie.author ? `<span class="poster-card-author">${escapeHtml(movie.author)}</span>` : ""}
      <a class="poster-card-link" href="${escapeHtml(movie.filmweb)}" target="_blank" rel="noopener noreferrer" data-hint="Otwórz na Filmwebie">
        <img src="filmweb.svg" alt="Filmweb" class="filmweb-logo-sq" />
      </a>
    </div>
  `;

  const imgEl = card.querySelector(".poster-card-img-el");
  if (imgEl) {
    attachImgFallback(imgEl, movie.poster, () => {
      const wrap = card.querySelector(".poster-card-img");
      wrap.innerHTML = `<span class="poster-card-noimg">${escapeHtml(movie.name)}</span>`;
    });
  }

  const link = card.querySelector(".poster-card-link");
  link.addEventListener("click", e => e.stopPropagation());
  attachHint(link);

  card.addEventListener("click", e => {
    if (!canHover()) {
      // Touch device: first tap reveals details & Filmweb link, second tap copies title
      if (!card.classList.contains("is-open")) {
        e.stopPropagation();
        closeOpenPosterCard();
        card.classList.add("is-open");
        _openPosterCard = card;
        return;
      }
    }
    copyToClipboard(`${displayName(movie)} [${movie.year}]`, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  return card;
}

// ARCHIVE LIST ITEM BUILDER
function buildArchiveItem(movie, globalNum) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const li = document.createElement("li");
  li.className = "archive-item";
  li.innerHTML = `
    <span class="archive-num">${globalNum}.</span>
    <span class="archive-date">${day} ${escapeHtml(month)} ${year}</span>
    <span class="archive-dot" aria-hidden="true"></span>
    <span class="archive-title">
      ${escapeHtml(movie.name)}
      ${movie.romaji ? `<span class="archive-romaji">${escapeHtml(movie.romaji)}</span>` : ""}
      ${movie.altName ? `<span class="archive-alt">–&nbsp;&nbsp;${escapeHtml(movie.altName)}</span>` : ""}
      <span class="archive-year">${movie.flag ? escapeHtml(movie.flag) + " " : ""}${escapeHtml(movie.year)}</span>
    </span>
    ${movie.author
      ? `<span class="author-bubble">${escapeHtml(movie.author)}</span>`
      : '<span class="author-bubble author-bubble--empty" aria-hidden="true"></span>'}
    <a href="${escapeHtml(movie.filmweb)}" target="_blank" rel="noopener noreferrer" class="archive-link" data-hint="Otwórz na Filmwebie">
      <img src="filmweb.svg" alt="Filmweb" class="filmweb-logo-sq" />
    </a>
  `;

  const link = li.querySelector(".archive-link");
  link.addEventListener("click", e => e.stopPropagation());
  attachHint(link);

  li.addEventListener("click", () => {
    copyToClipboard(`${displayName(movie)} [${movie.year}]`, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  if (movie.poster) {
    attachPosterHover(li, movie);
  }
  return li;
}

// RANKING ITEM BUILDER (pointer drag + touch handle + up/down buttons)
function buildRankingItem(movie, rank, movieId, callbacks) {
  const li = document.createElement("li");
  li.className = "archive-item ranking-item";
  li.dataset.movieId = String(movieId);
  li.innerHTML = `
    <span class="archive-num ranking-num">${rank}.</span>
    <span class="ranking-handle" aria-hidden="true" data-hint="Przeciągnij, aby zmienić pozycję">
      <svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="5" r="1.6" fill="currentColor"/>
        <circle cx="10" cy="5" r="1.6" fill="currentColor"/>
        <circle cx="4" cy="10" r="1.6" fill="currentColor"/>
        <circle cx="10" cy="10" r="1.6" fill="currentColor"/>
        <circle cx="4" cy="15" r="1.6" fill="currentColor"/>
        <circle cx="10" cy="15" r="1.6" fill="currentColor"/>
      </svg>
    </span>
    <span class="archive-title ranking-title">
      ${escapeHtml(movie.name)}
      ${movie.romaji ? `<span class="archive-romaji">${escapeHtml(movie.romaji)}</span>` : ""}
      ${movie.altName ? `<span class="archive-alt">–&nbsp;&nbsp;${escapeHtml(movie.altName)}</span>` : ""}
      <span class="archive-year">${movie.flag ? escapeHtml(movie.flag) + " " : ""}${escapeHtml(movie.year)}</span>
    </span>
    ${movie.author
      ? `<span class="author-bubble">${escapeHtml(movie.author)}</span>`
      : '<span class="author-bubble author-bubble--empty" aria-hidden="true"></span>'}
    <div class="ranking-move-btns">
      <button type="button" class="ranking-move-btn ranking-move-up" aria-label="Przesuń wyżej" data-hint="Przesuń wyżej">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 5L5 1L9 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button type="button" class="ranking-move-btn ranking-move-down" aria-label="Przesuń niżej" data-hint="Przesuń niżej">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <a href="${escapeHtml(movie.filmweb)}" target="_blank" rel="noopener noreferrer" class="archive-link" data-hint="Otwórz na Filmwebie" draggable="false">
      <img src="filmweb.svg" alt="Filmweb" class="filmweb-logo-sq" draggable="false" />
    </a>
  `;

  const link = li.querySelector(".archive-link");
  link.addEventListener("click", e => e.stopPropagation());
  attachHint(link);

  const handle = li.querySelector(".ranking-handle");
  attachHint(handle);

  const upBtn = li.querySelector(".ranking-move-up");
  const downBtn = li.querySelector(".ranking-move-down");
  attachHint(upBtn);
  attachHint(downBtn);

  upBtn.addEventListener("click", e => {
    e.stopPropagation();
    callbacks.onMove(li, -1);
  });
  downBtn.addEventListener("click", e => {
    e.stopPropagation();
    callbacks.onMove(li, 1);
  });

  li.addEventListener("pointerdown", e => callbacks.onPointerDown(e, li));

  li.addEventListener("click", () => {
    if (callbacks.shouldSuppressClick()) return;
    copyToClipboard(`${displayName(movie)} [${movie.year}]`, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  if (movie.poster) {
    attachPosterHover(li, movie);
  }
  return li;
}

// STICKY FOOTER
function isAnnouncementActive() {
  if (typeof ANNOUNCEMENT === "undefined" || !ANNOUNCEMENT || !ANNOUNCEMENT.trim()) return false;
  if (typeof ANNOUNCEMENT_EXPIRY === "undefined" || !ANNOUNCEMENT_EXPIRY || !ANNOUNCEMENT_EXPIRY.trim()) return true;
  const expiry = parseDate(ANNOUNCEMENT_EXPIRY);
  expiry.setHours(23, 59, 59, 999);
  return new Date() <= expiry;
}

function renderFooter(nextMovie) {
  const showAnnouncement = isAnnouncementActive();
  if (!showAnnouncement && !nextMovie) return;
  const footer = document.createElement("footer");
  if (showAnnouncement) {
    footer.classList.add("footer--announcement");
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-content">
          <span class="footer-label footer-announce-label"><span class="footer-announce-dot"></span>Ogłoszenie</span>
          <div class="footer-divider"></div>
          <span class="footer-announce-text">${escapeHtml(ANNOUNCEMENT)}</span>
        </div>
        <div class="footer-toast-msg" aria-live="polite"></div>
      </div>
    `;
  } else {
    const date = parseDate(nextMovie.date);
    const day = date.getDate();
    const monthFull = POLISH_MONTHS[date.getMonth()];
    const year = date.getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = date.getTime() === today.getTime();
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-content">
          <span class="footer-label">${isToday ? "Dzisiejszy seans" : "Następny seans"}</span>
          <div class="footer-divider"></div>
          <div class="footer-meta">
            <span class="footer-date">${day} ${escapeHtml(monthFull)} ${year}</span>
            <span class="footer-sep">·</span>
            <span class="footer-title">${escapeHtml(nextMovie.name)}</span>
            ${nextMovie.romaji ? `<span class="footer-romaji">${escapeHtml(nextMovie.romaji)}</span>` : ""}
            ${nextMovie.altName ? `<span class="footer-alt">${escapeHtml(nextMovie.altName)}</span>` : ""}
            <span class="footer-year">${escapeHtml(nextMovie.year)}</span>
          </div>
          <div class="footer-divider"></div>
          <a class="footer-fw-link" href="${escapeHtml(nextMovie.filmweb)}" target="_blank" rel="noopener noreferrer" data-hint="Otwórz na Filmwebie">
            <img src="filmweb.svg" alt="Filmweb" class="footer-fw-icon" />
          </a>
        </div>
        <div class="footer-toast-msg" aria-live="polite"></div>
      </div>
    `;
  }
  document.body.appendChild(footer);
  document.body.classList.add("has-footer");
}

// POSTER HOVER POPUP SYSTEM (desktop only, optimized w342)
const POPUP_W = 140;
const POPUP_GAP = 16;
const POPUP_MIN_SIDE_SPACE = POPUP_W + POPUP_GAP + 24;

let _posterPopup = null;
let _posterHideTimer = null;
let _posterReqId = 0;
let _isDraggingAny = false;

function getPosterPopup() {
  if (!_posterPopup) {
    _posterPopup = document.createElement("div");
    _posterPopup.className = "poster-popup";
    _posterPopup.setAttribute("aria-hidden", "true");
    document.body.appendChild(_posterPopup);
  }
  return _posterPopup;
}

function showPosterPopup(el, movie) {
  if (!canHover() || _isDraggingAny) return;
  const listEl = el.closest(".archive-list");
  if (!listEl) return;

  const listRect = listEl.getBoundingClientRect();
  const rightSpace = window.innerWidth - listRect.right;
  const leftSpace = listRect.left;
  const hasSpace = rightSpace >= POPUP_MIN_SIDE_SPACE || leftSpace >= POPUP_MIN_SIDE_SPACE;
  if (!hasSpace) return;

  const popup = getPosterPopup();
  clearTimeout(_posterHideTimer);
  const reqId = ++_posterReqId;

  const posterSrc = getPosterUrl(movie.poster, "w342");
  popup.innerHTML = `<img src="${escapeHtml(posterSrc)}" alt="${escapeHtml(movie.name)}" class="poster-popup-img" decoding="async" />`;
  popup.classList.add("is-loading");
  const img = popup.querySelector("img");
  img.onload = () => {
    if (reqId === _posterReqId) popup.classList.remove("is-loading");
  };
  attachImgFallback(img, movie.poster, () => {
    if (reqId === _posterReqId) popup.classList.remove("is-visible");
  });

  const itemRect = el.getBoundingClientRect();
  const scrollY = window.scrollY;
  let left, right;

  if (rightSpace >= POPUP_MIN_SIDE_SPACE) {
    left = listRect.right + POPUP_GAP;
    right = "auto";
  } else {
    left = "auto";
    right = window.innerWidth - listRect.left + POPUP_GAP;
  }

  const popupH = Math.round(POPUP_W * 1.5);
  let top = itemRect.top + scrollY + itemRect.height / 2 - popupH / 2;
  const minTop = scrollY + 84;
  const maxTop = scrollY + window.innerHeight - popupH - 84;
  top = Math.max(minTop, Math.min(top, Math.max(minTop, maxTop)));

  popup.style.left = typeof left === "number" ? left + "px" : left;
  popup.style.right = typeof right === "number" ? right + "px" : right;
  popup.style.top = top + "px";
  popup.style.width = POPUP_W + "px";

  popup.getBoundingClientRect();
  popup.classList.add("is-visible");
}

function hidePosterPopup(immediate = false) {
  clearTimeout(_posterHideTimer);
  if (!_posterPopup) return;
  if (immediate) {
    _posterPopup.classList.remove("is-visible");
    return;
  }
  _posterHideTimer = setTimeout(() => {
    if (_posterPopup) _posterPopup.classList.remove("is-visible");
  }, 80);
}

function attachPosterHover(el, movie) {
  el.addEventListener("mouseenter", () => showPosterPopup(el, movie));
  el.addEventListener("mouseleave", () => hidePosterPopup(false));
}

// MAIN RENDER
function render() {
  const sorted = [...MOVIES].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Assign stable IDs: use explicit movie.id when present, auto-assign next free integer otherwise
  let nextAutoId = MOVIES.reduce((max, m) => (Number.isInteger(m.id) ? Math.max(max, m.id) : max), -1) + 1;
  const globalIndexMap = new Map();
  const movieIdMap = new Map();

  sorted.forEach((m, i) => {
    globalIndexMap.set(m, i + 1);
    const id = Number.isInteger(m.id) ? m.id : nextAutoId++;
    movieIdMap.set(m, id);
  });

  const upcomingMovies = sorted.filter(m => isUpcoming(parseDate(m.date)));
  const archiveMovies = sorted.filter(m => !isUpcoming(parseDate(m.date))).reverse();
  const archiveById = new Map();
  archiveMovies.forEach(m => archiveById.set(movieIdMap.get(m), m));

  // Precompute normalized search strings for instant filtering
  const searchIndex = new Map();
  archiveMovies.forEach(m => {
    searchIndex.set(m, normalizeSearch(`${m.name} ${m.romaji || ""} ${m.altName || ""} ${m.author || ""} ${m.year}`));
  });

  renderFooter(getNextMovie(sorted));

  // Global passive listeners for clean popup dismissal
  window.addEventListener("scroll", () => {
    hideHint();
    hidePosterPopup(true);
  }, { passive: true });
  window.addEventListener("resize", () => {
    hideHint();
    hidePosterPopup(true);
  }, { passive: true });
  document.addEventListener("click", e => {
    if (_openPosterCard && !_openPosterCard.contains(e.target)) {
      closeOpenPosterCard();
    }
  });

  // UPCOMING CARDS
  const upcomingEl = document.getElementById("upcoming-cards");
  const upcomingEmpty = document.getElementById("upcoming-empty");
  if (upcomingMovies.length === 0) {
    upcomingEmpty.classList.remove("hidden");
  } else {
    upcomingMovies.forEach((m, i) => {
      const card = buildCard(m);
      card.style.animationDelay = `${i * 0.08}s`;
      upcomingEl.appendChild(card);
    });
  }

  // MEETINGS / ARCHIVE LIST + FILTERS
  const archiveEl = document.getElementById("archive-list");
  const posterGridEl = document.getElementById("archive-poster-grid");
  const archiveEmpty = document.getElementById("archive-empty");
  const archiveEmptyText = document.getElementById("archive-empty-text");
  const filtersEl = document.getElementById("filters");
  const countriesEl = document.getElementById("filter-countries");
  const authorsEl = document.getElementById("filter-authors");
  const filterGroupAuthors = document.getElementById("filter-group-authors");
  const searchInput = document.getElementById("filter-search");
  const searchClearBtn = document.getElementById("filter-search-clear");
  const filterCountEl = document.getElementById("filter-count");
  const filterResetBtn = document.getElementById("filter-reset-btn");
  const showAllToggle = document.getElementById("show-all-toggle");
  const posterModeToggle = document.getElementById("poster-mode-toggle");
  const yearSlider = document.getElementById("year-slider");
  const yearMinInput = document.getElementById("year-min");
  const yearMaxInput = document.getElementById("year-max");
  const yearRangeEl = document.getElementById("year-range");
  const yearMinVal = document.getElementById("year-min-val");
  const yearMaxVal = document.getElementById("year-max-val");

  const selectedCountries = new Set();
  const selectedAuthors = new Set();
  const countryButtons = [];
  const authorButtons = [];
  let searchQuery = "";
  let yearLo, yearHi, yearBoundLo, yearBoundHi;

  // Build archive list DOM nodes ONCE (no DOM thrashing during slider/search input)
  const listEntries = [];
  const posterEntries = [];
  let posterGridBuilt = false;

  function buildArchiveNodes() {
    const frag = document.createDocumentFragment();
    archiveMovies.forEach(m => {
      const li = buildArchiveItem(m, globalIndexMap.get(m));
      listEntries.push({ movie: m, el: li });
      frag.appendChild(li);
    });
    archiveEl.appendChild(frag);
  }

  function ensurePosterGridBuilt() {
    if (posterGridBuilt) return;
    posterGridBuilt = true;
    const frag = document.createDocumentFragment();
    archiveMovies.forEach(m => {
      const card = buildPosterCard(m, globalIndexMap.get(m));
      posterEntries.push({ movie: m, el: card });
      frag.appendChild(card);
    });
    posterGridEl.appendChild(frag);
  }

  function buildCountryFilter() {
    const present = new Set();
    const flagCount = new Map();
    archiveMovies.forEach(m => extractFlags(m).forEach(f => {
      if (COUNTRIES[f]) {
        present.add(f);
        flagCount.set(f, (flagCount.get(f) || 0) + 1);
      }
    }));
    countriesEl.innerHTML = "";
    if (present.size === 0) return;
    [...present]
      .sort((a, b) => (flagCount.get(b) || 0) - (flagCount.get(a) || 0))
      .forEach(flag => {
        const count = flagCount.get(flag) || 0;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "country-chip";
        btn.title = COUNTRIES[flag];
        btn.setAttribute("aria-label", `${COUNTRIES[flag]} (${count})`);
        btn.setAttribute("aria-pressed", "false");
        btn.innerHTML = `<span class="country-flag">${flag}</span><span class="country-count">${count}</span>`;
        btn.addEventListener("click", () => {
          const active = !selectedCountries.has(flag);
          if (active) selectedCountries.add(flag);
          else selectedCountries.delete(flag);
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
          applyArchiveFilters();
        });
        countryButtons.push(btn);
        countriesEl.appendChild(btn);
      });
  }

  function buildAuthorFilter() {
    const authorCount = new Map();
    archiveMovies.forEach(m => {
      if (m.author && m.author.trim()) {
        const a = m.author.trim();
        authorCount.set(a, (authorCount.get(a) || 0) + 1);
      }
    });
    authorsEl.innerHTML = "";
    if (authorCount.size === 0) {
      filterGroupAuthors.classList.add("hidden");
      return;
    }
    filterGroupAuthors.classList.remove("hidden");
    [...authorCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([author, count]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "author-chip";
        btn.title = author;
        btn.setAttribute("aria-pressed", "false");
        btn.innerHTML = `<span class="author-chip-name">${escapeHtml(author)}</span><span class="country-count">${count}</span>`;
        btn.addEventListener("click", () => {
          const active = !selectedAuthors.has(author);
          if (active) selectedAuthors.add(author);
          else selectedAuthors.delete(author);
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
          applyArchiveFilters();
        });
        authorButtons.push(btn);
        authorsEl.appendChild(btn);
      });
  }

  function syncSliderZIndex() {
    const span = Math.max(1, yearBoundHi - yearBoundLo);
    const mid = (yearBoundLo + yearBoundHi) / 2;
    const nearThreshold = Math.max(2, Math.round(span * 0.06));
    if (yearHi - yearLo <= nearThreshold) {
      const minOnTop = yearLo >= mid;
      yearMinInput.style.zIndex = minOnTop ? "5" : "3";
      yearMaxInput.style.zIndex = minOnTop ? "3" : "5";
    } else {
      yearMinInput.style.zIndex = "4";
      yearMaxInput.style.zIndex = "4";
    }
  }

  function buildYearSlider() {
    if (archiveMovies.length === 0) {
      yearSlider.classList.add("hidden");
      return;
    }
    const years = archiveMovies.map(m => m.year);
    yearBoundLo = Math.min(...years);
    yearBoundHi = Math.max(...years);
    yearLo = yearBoundLo;
    yearHi = yearBoundHi;
    [yearMinInput, yearMaxInput].forEach(inp => {
      inp.min = yearBoundLo;
      inp.max = yearBoundHi;
      inp.step = 1;
    });
    yearMinInput.value = yearLo;
    yearMaxInput.value = yearHi;
    if (yearBoundLo === yearBoundHi) yearSlider.classList.add("year-slider--single");
    updateYearUI();
  }

  function updateYearUI() {
    yearMinVal.textContent = yearLo;
    yearMaxVal.textContent = yearHi;
    const span = Math.max(1, yearBoundHi - yearBoundLo);
    const left = ((yearLo - yearBoundLo) / span) * 100;
    const right = ((yearHi - yearBoundLo) / span) * 100;
    yearRangeEl.style.left = left + "%";
    yearRangeEl.style.right = (100 - right) + "%";
    syncSliderZIndex();
  }

  yearMinInput.addEventListener("input", () => {
    yearLo = Math.min(Number(yearMinInput.value), yearHi);
    yearMinInput.value = yearLo;
    updateYearUI();
    applyArchiveFilters();
  });
  yearMaxInput.addEventListener("input", () => {
    yearHi = Math.max(Number(yearMaxInput.value), yearLo);
    yearMaxInput.value = yearHi;
    updateYearUI();
    applyArchiveFilters();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = normalizeSearch(searchInput.value);
    searchClearBtn.classList.toggle("hidden", searchInput.value.length === 0);
    applyArchiveFilters();
  });
  searchClearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    searchClearBtn.classList.add("hidden");
    applyArchiveFilters();
    searchInput.focus();
  });

  function hasActiveFilters() {
    const yearFiltered = typeof yearBoundLo === "number" && (yearLo !== yearBoundLo || yearHi !== yearBoundHi);
    return selectedCountries.size > 0 || selectedAuthors.size > 0 || yearFiltered || searchQuery.length > 0;
  }

  function resetAllFilters() {
    selectedCountries.clear();
    selectedAuthors.clear();
    countryButtons.forEach(btn => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
    });
    authorButtons.forEach(btn => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-pressed", "false");
    });
    searchInput.value = "";
    searchQuery = "";
    searchClearBtn.classList.add("hidden");
    if (typeof yearBoundLo === "number") {
      yearLo = yearBoundLo;
      yearHi = yearBoundHi;
      yearMinInput.value = yearLo;
      yearMaxInput.value = yearHi;
      updateYearUI();
    }
    applyArchiveFilters();
  }

  filterResetBtn.addEventListener("click", resetAllFilters);

  function movieQualifies(m) {
    if (searchQuery.length > 0) {
      if (!searchIndex.get(m).includes(searchQuery)) return false;
    }
    if (selectedCountries.size > 0) {
      const flags = extractFlags(m);
      if (!flags.some(f => selectedCountries.has(f))) return false;
    }
    if (selectedAuthors.size > 0) {
      const author = m.author ? m.author.trim() : "";
      if (!selectedAuthors.has(author)) return false;
    }
    if (typeof yearLo === "number" && (m.year < yearLo || m.year > yearHi)) return false;
    return true;
  }

  function applyArchiveFilters() {
    const posterMode = posterModeToggle.checked;
    const showAll = showAllToggle.checked;
    if (posterMode) ensurePosterGridBuilt();
    else closeOpenPosterCard();

    let matchCount = 0;
    let visibleCount = 0;
    const entries = posterMode ? posterEntries : listEntries;

    for (let i = 0; i < entries.length; i++) {
      const { movie, el } = entries[i];
      const ok = movieQualifies(movie);
      if (ok) matchCount++;
      const shouldShow = ok || showAll;
      if (shouldShow) visibleCount++;
      el.classList.toggle("hidden", !shouldShow);
      el.classList.toggle("is-filtered-out", !ok && showAll);
    }

    const total = archiveMovies.length;
    const filtering = hasActiveFilters();
    filterResetBtn.classList.toggle("hidden", !filtering);
    filterCountEl.textContent = filtering
      ? `${matchCount} z ${total} ${pluralizeFilms(total)}`
      : `${total} ${pluralizeFilms(total)}`;

    const anyVisible = visibleCount > 0;
    archiveEmptyText.textContent = total === 0
      ? "Brak omówionych filmów."
      : "Brak filmów spełniających kryteria.";
    archiveEmpty.classList.toggle("hidden", anyVisible);
    archiveEl.classList.toggle("hidden", !anyVisible || posterMode);
    posterGridEl.classList.toggle("hidden", !anyVisible || !posterMode);
  }

  showAllToggle.addEventListener("change", applyArchiveFilters);
  posterModeToggle.addEventListener("change", applyArchiveFilters);

  if (archiveMovies.length === 0) {
    filtersEl.classList.add("hidden");
    archiveEmpty.classList.remove("hidden");
  } else {
    buildArchiveNodes();
    buildCountryFilter();
    buildAuthorFilter();
    buildYearSlider();
    applyArchiveFilters();
  }

  // RANKING VIEW (with localStorage persistence + Pointer Events touch/mouse DnD + ▲/▼ + modal)
  const meetingsView = document.getElementById("meetings-view");
  const rankingView = document.getElementById("ranking-view");
  const rankingEl = document.getElementById("ranking-list");
  const rankingEmpty = document.getElementById("ranking-empty");
  const rankingActions = document.getElementById("ranking-actions");
  const rankingCopyBtn = document.getElementById("ranking-copy-btn");
  const rankingCodeBtn = document.getElementById("ranking-code-btn");
  const rankingRestoreBtn = document.getElementById("ranking-restore-btn");
  const rankingResetBtn = document.getElementById("ranking-reset-btn");
  const meetingsBtn = document.getElementById("toggle-meetings");
  const rankingBtn = document.getElementById("toggle-ranking");

  const defaultRankingCode = encodeRanking(archiveMovies.map(m => movieIdMap.get(m)));
  let rankingMovies = [...archiveMovies];

  // Restore persisted ranking from localStorage if available
  try {
    const savedCode = localStorage.getItem(RANKING_STORAGE_KEY);
    if (savedCode) {
      const resolved = resolveRankingFromCode(savedCode, archiveById, archiveMovies);
      if (resolved) rankingMovies = resolved.movies;
    }
  } catch {
    // Ignore storage errors (private browsing / disabled storage)
  }

  let currentArchiveView = "meetings";
  let suppressNextRankingClick = false;
  let resetConfirmTimer = null;
  let awaitingResetConfirm = false;

  function currentRankingCode() {
    return encodeRanking(rankingMovies.map(m => movieIdMap.get(m)));
  }

  function saveRanking() {
    const code = currentRankingCode();
    try {
      if (code === defaultRankingCode) localStorage.removeItem(RANKING_STORAGE_KEY);
      else localStorage.setItem(RANKING_STORAGE_KEY, code);
    } catch {
      // Ignore storage errors
    }
    updateResetButtonVisibility();
  }

  function updateResetButtonVisibility() {
    const isModified = currentRankingCode() !== defaultRankingCode;
    rankingResetBtn.classList.toggle("hidden", !isModified);
    if (!isModified) clearResetConfirm();
  }

  function clearResetConfirm() {
    clearTimeout(resetConfirmTimer);
    awaitingResetConfirm = false;
    rankingResetBtn.textContent = "Resetuj";
    rankingResetBtn.classList.remove("is-confirming");
  }

  function copyMeetings() {
    if (archiveMovies.length === 0) return;
    const n = archiveMovies.length;
    copyToClipboard(
      buildArchiveCopyText(archiveMovies, globalIndexMap),
      `Skopiowano listę poprzednich spotkań\n${n} ${pluralizeFilms(n)}`
    );
  }
  function copyRanking() {
    if (rankingMovies.length === 0) return;
    const code = currentRankingCode();
    copyToClipboard(buildRankingCopyText(rankingMovies, code), `Ranking skopiowany\nkod: ${code}`);
  }
  function copyRankingCode() {
    if (rankingMovies.length === 0) return;
    const code = currentRankingCode();
    copyToClipboard(code, `Kod skopiowany\n${code}`);
  }

  function setArchiveView(view) {
    currentArchiveView = view;
    const isMeetings = view === "meetings";
    meetingsView.classList.toggle("hidden", !isMeetings);
    rankingView.classList.toggle("hidden", isMeetings);
    meetingsBtn.classList.toggle("is-selected", isMeetings);
    rankingBtn.classList.toggle("is-selected", !isMeetings);
    meetingsBtn.setAttribute("aria-selected", String(isMeetings));
    rankingBtn.setAttribute("aria-selected", String(!isMeetings));
    meetingsBtn.dataset.hint = isMeetings ? "Skopiuj listę poprzednich spotkań" : "Przełącz na spotkania";
    rankingBtn.dataset.hint = !isMeetings ? "Skopiuj listę rankingu filmów" : "Przełącz na ranking";
    hidePosterPopup(true);
    closeOpenPosterCard();
  }

  function syncRankingNumbersAndState() {
    const items = [...rankingEl.querySelectorAll(".ranking-item")];
    const reordered = [];
    items.forEach((item, idx) => {
      const movie = archiveById.get(Number(item.dataset.movieId));
      if (movie) reordered.push(movie);
      const numEl = item.querySelector(".ranking-num");
      if (numEl) numEl.textContent = `${idx + 1}.`;
      const upBtn = item.querySelector(".ranking-move-up");
      const downBtn = item.querySelector(".ranking-move-down");
      if (upBtn) upBtn.disabled = idx === 0;
      if (downBtn) downBtn.disabled = idx === items.length - 1;
    });
    if (reordered.length === rankingMovies.length) {
      rankingMovies = reordered;
    }
    saveRanking();
  }

  function moveRankingItem(li, delta) {
    if (delta < 0 && li.previousElementSibling) {
      rankingEl.insertBefore(li, li.previousElementSibling);
      syncRankingNumbersAndState();
    } else if (delta > 0 && li.nextElementSibling) {
      rankingEl.insertBefore(li.nextElementSibling, li);
      syncRankingNumbersAndState();
    }
  }

  // Unified Pointer Events Drag & Drop (smooth on mobile touch + desktop mouse + auto-scroll)
  let dragState = null;

  function stopAutoScroll() {
    if (dragState && dragState.scrollRaf) {
      cancelAnimationFrame(dragState.scrollRaf);
      dragState.scrollRaf = 0;
    }
  }

  function runAutoScroll() {
    if (!dragState || !dragState.started) return;
    const edge = 84;
    const maxSpeed = 14;
    let dy = 0;
    if (dragState.lastY < edge) {
      dy = -Math.ceil(((edge - dragState.lastY) / edge) * maxSpeed);
    } else if (dragState.lastY > window.innerHeight - edge) {
      dy = Math.ceil(((dragState.lastY - (window.innerHeight - edge)) / edge) * maxSpeed);
    }
    if (dy !== 0) {
      window.scrollBy(0, dy);
      updatePlaceholderPosition(dragState.lastY);
      dragState.scrollRaf = requestAnimationFrame(runAutoScroll);
    } else {
      dragState.scrollRaf = 0;
    }
  }

  function updatePlaceholderPosition(clientY) {
    if (!dragState || !dragState.placeholder) return;
    const siblings = [...rankingEl.querySelectorAll(".ranking-item:not(.is-dragging)")];
    let insertBeforeEl = null;
    for (const child of siblings) {
      const box = child.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) {
        insertBeforeEl = child;
        break;
      }
    }
    if (insertBeforeEl) rankingEl.insertBefore(dragState.placeholder, insertBeforeEl);
    else rankingEl.appendChild(dragState.placeholder);
  }

  function beginDrag(e) {
    if (!dragState || dragState.started) return;
    dragState.started = true;
    _isDraggingAny = true;
    hideHint();
    hidePosterPopup(true);

    const { li, startY, startLeft, startWidth, startHeight, offsetY } = dragState;
    const placeholder = document.createElement("li");
    placeholder.className = "ranking-placeholder";
    placeholder.style.height = `${startHeight}px`;
    rankingEl.insertBefore(placeholder, li);
    dragState.placeholder = placeholder;

    li.classList.add("is-dragging");
    li.style.width = `${startWidth}px`;
    li.style.left = `${startLeft}px`;
    li.style.top = `${startY - offsetY}px`;
    document.body.classList.add("is-ranking-dragging");

    try {
      li.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture isn't supported
    }
  }

  function handleRankingPointerDown(e, li) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest("a, button")) return;
    const isHandle = Boolean(e.target.closest(".ranking-handle"));
    // On touch screens, only dragging via the handle initiates drag so normal scrolling stays native
    if (e.pointerType !== "mouse" && !isHandle) return;

    const rect = li.getBoundingClientRect();
    dragState = {
      li,
      pointerId: e.pointerId,
      isTouch: e.pointerType !== "mouse",
      started: false,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      startLeft: rect.left,
      startWidth: rect.width,
      startHeight: rect.height,
      offsetY: e.clientY - rect.top,
      placeholder: null,
      scrollRaf: 0
    };

    if (dragState.isTouch) {
      e.preventDefault();
      beginDrag(e);
    }

    window.addEventListener("pointermove", handleRankingPointerMove, { passive: false });
    window.addEventListener("pointerup", handleRankingPointerUp);
    window.addEventListener("pointercancel", handleRankingPointerUp);
  }

  function handleRankingPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    if (!dragState.started) {
      const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
      if (dist < 6) return;
      beginDrag(e);
    }
    e.preventDefault();
    dragState.lastY = e.clientY;
    dragState.li.style.top = `${e.clientY - dragState.offsetY}px`;
    updatePlaceholderPosition(e.clientY);
    if (!dragState.scrollRaf) {
      dragState.scrollRaf = requestAnimationFrame(runAutoScroll);
    }
  }

  function handleRankingPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    window.removeEventListener("pointermove", handleRankingPointerMove);
    window.removeEventListener("pointerup", handleRankingPointerUp);
    window.removeEventListener("pointercancel", handleRankingPointerUp);
    stopAutoScroll();

    const { li, placeholder, started } = dragState;
    dragState = null;
    _isDraggingAny = false;
    document.body.classList.remove("is-ranking-dragging");

    if (started) {
      li.classList.remove("is-dragging");
      li.style.width = "";
      li.style.left = "";
      li.style.top = "";
      if (placeholder && placeholder.parentNode) {
        rankingEl.insertBefore(li, placeholder);
        placeholder.remove();
      }
      suppressNextRankingClick = true;
      syncRankingNumbersAndState();
      window.setTimeout(() => { suppressNextRankingClick = false; }, 100);
    }
  }

  function renderRankingList() {
    rankingEl.innerHTML = "";
    const isEmpty = rankingMovies.length === 0;
    rankingEl.classList.toggle("hidden", isEmpty);
    rankingEmpty.classList.toggle("hidden", !isEmpty);
    rankingActions.classList.toggle("hidden", isEmpty);
    if (isEmpty) return;

    const frag = document.createDocumentFragment();
    rankingMovies.forEach((m, i) => {
      const item = buildRankingItem(m, i + 1, movieIdMap.get(m), {
        onMove: moveRankingItem,
        onPointerDown: handleRankingPointerDown,
        shouldSuppressClick: () => suppressNextRankingClick
      });
      frag.appendChild(item);
    });
    rankingEl.appendChild(frag);
    syncRankingNumbersAndState();
  }

  // RESTORE RANKING MODAL (replaces native window.prompt)
  const restoreModal = document.getElementById("restore-modal");
  const restoreInput = document.getElementById("restore-code-input");
  const restoreError = document.getElementById("restore-modal-error");
  const restoreCancelBtn = document.getElementById("restore-modal-cancel");
  const restoreConfirmBtn = document.getElementById("restore-modal-confirm");

  function openRestoreModal() {
    restoreInput.value = "";
    restoreError.textContent = "";
    restoreError.classList.add("hidden");
    restoreModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => restoreInput.focus());
  }

  function closeRestoreModal() {
    if (restoreModal.classList.contains("hidden")) return;
    restoreModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    rankingRestoreBtn.focus();
  }

  function submitRestoreModal() {
    const raw = restoreInput.value;
    if (!raw.trim()) {
      restoreError.textContent = "Wklej kod rankingu.";
      restoreError.classList.remove("hidden");
      restoreInput.focus();
      return;
    }
    const code = extractCodeFromInput(raw);
    const resolved = resolveRankingFromCode(code, archiveById, archiveMovies);
    if (!resolved) {
      restoreError.textContent = "Nieprawidłowy kod — sprawdź, czy został skopiowany w całości.";
      restoreError.classList.remove("hidden");
      restoreInput.focus();
      return;
    }
    rankingMovies = resolved.movies;
    renderRankingList();
    closeRestoreModal();
    const n = resolved.matchedCount;
    showToast(`Ranking wczytany\n${n} ${pluralizeFilms(n)}`);
  }

  restoreCancelBtn.addEventListener("click", closeRestoreModal);
  restoreConfirmBtn.addEventListener("click", submitRestoreModal);
  restoreModal.addEventListener("click", e => {
    if (e.target === restoreModal) closeRestoreModal();
  });
  restoreInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitRestoreModal();
    }
  });
  restoreInput.addEventListener("input", () => {
    if (!restoreError.classList.contains("hidden")) {
      restoreError.classList.add("hidden");
    }
  });

  renderRankingList();
  setArchiveView("meetings");

  meetingsBtn.addEventListener("click", () => {
    if (currentArchiveView === "meetings") copyMeetings();
    else setArchiveView("meetings");
  });
  rankingBtn.addEventListener("click", () => {
    if (currentArchiveView === "ranking") copyRanking();
    else setArchiveView("ranking");
  });
  rankingCopyBtn.addEventListener("click", copyRanking);
  rankingCodeBtn.addEventListener("click", copyRankingCode);
  rankingRestoreBtn.addEventListener("click", openRestoreModal);
  rankingResetBtn.addEventListener("click", () => {
    if (!awaitingResetConfirm) {
      awaitingResetConfirm = true;
      rankingResetBtn.textContent = "Potwierdź reset";
      rankingResetBtn.classList.add("is-confirming");
      resetConfirmTimer = setTimeout(clearResetConfirm, 3000);
      return;
    }
    clearResetConfirm();
    rankingMovies = [...archiveMovies];
    renderRankingList();
    showToast("Przywrócono domyślną kolejność");
  });

  document.getElementById("label-upcoming").addEventListener("click", () => {
    if (upcomingMovies.length === 0) return;
    const count = upcomingMovies.length;
    copyToClipboard(
      buildUpcomingCopyText(upcomingMovies),
      `Skopiowano listę nadchodzących spotkań\n${count} ${pluralizeFilms(count)}`
    );
  });

  initHints();

  // SECRET SCREENSHOT MODE (4 clicks on DKF logo; ESC to exit)
  let dkfClicks = 0;
  let dkfTimer = null;
  const dkfLogo = document.querySelector(".logo-dkf");

  function setScreenshotMode(enabled) {
    document.body.classList.toggle("screenshot-mode", enabled);
    if (enabled) window.scrollTo(0, 0);
    hideHint();
    hidePosterPopup(true);
    showToast(enabled ? "Włączono tryb zrzutu ekranu\nESC aby wyjść" : "Wyłączono tryb zrzutu ekranu");
  }

  if (dkfLogo) {
    dkfLogo.style.cursor = "pointer";
    dkfLogo.addEventListener("click", () => {
      dkfClicks++;
      clearTimeout(dkfTimer);
      if (dkfClicks === 4) {
        setScreenshotMode(true);
        dkfClicks = 0;
      } else {
        dkfTimer = setTimeout(() => { dkfClicks = 0; }, 1000);
      }
    });
  }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!restoreModal.classList.contains("hidden")) {
        closeRestoreModal();
      } else if (document.body.classList.contains("screenshot-mode")) {
        setScreenshotMode(false);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", render);
