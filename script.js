// ============================================================
//  LOGIKA STRONY — nie trzeba tu nic zmieniać
// ============================================================

const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
];

const POLISH_MONTHS_SHORT = [
  "sty", "lut", "mar", "kwi", "maj", "cze",
  "lip", "sie", "wrz", "paź", "lis", "gru"
];

function parseDate(str) {
  const [d, m, y] = str.split(".").map(Number);
  return new Date(y, m - 1, d);
}

function isUpcoming(movieDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 1); // yesterday = still shown
  return movieDate >= cutoff;
}

function buildCard(movie) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const monthShort = POLISH_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();
  const isPast = date < today;

  const card = document.createElement("article");
  card.className = "movie-card" + (isToday ? " is-today" : "") + (isPast ? " is-past" : "");

  card.innerHTML = `
    <div class="card-date">
      <span class="date-day">${day}</span>
      <span class="date-month-year">${monthShort} ${year}</span>
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;

  return card;
}

function buildArchiveItem(movie) {
  const date = parseDate(movie.date);
  const day = date.getDate();
  const month = POLISH_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const li = document.createElement("li");
  li.className = "archive-item";

  li.innerHTML = `
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

function updateCurrentDate() {
  const now = new Date();
  const day = now.getDate();
  const month = POLISH_MONTHS[now.getMonth()];
  const year = now.getFullYear();
  const el = document.getElementById("current-date-display");
  if (el) el.textContent = `${day} ${month} ${year}`;
}

function render() {
  updateCurrentDate();

  const sorted = [...MOVIES].sort((a, b) => parseDate(a.date) - parseDate(b.date));

  const upcoming = sorted.filter(m => isUpcoming(parseDate(m.date)));
  const archive = sorted.filter(m => !isUpcoming(parseDate(m.date)));

  const upcomingEl = document.getElementById("upcoming-cards");
  const archiveEl = document.getElementById("archive-list");
  const upcomingEmpty = document.getElementById("upcoming-empty");
  const archiveEmpty = document.getElementById("archive-empty");

  if (upcoming.length === 0) {
    upcomingEmpty.classList.remove("hidden");
  } else {
    upcoming.forEach((m, i) => {
      const card = buildCard(m);
      card.style.animationDelay = `${i * 0.1}s`;
      upcomingEl.appendChild(card);
    });
  }

  if (archive.length === 0) {
    archiveEmpty.classList.remove("hidden");
  } else {
    archive.reverse().forEach(m => archiveEl.appendChild(buildArchiveItem(m)));
  }
}

document.addEventListener("DOMContentLoaded", render);
