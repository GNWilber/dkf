// ============================================================
//  LOGIKA STRONY
// ============================================================

const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];

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

// Format date as DD.MM.YYYY
function formatDate(dateStr) {
  return dateStr; // already in correct format
}

// Movie display name with optional altName
function displayName(movie) {
  return movie.altName ? `${movie.name} (${movie.altName})` : movie.name;
}

// ---- COPY FORMATS ----

function buildUpcomingCopyText(upcomingMovies) {
  return upcomingMovies
    .map(m => {
      const name = displayName(m);
      return `### ${m.date}: [*${name} [${m.year}]*](${m.filmweb})`;
    })
    .join("  \n") + "  \n";
}

function buildArchiveCopyText(archiveMovies, globalIndexMap) {
  // show oldest first for the copy (ascending), each with global number
  return [...archiveMovies]
    .reverse()
    .map(m => {
      const num = globalIndexMap.get(m);
      const name = displayName(m);
      return `## ${num}. ${m.date}: ${name} [${m.year}]`;
    })
    .join("\n");
}

// ---- TOAST ----

function showToast(message) {
  const existing = document.getElementById("copy-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "copy-toast";
  toast.className = "copy-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  // force reflow to trigger transition
  toast.getBoundingClientRect();
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 2200);
}

async function copyToClipboard(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast(successMsg);
  }
}

// ---- CARD BUILDER ----

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
  card.className = "movie-card" + (isToday ? " is-today" : "") + (isPast ? " is-past" : "");

  card.innerHTML = `
    <div class="card-date">
      <span class="date-day">${day}</span>
      <div class="date-gap"></div>
      <span class="date-month-year">${monthFull} ${year}</span>
      ${isToday ? '<span class="badge-today">Dziś!</span>' : ""}
    </div>
    <div class="card-divider"></div>
    <div class="card-info">
      <h2 class="card-title">${movie.name}</h2>
      ${movie.altName ? `<p class="card-alt">${movie.altName}</p>` : ""}
      <p class="card-year">${movie.year}</p>
    </div>
    <a class="card-link" href="${movie.filmweb}" target="_blank" rel="noopener">
      <span>Filmweb</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;

  return card;
}

// ---- ARCHIVE ITEM (numbered) ----

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
    <a href="${movie.filmweb}" target="_blank" rel="noopener" class="archive-link" title="Filmweb">↗</a>
  `;
  return li;
}

// ---- MAIN RENDER ----

function render() {
  const sorted = [...MOVIES].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Global numbering: all movies sorted by date, 1-indexed
  const globalIndexMap = new Map();
  sorted.forEach((m, i) => globalIndexMap.set(m, i + 1));

  const upcomingMovies = sorted.filter(m =>  isUpcoming(parseDate(m.date)));
  const archiveMovies  = sorted.filter(m => !isUpcoming(parseDate(m.date))).reverse(); // newest first for display

  // --- Upcoming cards ---
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

  // --- Archive list (no pagination, numbered) ---
  const archiveEl    = document.getElementById("archive-list");
  const archiveEmpty = document.getElementById("archive-empty");

  if (archiveMovies.length === 0) {
    archiveEmpty.classList.remove("hidden");
  } else {
    archiveMovies.forEach(m => {
      archiveEl.appendChild(buildArchiveItem(m, globalIndexMap.get(m)));
    });
  }

  // --- Clickable labels ---
  const upcomingLabel = document.getElementById("label-upcoming");
  upcomingLabel.addEventListener("click", () => {
    const text = buildUpcomingCopyText(upcomingMovies);
    copyToClipboard(text, "✓ Nadchodzące filmy skopiowane!");
  });

  const archiveLabel = document.getElementById("label-archive");
  archiveLabel.addEventListener("click", () => {
    const text = buildArchiveCopyText(archiveMovies, globalIndexMap);
    copyToClipboard(text, "✓ Lista omówionych filmów skopiowana!");
  });
}

document.addEventListener("DOMContentLoaded", render);
