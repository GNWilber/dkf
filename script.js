// ============================================================
//  DYSKUSYJNY KLUB FILMOWY — logika strony v6
// ============================================================

const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];

// ---- DATE HELPERS ----

function parseDate(str) {
  const [d, m, y] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}

function isUpcoming(movieDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 1);
  return movieDate >= cutoff;
}

function getNextMovie(sortedMovies) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sortedMovies.find(m => parseDate(m.date) >= today) || null;
}

// ---- DISPLAY HELPERS ----

function displayName(movie) {
  return movie.altName ? `${movie.name} (${movie.altName})` : movie.name;
}

// ---- COPY FORMAT BUILDERS ----

function buildUpcomingCopyText(upcomingMovies) {
  return upcomingMovies
    .map(m => {
      const name = displayName(m);
      return `### ${m.date}: [*${name} [${m.year}]*](${m.filmweb})`;
    })
    .join("  \n") + "  \n";
}

function buildArchiveCopyText(archiveMovies, globalIndexMap) {
  return [...archiveMovies]
    .reverse()
    .map(m => {
      const num = globalIndexMap.get(m);
      const name = displayName(m);
      return `${num}. ${m.date}: ${name} [${m.year}]`;
    })
    .join("\n");
}

/** Ranking format — NO dates, numbered top-down in current ranking order. */
function buildRankingCopyText(rankingMovies) {
  return rankingMovies
    .map((m, i) => {
      const name = displayName(m);
      return `${i + 1}. ${name} [${m.year}]`;
    })
    .join("\n");
}

// ============================================================
//  TOAST SYSTEM
// ============================================================

let _toastTimer = null;

function showToast(message) {
  const footer = document.querySelector("footer");

  if (footer) {
    const toastMsg = footer.querySelector(".footer-toast-msg");
    toastMsg.textContent = message;
    footer.classList.add("toast-active");

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      footer.classList.remove("toast-active");
    }, 2400);

    return;
  }

  const existing = document.getElementById("copy-toast");
  if (existing) existing.remove();

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

// ============================================================
//  CARD BUILDER
// ============================================================

function buildCard(movie) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const monthFull = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();
  const isPast  = date < today;

  const card = document.createElement("article");
  card.className =
    "movie-card" +
    (isToday ? " is-today" : "") +
    (isPast   ? " is-past"  : "");

  card.innerHTML = `
    <div class="card-date">
      <span class="date-day">${day}</span>
      <div class="date-gap"></div>
      <span class="date-month-year">${monthFull} ${year}</span>
      ${isToday ? '<span class="badge-today">‎ Dziś!</span>' : ""}
    </div>
    <div class="card-divider"></div>
    <div class="card-info">
      <h2 class="card-title">${movie.name}</h2>
      ${movie.altName ? `<p class="card-alt">${movie.altName}</p>` : ""}
      <p class="card-year">${movie.year}</p>
    </div>
    <a class="card-link" href="${movie.filmweb}" target="_blank" rel="noopener" title="Otwórz na Filmweb">
      <img src="filmwebfull.svg" alt="Filmweb" class="filmweb-logo-full" />
    </a>
  `;

  card.querySelector(".card-link").addEventListener("click", e => e.stopPropagation());

  card.addEventListener("click", () => {
    const text = `${displayName(movie)} [${movie.year}]`;
    copyToClipboard(text, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  return card;
}

// ============================================================
//  ARCHIVE / RANKING ITEM BUILDER
// ============================================================

function buildArchiveItem(movie, num, draggable) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const li = document.createElement("li");
  li.className = "archive-item" + (draggable ? " is-draggable" : "");
  li._movie = movie;

  li.innerHTML = `
    ${draggable ? '<span class="archive-drag-handle" title="Przeciągnij, aby zmienić pozycję">⋮⋮</span>' : ''}
    <span class="archive-num">${num}.</span>
    <span class="archive-date">${day} ${month} ${year}</span>
    <span class="archive-dot"></span>
    <span class="archive-title">
      ${movie.name}
      ${movie.altName ? `<span class="archive-alt">/ ${movie.altName}</span>` : ""}
      <span class="archive-year">(${movie.year})</span>
    </span>
    <a href="${movie.filmweb}" target="_blank" rel="noopener" class="archive-link" title="Otwórz na Filmweb">
      <img src="filmweb.svg" alt="Filmweb" class="filmweb-logo-sq" />
    </a>
  `;

  li.querySelector(".archive-link").addEventListener("click", e => e.stopPropagation());

  li.addEventListener("click", () => {
    const text = `${displayName(movie)} [${movie.year}]`;
    copyToClipboard(text, `Skopiowano\n${displayName(movie)} [${movie.year}]`);
  });

  if (draggable) {
    attachDragHandlers(li);
  }

  return li;
}

// ============================================================
//  DRAG & DROP (HTML5)
// ============================================================

let _draggedEl = null;

function attachDragHandlers(li) {
  li.draggable = true;

  li.addEventListener("dragstart", e => {
    _draggedEl = li;
    // Defer adding the dragging class so the drag image looks normal
    setTimeout(() => li.classList.add("dragging"), 0);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", ""); } catch {}
  });

  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    _draggedEl = null;
    syncRankingFromDOM();
  });

  li.addEventListener("dragover", e => {
    e.preventDefault();
    if (!_draggedEl || _draggedEl === li) return;

    const rect = li.getBoundingClientRect();
    const after = (e.clientY - rect.top) > rect.height / 2;
    const list = li.parentNode;

    if (after && li.nextSibling !== _draggedEl) {
      list.insertBefore(_draggedEl, li.nextSibling);
      updateRankingNumbers();
    } else if (!after && li.previousSibling !== _draggedEl) {
      list.insertBefore(_draggedEl, li);
      updateRankingNumbers();
    }
  });

  // NOTE: HTML5 native drag does not work on most touch devices.
  // For touch support, you'd plug pointer/touch handlers in here.
}

function updateRankingNumbers() {
  const items = document.querySelectorAll("#archive-list .archive-item");
  items.forEach((it, idx) => {
    const numEl = it.querySelector(".archive-num");
    if (numEl) numEl.textContent = (idx + 1) + ".";
  });
}

function syncRankingFromDOM() {
  const items = document.querySelectorAll("#archive-list .archive-item");
  rankingOrder = Array.from(items).map(it => it._movie);
  updateRankingNumbers();
}

// ============================================================
//  STICKY FOOTER
// ============================================================

function isAnnouncementActive() {
  if (typeof ANNOUNCEMENT === "undefined" || !ANNOUNCEMENT || !ANNOUNCEMENT.trim()) return false;
  if (typeof ANNOUNCEMENT_EXPIRY === "undefined" || !ANNOUNCEMENT_EXPIRY) return true;
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
          <span class="footer-label footer-announce-label">
            <span class="footer-announce-dot"></span>Ogłoszenie
          </span>
          <div class="footer-divider"></div>
          <span class="footer-announce-text">${ANNOUNCEMENT}</span>
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
            <span class="footer-date">${day} ${monthFull} ${year}</span>
            <span class="footer-sep">·</span>
            <span class="footer-title">${nextMovie.name}</span>
            ${nextMovie.altName ? `<span class="footer-alt">${nextMovie.altName}</span>` : ""}
            <span class="footer-year">${nextMovie.year}</span>
          </div>
          <div class="footer-divider"></div>
          <a class="footer-fw-link" href="${nextMovie.filmweb}" target="_blank" rel="noopener" title="Filmweb">
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

// ============================================================
//  ARCHIVE / RANKING STATE & RENDERING
// ============================================================

let currentMode = "archive";       // "archive" | "ranking"
let archiveMovies = [];            // newest → oldest
let globalIndexMap = new Map();
let rankingOrder = [];             // user-customizable

function renderArchiveList() {
  const archiveEl = document.getElementById("archive-list");
  archiveEl.innerHTML = "";

  if (archiveMovies.length === 0) return;

  if (currentMode === "archive") {
    archiveMovies.forEach(m => {
      archiveEl.appendChild(buildArchiveItem(m, globalIndexMap.get(m), false));
    });
  } else {
    rankingOrder.forEach((m, i) => {
      archiveEl.appendChild(buildArchiveItem(m, i + 1, true));
    });
  }
}

function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  const labelArchive = document.getElementById("label-archive");
  const labelRanking = document.getElementById("label-ranking");
  const rankingActions = document.getElementById("ranking-actions");
  const archiveSection = document.querySelector(".archive-section");

  labelArchive.classList.toggle("is-active", mode === "archive");
  labelRanking.classList.toggle("is-active", mode === "ranking");

  labelArchive.title = mode === "archive"
    ? "Kliknij, aby skopiować do schowka"
    : "Kliknij, aby przełączyć";
  labelRanking.title = mode === "ranking"
    ? "Kliknij, aby skopiować ranking"
    : "Kliknij, aby przełączyć";

  rankingActions.classList.toggle("hidden", mode !== "ranking");
  archiveSection.classList.toggle("is-ranking", mode === "ranking");

  renderArchiveList();
}

function copyArchive() {
  if (archiveMovies.length === 0) return;
  const text = buildArchiveCopyText(archiveMovies, globalIndexMap);
  copyToClipboard(text, `Archiwum skopiowane\n${archiveMovies.length} filmów`);
}

function copyRanking() {
  if (rankingOrder.length === 0) return;
  const text = buildRankingCopyText(rankingOrder);
  copyToClipboard(text, `Ranking skopiowany\n${rankingOrder.length} filmów`);
}

// ============================================================
//  MAIN RENDER
// ============================================================

function render() {
  const sorted = [...MOVIES].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  globalIndexMap = new Map();
  sorted.forEach((m, i) => globalIndexMap.set(m, i + 1));

  const upcomingMovies = sorted.filter(m =>  isUpcoming(parseDate(m.date)));
  archiveMovies        = sorted.filter(m => !isUpcoming(parseDate(m.date))).reverse(); // newest first
  rankingOrder         = [...archiveMovies]; // default: newest → oldest, ranked 1..N top-down

  renderFooter(getNextMovie(sorted));

  // ---- Upcoming cards ----
  const upcomingEl    = document.getElementById("upcoming-cards");
  const upcomingEmpty = document.getElementById("upcoming-empty");

  if (upcomingMovies.length === 0) {
    upcomingEmpty.classList.remove("hidden");
  } else {
    upcomingMovies.forEach((m, i) => {
      const card = buildCard(m);
      card.style.animationDelay = `${i * 0.1}s`;
      upcomingEl.appendChild(card);
    });
  }

  // ---- Archive / Ranking ----
  const archiveEmpty = document.getElementById("archive-empty");
  if (archiveMovies.length === 0) {
    archiveEmpty.classList.remove("hidden");
  } else {
    renderArchiveList();
  }

  // ---- Section labels ----
  document.getElementById("label-upcoming").addEventListener("click", () => {
    if (upcomingMovies.length === 0) return;
    const text = buildUpcomingCopyText(upcomingMovies);
    const count = upcomingMovies.length;
    copyToClipboard(
      text,
      `Plan spotkań skopiowany\n${count} ${count === 1 ? "seans" : "seanse"}`
    );
  });

  // Toggle: click selected = copy, click non-selected = switch
  document.getElementById("label-archive").addEventListener("click", () => {
    if (currentMode !== "archive") {
      setMode("archive");
      return;
    }
    copyArchive();
  });

  document.getElementById("label-ranking").addEventListener("click", () => {
    if (currentMode !== "ranking") {
      setMode("ranking");
      return;
    }
    copyRanking();
  });

  document.getElementById("ranking-copy-btn").addEventListener("click", e => {
    e.stopPropagation();
    copyRanking();
  });
}

document.addEventListener("DOMContentLoaded", render);