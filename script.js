// ============================================================
//  DYSKUSYJNY KLUB FILMOWY — logika strony v5
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

/** Upcoming = today or later (including yesterday for the card display buffer). */
function isUpcoming(movieDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 1);
  return movieDate >= cutoff;
}

/** Returns the first movie that is today or in the future (strict). */
function getNextMovie(sortedMovies) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sortedMovies.find(m => parseDate(m.date) >= today) || null;
}

// ---- DISPLAY HELPERS ----

/** "Incepcja" or "Incepcja (Inception)" */
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

// ============================================================
//  TOAST SYSTEM
//  — when footer is present: slides over footer content
//  — when no footer: classic floating toast from bottom
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

  // ---- Floating fallback (no footer) ----
  const existing = document.getElementById("copy-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "copy-toast";
  toast.className = "copy-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  // Force reflow to trigger transition
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
    // Fallback for older browsers / non-HTTPS
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

  // Filmweb link — open in new tab, don't trigger card copy
  card.querySelector(".card-link").addEventListener("click", e => e.stopPropagation());

  // Clicking anywhere else copies the title
  card.addEventListener("click", () => {
    const text = `${displayName(movie)} [${movie.year}]`;
    copyToClipboard(text, `Skopiowano — ${displayName(movie)} [${movie.year}]`);
  });

  return card;
}

// ============================================================
//  ARCHIVE ITEM BUILDER
// ============================================================

function buildArchiveItem(movie, globalNum) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const li = document.createElement("li");
  li.className = "archive-item";
  li.innerHTML = `
    <span class="archive-num">${globalNum}.</span>
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

  // Filmweb link — open in new tab, don't trigger copy
  li.querySelector(".archive-link").addEventListener("click", e => e.stopPropagation());

  // Clicking the row copies the title
  li.addEventListener("click", () => {
    const text = `${displayName(movie)} [${movie.year}]`;
    copyToClipboard(text, `Skopiowano — ${displayName(movie)} [${movie.year}]`);
  });

  return li;
}

// ============================================================
//  STICKY FOOTER — next upcoming movie
// ============================================================

function renderFooter(nextMovie) {
  if (!nextMovie) return; // No footer when nothing is upcoming

  const date = parseDate(nextMovie.date);
  const day = date.getDate();
  const monthFull = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();

  const footer = document.createElement("footer");
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

  document.body.appendChild(footer);
  document.body.classList.add("has-footer");
}

// ============================================================
//  MAIN RENDER
// ============================================================

function render() {
  const sorted = [...MOVIES].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Global index map: each movie → its position (1-indexed) in chronological order
  const globalIndexMap = new Map();
  sorted.forEach((m, i) => globalIndexMap.set(m, i + 1));

  const upcomingMovies = sorted.filter(m =>  isUpcoming(parseDate(m.date)));
  const archiveMovies  = sorted.filter(m => !isUpcoming(parseDate(m.date))).reverse(); // newest first

  // ---- Sticky footer (next film, strictly today or future) ----
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

  // ---- Archive list ----
  const archiveEl    = document.getElementById("archive-list");
  const archiveEmpty = document.getElementById("archive-empty");

  if (archiveMovies.length === 0) {
    archiveEmpty.classList.remove("hidden");
  } else {
    archiveMovies.forEach(m => {
      archiveEl.appendChild(buildArchiveItem(m, globalIndexMap.get(m)));
    });
  }

  // ---- Clickable section labels ----
  document.getElementById("label-upcoming").addEventListener("click", () => {
    if (upcomingMovies.length === 0) return;
    const text = buildUpcomingCopyText(upcomingMovies);
    const count = upcomingMovies.length;
    copyToClipboard(
      text,
      `Plan spotkań skopiowany — ${count} ${count === 1 ? "seans" : "seanse"}`
    );
  });

  document.getElementById("label-archive").addEventListener("click", () => {
    if (archiveMovies.length === 0) return;
    const text = buildArchiveCopyText(archiveMovies, globalIndexMap);
    copyToClipboard(
      text,
      `Archiwum skopiowane — ${archiveMovies.length} filmów`
    );
  });
}

document.addEventListener("DOMContentLoaded", render);
