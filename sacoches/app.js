// Les Points Sacoches 👜 — app principale (SPA sans build)

import { createBackend, DEVICE_ID } from "./db.js";

export const PLAYERS = [
  "Côme", "Paul", "Gaspard", "Erwann", "Timothée",
  "Ihsane", "Jacques", "Nico", "Vianney",
];

const REACTIONS = [
  { key: "laugh", emoji: "😂" },
  { key: "up", emoji: "👍" },
  { key: "skull", emoji: "💀" },
  { key: "bag", emoji: "👜" },
];

const SUPER_PTS = 5;

let backend = null;
let points = [];
let activity = [];
let knownIds = null; // null tant que le 1er snapshot n'est pas arrivé
let lastRoute = null;

const $view = document.getElementById("view");
const $banner = document.getElementById("banner");
const $fab = document.getElementById("fab");
const $modalRoot = document.getElementById("modal-root");
const $toastRoot = document.getElementById("toast-root");
const $notifBtn = document.getElementById("notif-btn");

// ---------------------------------------------------------------- utils

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const plural = (n) => (n > 1 ? "s" : "");

function fmtDate(ms) {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24 && d.getDate() === new Date().getDate()) return `il y a ${h} h`;
  return d.toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short",
  }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(ms) {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function toast(msg) {
  $toastRoot.innerHTML = `<div class="toast">${msg}</div>`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ($toastRoot.innerHTML = ""), 2600);
}

function confetti() {
  const emojis = ["👜", "🔥", "✨", "👜", "💥"];
  for (let i = 0; i < 26; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.textContent = emojis[i % emojis.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
    el.style.animationDelay = Math.random() * 0.5 + "s";
    el.style.fontSize = 1.1 + Math.random() * 1.4 + "rem";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// Réactions que CET appareil a posées (pour le toggle + surbrillance)
function myReactions() {
  try {
    return JSON.parse(localStorage.getItem("sacoches-myreactions")) || {};
  } catch {
    return {};
  }
}
function setMyReaction(pointId, key, on) {
  const all = myReactions();
  all[pointId] = all[pointId] || {};
  if (on) all[pointId][key] = true;
  else delete all[pointId][key];
  localStorage.setItem("sacoches-myreactions", JSON.stringify(all));
}

// ---------------------------------------------------------------- calculs

function totals() {
  const map = Object.fromEntries(PLAYERS.map((p) => [p, { pts: 0, supers: 0, count: 0 }]));
  for (const p of points) {
    if (!map[p.player]) continue;
    map[p.player].pts += p.pts;
    map[p.player].count++;
    if (p.pts === SUPER_PTS) map[p.player].supers++;
  }
  return map;
}

function ranking() {
  const t = totals();
  return [...PLAYERS].sort(
    (a, b) => t[b].pts - t[a].pts || a.localeCompare(b, "fr")
  ).map((name) => ({ name, ...t[name] }));
}

// ---------------------------------------------------------------- rendu

function render() {
  const route = location.hash || "#/";
  const keepScroll = route === lastRoute ? window.scrollY : 0;
  lastRoute = route;

  const mPlayer = route.match(/^#\/j\/(.+)$/);
  if (route === "#/stats") renderStats();
  else if (route === "#/historique") renderActivity();
  else if (mPlayer) renderPlayer(decodeURIComponent(mPlayer[1]));
  else renderHome();

  window.scrollTo(0, keepScroll);
}

function renderHome() {
  const rank = ranking();
  const [p1, p2, p3] = rank;
  const hasPoints = points.length > 0;

  const podium = hasPoints
    ? `<div class="podium">
        ${podiumSlot(p2, 2)}${podiumSlot(p1, 1)}${podiumSlot(p3, 3)}
      </div>`
    : `<div class="empty"><span class="big">👜</span>
        Aucun point sacoche pour l’instant…<br>Ça ne va pas durer. Ajoute le premier !</div>`;

  const list = rank
    .map(
      (r, i) => `
      <a class="rank-card" href="#/j/${encodeURIComponent(r.name)}">
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-name">${esc(r.name)}
          ${i === 0 && r.pts > 0 ? "👑" : ""}
          ${r.supers > 0 ? `<span class="rank-supers">🔥 ${r.supers}</span>` : ""}
        </span>
        <span class="rank-pts">${r.pts}<small>pt${plural(r.pts)}</small></span>
      </a>`
    )
    .join("");

  $view.innerHTML = `
    ${podium}
    <div class="ranking">${list}</div>
    ${navHtml("home")}`;
}

function navHtml(active) {
  return `
    <nav class="subnav">
      <a class="${active === "home" ? "active" : ""}" href="#/">🏆 Classement</a>
      <a class="${active === "log" ? "active" : ""}" href="#/historique">🕰️ Journal</a>
      <a class="${active === "stats" ? "active" : ""}" href="#/stats">📊 Stats</a>
    </nav>`;
}

function podiumSlot(r, pos) {
  if (!r) return "<div></div>";
  const medal = pos === 1 ? `<span class="crown">👑</span>` : `<span class="podium-medal">${pos === 2 ? "🥈" : "🥉"}</span>`;
  const label = pos === 1 ? "LE PLUS SACOCHE" : pos === 2 ? "2ᵉ" : "3ᵉ";
  return `
    <a class="podium-slot p${pos}" href="#/j/${encodeURIComponent(r.name)}">
      ${medal}
      <div class="podium-box">
        <span class="podium-name">${esc(r.name)}</span>
        <span class="podium-pts">${r.pts}</span>
        <span class="podium-label">${label}</span>
      </div>
    </a>`;
}

function renderPlayer(name) {
  if (!PLAYERS.includes(name)) {
    location.hash = "#/";
    return;
  }
  const t = totals()[name];
  const history = points.filter((p) => p.player === name);

  $view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/" aria-label="Retour au classement">←</a>
      <h2>${esc(name)} ${t.supers > 0 ? "🔥" : ""}</h2>
      <span class="player-total">${t.pts} pt${plural(t.pts)}</span>
    </div>
    ${
      history.length
        ? `<div class="history">${history.map(pointCard).join("")}</div>`
        : `<div class="empty"><span class="big">😇</span>${esc(name)} est clean.<br>Pour l’instant.</div>`
    }`;
  bindPointCards();
}

function pointCard(p, { showName = false } = {}) {
  const isSuper = p.pts === SUPER_PTS;
  const mine = myReactions()[p.id] || {};
  const reactions = REACTIONS.map((r) => {
    const count = p.reactions?.[r.key] || 0;
    return `<button class="react-btn ${mine[r.key] ? "mine" : ""}" data-react="${r.key}" data-id="${esc(p.id)}" aria-label="Réagir ${r.emoji}">
      ${r.emoji}${count > 0 ? `<span class="react-count">${count}</span>` : ""}
    </button>`;
  }).join("");

  return `
    <article class="point-card ${isSuper ? "super" : ""}">
      <div class="point-top">
        <div class="point-who">
          <div class="point-player">${
            showName
              ? `<a href="#/j/${encodeURIComponent(p.player)}">${esc(p.player)}</a>`
              : esc(p.player)
          } ${isSuper ? "🔥👜" : ""}</div>
          <div class="point-date">${fmtDate(p.at)}</div>
        </div>
        <span class="pts-badge ${isSuper ? "super" : ""}">${isSuper ? "SUPER SACOCHE +5" : `+${p.pts} pt${plural(p.pts)}`}</span>
      </div>
      <p class="point-note">${esc(p.note)}</p>
      <div class="point-actions">
        ${reactions}
        <button class="del-btn" data-del="${esc(p.id)}" aria-label="Supprimer ce point">🗑️</button>
      </div>
    </article>`;
}

function bindPointCards() {
  $view.querySelectorAll("[data-react]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { react: key, id } = btn.dataset;
      const on = !(myReactions()[id]?.[key]);
      setMyReaction(id, key, on);
      backend.react(id, key, on ? 1 : -1).catch(console.error);
      // rendu optimiste immédiat
      const p = points.find((p) => p.id === id);
      if (p) p.reactions[key] = Math.max(0, (p.reactions[key] || 0) + (on ? 1 : -1));
      render();
    });
  });
  $view.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.del));
  });
}

// ------------------------------------------------------------- journal

function renderActivity() {
  const items = activity
    .map((e) => {
      const isSuper = e.pts === SUPER_PTS;
      if (e.type === "suppression") {
        return `
          <article class="point-card log-del">
            <div class="point-top">
              <div class="point-who">
                <div class="point-player">🗑️ Point de ${esc(e.player)} supprimé</div>
                <div class="point-date">${fmtDate(e.at)}</div>
              </div>
              <span class="pts-badge del">−${e.pts} pt${plural(e.pts)}</span>
            </div>
            <p class="point-note">« ${esc(e.note)} »</p>
          </article>`;
      }
      return `
        <article class="point-card ${isSuper ? "super" : ""}">
          <div class="point-top">
            <div class="point-who">
              <div class="point-player">➕ <a href="#/j/${encodeURIComponent(e.player)}">${esc(e.player)}</a> ${isSuper ? "🔥👜" : ""}</div>
              <div class="point-date">${fmtDate(e.at)}</div>
            </div>
            <span class="pts-badge ${isSuper ? "super" : ""}">${isSuper ? "SUPER SACOCHE +5" : `+${e.pts} pt${plural(e.pts)}`}</span>
          </div>
          <p class="point-note">${esc(e.note)}</p>
        </article>`;
    })
    .join("");

  $view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/" aria-label="Retour au classement">←</a>
      <h2>🕰️ Journal</h2>
    </div>
    ${
      activity.length
        ? `<div class="history">${items}</div>`
        : `<div class="empty"><span class="big">🕰️</span>Rien dans le journal pour l’instant.<br>Chaque ajout et chaque suppression s’inscrira ici.</div>`
    }
    ${navHtml("log")}`;
}

// ---------------------------------------------------------------- stats

function renderStats() {
  if (!points.length) {
    $view.innerHTML = `
      <div class="page-head">
        <a class="back" href="#/" aria-label="Retour au classement">←</a>
        <h2>📊 Statistiques</h2>
      </div>
      <div class="empty"><span class="big">📊</span>Pas encore de données.<br>Distribuez des points sacoches !</div>`;
    return;
  }

  const rank = ranking();
  const totalPts = rank.reduce((s, r) => s + r.pts, 0);
  const totalSupers = rank.reduce((s, r) => s + r.supers, 0);
  const avg = totalPts / PLAYERS.length;

  // Record du mois : celui qui a pris le plus de points ce mois-ci
  const now = new Date();
  const monthPts = {};
  for (const p of points) {
    const d = new Date(p.at);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      monthPts[p.player] = (monthPts[p.player] || 0) + p.pts;
    }
  }
  const monthBest = Object.entries(monthPts).sort((a, b) => b[1] - a[1])[0];

  const selected = renderStats.selected && PLAYERS.includes(renderStats.selected)
    ? renderStats.selected
    : rank[0].name;
  renderStats.selected = selected;

  const superRows = rank
    .map((r) => `
      <div class="super-row">
        <span style="flex:1">${esc(r.name)}</span>
        ${
          r.supers > 0
            ? `<span class="bags">${"🔥👜".repeat(Math.min(r.supers, 5))}</span><span>${r.supers}</span>`
            : `<span class="none">aucun… pour l’instant</span>`
        }
      </div>`)
    .join("");

  $view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/" aria-label="Retour au classement">←</a>
      <h2>📊 Statistiques</h2>
    </div>
    <div class="stat-tiles">
      <div class="tile"><div class="tile-label">Total du groupe</div>
        <div class="tile-value">${totalPts}</div><div class="tile-sub">point${plural(totalPts)} sacoche${plural(totalPts)}</div></div>
      <div class="tile"><div class="tile-label">Moyenne / copain</div>
        <div class="tile-value">${(Math.round(avg * 10) / 10).toLocaleString("fr-FR")}</div><div class="tile-sub">points chacun</div></div>
      <div class="tile"><div class="tile-label">Record du mois</div>
        <div class="tile-value">${monthBest ? esc(monthBest[0]) : "—"}</div>
        <div class="tile-sub">${monthBest ? `${monthBest[1]} pt${plural(monthBest[1])} en ${now.toLocaleDateString("fr-FR", { month: "long" })}` : "personne ce mois-ci"}</div></div>
      <div class="tile"><div class="tile-label">Super Sacoches 🔥</div>
        <div class="tile-value">${totalSupers}</div><div class="tile-sub">au total</div></div>
    </div>
    <div class="card-block">
      <h3>📈 Évolution des points</h3>
      <div class="chart-chips">${rank
        .map((r) => `<button class="chip ${r.name === selected ? "sel" : ""}" data-chip="${esc(r.name)}">${esc(r.name)}</button>`)
        .join("")}</div>
      <div class="chart-wrap" id="chart-wrap"></div>
    </div>
    <div class="card-block">
      <h3>🔥👜 Super Sacoches par copain</h3>
      <div class="super-list">${superRows}</div>
    </div>
    ${navHtml("stats")}`;

  $view.querySelectorAll("[data-chip]").forEach((btn) =>
    btn.addEventListener("click", () => {
      renderStats.selected = btn.dataset.chip;
      render();
    })
  );
  drawChart(document.getElementById("chart-wrap"), selected);
}

// Graphique "emphase" : le copain sélectionné en couleur, les autres en gris.
function drawChart(wrap, selected) {
  const W = 560, H = 300, padL = 34, padR = 14, padT = 16, padB = 28;
  const asc = [...points].sort((a, b) => a.at - b.at);
  const t0 = asc[0].at;
  const t1 = Math.max(Date.now(), asc[asc.length - 1].at);
  const span = Math.max(t1 - t0, 1);

  // séries cumulées (escaliers : un point = une marche)
  const series = {};
  for (const name of PLAYERS) series[name] = [{ t: t0, cum: 0 }];
  for (const p of asc) {
    const s = series[p.player];
    if (!s) continue;
    s.push({ t: p.at, cum: s[s.length - 1].cum + p.pts });
  }
  for (const name of PLAYERS) {
    const s = series[name];
    s.push({ t: t1, cum: s[s.length - 1].cum });
  }

  // borne haute "ronde" (multiple de 4) pour des graduations entières
  const rawMax = Math.max(1, ...Object.values(series).map((s) => s[s.length - 1].cum));
  const maxY = Math.max(4, Math.ceil(rawMax / 4) * 4);
  const x = (t) => padL + ((t - t0) / span) * (W - padL - padR);
  const y = (v) => H - padB - (v / maxY) * (H - padT - padB);

  const stepPath = (s) => {
    let d = `M ${x(s[0].t).toFixed(1)} ${y(s[0].cum).toFixed(1)}`;
    for (let i = 1; i < s.length; i++) {
      d += ` H ${x(s[i].t).toFixed(1)} V ${y(s[i].cum).toFixed(1)}`;
    }
    return d;
  };

  // grille : 4 lignes horizontales discrètes
  const ticks = 4;
  let grid = "";
  for (let i = 0; i <= ticks; i++) {
    const v = Math.round((maxY / ticks) * i);
    const yy = y((maxY / ticks) * i);
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="var(--chart-grid)" stroke-width="1"/>
      <text x="${padL - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="var(--chart-muted)">${v}</text>`;
  }

  const context = PLAYERS.filter((n) => n !== selected)
    .map((n) => `<path d="${stepPath(series[n])}" fill="none" stroke="var(--chart-context)" stroke-width="2" stroke-linejoin="round"/>`)
    .join("");

  const sel = series[selected];
  const endY = y(sel[sel.length - 1].cum);
  const main = `
    <path d="${stepPath(sel)}" fill="none" stroke="var(--chart-line)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${W - padR}" cy="${endY}" r="4.5" fill="var(--chart-line)"/>
    <text x="${W - padR - 8}" y="${Math.max(endY - 9, 12)}" text-anchor="end" font-size="12" font-weight="800" fill="var(--chart-line)">${esc(selected)} · ${sel[sel.length - 1].cum}</text>`;

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des points de ${esc(selected)}">
      ${grid}
      <line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" stroke="var(--chart-context)" stroke-width="1.5"/>
      <text x="${padL}" y="${H - 8}" font-size="10" fill="var(--chart-muted)">${fmtDay(t0)}</text>
      <text x="${W - padR}" y="${H - 8}" text-anchor="end" font-size="10" fill="var(--chart-muted)">${fmtDay(t1)}</text>
      ${context}
      ${main}
      <circle id="tip-dot" r="5" fill="var(--chart-line)" stroke="#fff" stroke-width="2" style="display:none"/>
    </svg>
    <div class="chart-tip" id="chart-tip"></div>`;

  // Tooltip tactile / souris : l'événement le plus proche du doigt
  const svg = wrap.querySelector("svg");
  const tip = wrap.querySelector("#chart-tip");
  const dot = wrap.querySelector("#tip-dot");
  const events = sel.slice(1, -1); // les vraies marches

  const showTip = (clientX) => {
    if (!events.length) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = events[0];
    for (const e of events) {
      if (Math.abs(x(e.t) - px) < Math.abs(x(best.t) - px)) best = e;
    }
    const cx = x(best.t), cy = y(best.cum);
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.style.display = "";
    tip.style.display = "block";
    tip.style.left = (cx / W) * rect.width + "px";
    tip.style.top = (cy / H) * rect.height + "px";
    tip.textContent = `${best.cum} pt${plural(best.cum)} · ${fmtDay(best.t)}`;
  };
  const hideTip = () => {
    tip.style.display = "none";
    dot.style.display = "none";
  };
  svg.addEventListener("pointerdown", (e) => showTip(e.clientX));
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || e.buttons) showTip(e.clientX);
  });
  svg.addEventListener("pointerleave", hideTip);
}

// ---------------------------------------------------------------- modales

function openAddModal(preselect) {
  let player = preselect || null;
  let pts = null;

  $modalRoot.innerHTML = `
    <div class="overlay" id="overlay">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Ajouter un point sacoche">
        <h3>👜 Nouveau point sacoche</h3>
        <div class="sheet-label">Qui a été sacoche ?</div>
        <div class="player-grid">${PLAYERS.map(
          (p) => `<button class="player-chip ${p === player ? "sel" : ""}" data-p="${esc(p)}">${esc(p)}</button>`
        ).join("")}</div>
        <div class="field-error" id="err-player">Choisis un coupable !</div>
        <div class="sheet-label">Niveau de gravité</div>
        <div class="gravity-grid">
          <button class="gravity-btn" data-g="1">+1<small>léger</small></button>
          <button class="gravity-btn" data-g="2">+2<small>sérieux</small></button>
          <button class="gravity-btn" data-g="3">+3<small>grave</small></button>
        </div>
        <button class="super-btn" data-g="${SUPER_PTS}">🔥👜 SUPER SACOCHE — +5 🔥👜</button>
        <div class="field-error" id="err-pts">Choisis la gravité !</div>
        <div class="sheet-label">Motif (obligatoire)</div>
        <textarea class="note-input" id="note" maxlength="300"
          placeholder="Explique le crime… ex : « a quitté la soirée à 22h30 pour aller dormir »"></textarea>
        <div class="field-error" id="err-note">Pas de point sans motif !</div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="cancel">Annuler</button>
          <button class="btn btn-primary" id="submit">Valider 👜</button>
        </div>
      </div>
    </div>`;

  const $ = (sel) => $modalRoot.querySelector(sel);

  $("#overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") closeModal();
  });
  $("#cancel").addEventListener("click", closeModal);

  $modalRoot.querySelectorAll("[data-p]").forEach((btn) =>
    btn.addEventListener("click", () => {
      player = btn.dataset.p;
      $modalRoot.querySelectorAll("[data-p]").forEach((b) => b.classList.toggle("sel", b === btn));
      $("#err-player").classList.remove("show");
    })
  );
  $modalRoot.querySelectorAll("[data-g]").forEach((btn) =>
    btn.addEventListener("click", () => {
      pts = Number(btn.dataset.g);
      $modalRoot.querySelectorAll("[data-g]").forEach((b) => b.classList.toggle("sel", b === btn));
      $("#err-pts").classList.remove("show");
    })
  );

  $("#submit").addEventListener("click", () => {
    const note = $("#note").value.trim();
    let ok = true;
    if (!player) { $("#err-player").classList.add("show"); ok = false; }
    if (!pts) { $("#err-pts").classList.add("show"); ok = false; }
    if (!note) { $("#err-note").classList.add("show"); ok = false; }
    if (!ok) return;

    // optimiste : on n'attend pas le serveur
    backend.addPoint({ player, pts, note }).catch((err) => {
      console.error(err);
      toast("⚠️ Échec de l’envoi, réessaie");
    });
    closeModal();
    if (pts === SUPER_PTS) {
      confetti();
      toast(`🔥👜 SUPER SACOCHE pour ${player} ! +5 points !`);
    } else {
      toast(`👜 +${pts} pt${plural(pts)} pour ${player} !`);
    }
  });
}

function openDeleteModal(id) {
  const p = points.find((p) => p.id === id);
  if (!p) return;
  $modalRoot.innerHTML = `
    <div class="overlay" id="overlay">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Supprimer un point">
        <h3>🗑️ Supprimer ce point ?</h3>
        <p style="line-height:1.5">
          <strong>${esc(p.player)}</strong> — +${p.pts} pt${plural(p.pts)}<br>
          <span style="color:var(--ink-2)">« ${esc(p.note)} »</span>
        </p>
        <p style="margin-top:10px;font-size:0.85rem;color:var(--ink-2)">
          À n’utiliser qu’en cas d’erreur. La suppression est définitive pour tout le monde.
        </p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="cancel">Non, il le mérite</button>
          <button class="btn btn-danger" id="confirm">Oui, supprimer</button>
        </div>
      </div>
    </div>`;
  const $ = (sel) => $modalRoot.querySelector(sel);
  $("#overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") closeModal();
  });
  $("#cancel").addEventListener("click", closeModal);
  $("#confirm").addEventListener("click", () => {
    backend.deletePoint(p).catch(console.error);
    closeModal();
    toast("🗑️ Point supprimé");
  });
}

function closeModal() {
  $modalRoot.innerHTML = "";
}

// ---------------------------------------------------------- notifications

const notifEnabled = () => localStorage.getItem("sacoches-notif") === "1";

function refreshNotifBtn() {
  $notifBtn.setAttribute("aria-pressed", notifEnabled() ? "true" : "false");
  $notifBtn.textContent = notifEnabled() ? "🔔" : "🔕";
}

async function toggleNotifications() {
  if (notifEnabled()) {
    localStorage.setItem("sacoches-notif", "0");
    toast("🔕 Notifications désactivées");
  } else {
    if (!("Notification" in window)) {
      toast("⚠️ Notifications non supportées ici");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast("⚠️ Autorise les notifications dans ton navigateur");
      return;
    }
    localStorage.setItem("sacoches-notif", "1");
    toast("🔔 Tu seras alerté à chaque point sacoche !");
  }
  refreshNotifBtn();
}

async function notifyNewPoint(p) {
  if (!notifEnabled() || Notification.permission !== "granted") return;
  const title = p.pts === SUPER_PTS
    ? `🔥👜 SUPER SACOCHE : ${p.player} +5 !`
    : `👜 ${p.player} prend ${p.pts} point${plural(p.pts)} sacoche`;
  const opts = { body: p.note, icon: undefined, tag: p.id, lang: "fr" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (err) {
    console.warn("Notification impossible :", err);
  }
}

// ---------------------------------------------------------------- init

async function init() {
  $view.innerHTML = `<div class="empty"><span class="big">👜</span>Chargement…</div>`;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  backend = await createBackend();

  if (backend.mode === "local") {
    $banner.innerHTML = `<div class="banner">📵 <strong>Mode local</strong> — les points ne sont enregistrés
      que sur cet appareil. Pour la synchro entre tous les copains, configurer Firebase
      (voir le fichier README du dossier sacoches).</div>`;
  }

  backend.subscribe((newPoints) => {
    // détection des nouveaux points (pour notifier), hors chargement initial
    if (knownIds !== null) {
      for (const p of newPoints) {
        if (!knownIds.has(p.id) && p.dev !== DEVICE_ID && !p.pending &&
            Date.now() - p.at < 5 * 60 * 1000) {
          notifyNewPoint(p);
        }
      }
    }
    knownIds = new Set(newPoints.map((p) => p.id));
    points = newPoints;
    render();
  });

  backend.subscribeActivity((entries) => {
    activity = entries;
    if ((location.hash || "#/") === "#/historique") render();
  });

  window.addEventListener("hashchange", render);
  $fab.addEventListener("click", () => {
    const m = (location.hash || "").match(/^#\/j\/(.+)$/);
    openAddModal(m ? decodeURIComponent(m[1]) : null);
  });
  $notifBtn.addEventListener("click", toggleNotifications);
  refreshNotifBtn();
}

init();
