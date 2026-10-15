// Mt Zion House of Prayer — fills in the sermon and bulletin lists from data/*.json.
// You shouldn't need to edit this file to add a sermon or bulletin; edit the JSON instead.

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function load(name) {
  const res = await fetch(`data/${name}.json`);
  return res.json();
}

function sermonItem(s) {
  const bits = [fmtDate(s.date), s.speaker, s.passage].filter(Boolean).map(esc).join(" · ");
  return `<li class="sermon">
    <div><h3>${esc(s.title)}</h3><div class="meta">${bits}</div></div>
    <button class="play" data-audio="${esc(s.audio)}">▶ Listen${s.length ? " · " + esc(s.length.replace(/^00:/, "")) : ""}</button>
  </li>`;
}

// Swap a Listen button for a real audio player only when clicked, so the page doesn't load 250 players.
document.addEventListener("click", e => {
  const btn = e.target.closest(".play");
  if (!btn) return;
  document.querySelectorAll(".sermon audio").forEach(a => a.pause());
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.src = btn.dataset.audio;
  btn.closest(".sermon").appendChild(audio);
  btn.remove();
  audio.play();
});

// Home page: latest sermon + latest bulletin
async function initHome() {
  const s = document.getElementById("latest-sermon");
  const b = document.getElementById("latest-bulletin");
  if (s) {
    const [latest] = await load("sermons");
    s.innerHTML = latest ? `<ul class="list">${sermonItem(latest)}</ul>` : "";
  }
  if (b) {
    const [latest] = await load("bulletins");
    b.innerHTML = latest
      ? `<p>Bulletin for <strong>${fmtDate(latest.date)}</strong></p>
      <a class="btn" href="${esc(latest.file)}" target="_blank" rel="noopener">Open bulletin</a>`
      : `<p class="meta">No bulletin posted yet this week.</p>`;
  }
}

// Sermons page: search, speaker filter, show 20 at a time
async function initSermons() {
  const list = document.getElementById("sermon-list");
  if (!list) return;
  const all = await load("sermons");
  const q = document.getElementById("sermon-search");
  const who = document.getElementById("sermon-speaker");
  const more = document.getElementById("sermon-more");
  const counts = {};
  all.forEach(s => s.speaker && (counts[s.speaker] = (counts[s.speaker] || 0) + 1));
  Object.keys(counts).sort().forEach(n => who.add(new Option(`${n} (${counts[n]})`, n)));

  let shown = 20;
  function render() {
    const term = q.value.trim().toLowerCase();
    const hits = all.filter(s =>
      (!who.value || s.speaker === who.value) &&
      (!term || `${s.title} ${s.speaker} ${s.passage}`.toLowerCase().includes(term)));
    list.innerHTML = hits.slice(0, shown).map(sermonItem).join("") || `<li class="empty">No sermons match that search.</li>`;
    more.hidden = hits.length <= shown;
  }
  q.addEventListener("input", () => { shown = 20; render(); });
  who.addEventListener("change", () => { shown = 20; render(); });
  more.querySelector("button").addEventListener("click", () => { shown += 20; render(); });
  render();
}

// Bulletins page: grouped by year
async function initBulletins() {
  const box = document.getElementById("bulletin-list");
  if (!box) return;
  // Only the last 3 months are shown. A weekly GitHub job (scripts/prune_bulletins.py)
  // also deletes older PDFs, so this filter just covers the days in between.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const recent = (await load("bulletins")).filter(b => {
    const [y, m, d] = b.date.split("-").map(Number);
    return new Date(y, m - 1, d) >= cutoff;
  });
  box.innerHTML = recent.length
    ? `<div class="bulletins">${recent.map(b =>
        `<a href="${esc(b.file)}" target="_blank" rel="noopener">${fmtDate(b.date)}</a>`).join("")}</div>`
    : `<p class="empty">No recent bulletins posted.</p>`;
}

// "Listen on Apple Podcasts / Spotify" links. Hidden until the show's addresses are
// filled in data/podcast.json (apple_url, spotify_url) — then they appear everywhere.
async function initListenLinks() {
  const cfg = await fetch("data/podcast.json").then(r => r.json()).catch(() => ({}));
  const icon = {
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#9933CC"/><circle cx="12" cy="10" r="2.6" fill="#fff"/><path d="M10.6 14h2.8l-.5 5.5h-1.8z" fill="#fff"/><path d="M7.3 13.8a5.6 5.6 0 1 1 9.4 0" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1DB954"/><path d="M6.5 9.3c3.8-1.1 8-.8 11.2 1M7.2 12.4c3.1-.9 6.4-.6 9.1.9M7.9 15.3c2.4-.6 4.9-.4 6.9.7" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  };
  const links = [["apple", "Apple Podcasts", cfg.apple_url], ["spotify", "Spotify", cfg.spotify_url]]
    .filter(([, , url]) => url)
    .map(([k, name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${icon[k]}${name}</a>`);
  if (!links.length) return;
  document.querySelectorAll(".listen-links").forEach(el => {
    el.innerHTML = `<span class="label">Subscribe:</span>${links.join("")}`;
    el.hidden = false;
  });
  document.querySelectorAll(".footer-podcast").forEach(el => {
    el.innerHTML = [["Apple Podcasts", cfg.apple_url], ["Spotify", cfg.spotify_url]]
      .filter(([, u]) => u).map(([n, u]) => ` · <a href="${esc(u)}">${n}</a>`).join("");
  });
}

// Phone menu (the ☰ button)
const menuBtn = document.querySelector(".menu-btn");
if (menuBtn) menuBtn.addEventListener("click", () => {
  const nav = document.querySelector(".site-nav");
  menuBtn.setAttribute("aria-expanded", nav.classList.toggle("open"));
});

initHome();
initListenLinks();
initSermons();
initBulletins();
