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
    if (latest) b.innerHTML = `<p>Bulletin for <strong>${fmtDate(latest.date)}</strong></p>
      <a class="btn" href="${esc(latest.file)}" target="_blank" rel="noopener">Open bulletin</a>`;
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
  const all = await load("bulletins");
  const years = {};
  all.forEach(b => (years[b.date.slice(0, 4)] ||= []).push(b));
  box.innerHTML = Object.keys(years).sort().reverse().map(y => `
    <div class="year"><h2>${y}</h2><div class="bulletins">
      ${years[y].map(b => `<a href="${esc(b.file)}" target="_blank" rel="noopener">${fmtDate(b.date).replace(/, \d{4}$/, "")}</a>`).join("")}
    </div></div>`).join("");
}

// Phone menu (the ☰ button)
const menuBtn = document.querySelector(".menu-btn");
if (menuBtn) menuBtn.addEventListener("click", () => {
  const nav = document.querySelector(".site-nav");
  menuBtn.setAttribute("aria-expanded", nav.classList.toggle("open"));
});

initHome();
initSermons();
initBulletins();
