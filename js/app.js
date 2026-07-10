import {
  TRACKS, PAYMENT_CAST, getTopic, getTrack, neighbors,
  TOPIC_COUNT, FAILURES_COUNT, HLD_COUNT, LLD_COUNT, hiddenGems,
} from "./registry.js";
import { Stage } from "./sim/engine.js";
import { bustUrl } from "./cache-bust.js";

const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");
const crumbsEl = document.getElementById("crumbs");
const searchEl = document.getElementById("search");
const shellEl = document.getElementById("shell");

let activeScene = null;
let activeSim = null;
let activeTrack = "failures";

/* ------------------------------------------------------------------ nav ---- */
function trackTabs() {
  const tabs = document.createElement("div");
  tabs.className = "track-tabs";
  TRACKS.forEach((tr) => {
    const a = document.createElement("a");
    a.className = "track-tab" + (activeTrack === tr.id ? " active" : "");
    a.href = `#/track/${tr.id}`;
    a.dataset.track = tr.id;
    a.innerHTML = `<span class="track-short">${tr.short}</span><span class="track-count">${tr.categories.reduce((n, c) => n + c.topics.length, 0)}</span>`;
    a.title = tr.title;
    tabs.appendChild(a);
  });
  return tabs;
}

function buildNav(trackId = activeTrack) {
  activeTrack = trackId;
  navEl.innerHTML = "";
  navEl.appendChild(trackTabs());

  const track = getTrack(trackId) || TRACKS[0];
  track.categories.forEach((cat) => {
    const wrap = document.createElement("div");
    wrap.className = "cat";
    wrap.dataset.cat = cat.id;

    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.innerHTML = `<span class="twist">▶</span><span class="cat-num">${cat.num}</span><span>${cat.title}</span><span class="cat-count">${cat.topics.length}</span>`;
    btn.addEventListener("click", () => wrap.classList.toggle("open"));
    wrap.appendChild(btn);

    const ul = document.createElement("ul");
    ul.className = "topics";
    cat.topics.forEach((t) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "topic-link";
      a.href = `#/topic/${t.id}`;
      a.dataset.topic = t.id;
      if (t.tier === "hidden-gem") a.innerHTML = `<span class="gem">◆</span> ${t.title}`;
      else a.textContent = t.title;
      li.appendChild(a);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    navEl.appendChild(wrap);
  });
}

function highlightNav(topicId) {
  navEl.querySelectorAll(".topic-link").forEach((a) => a.classList.remove("active"));
  if (!topicId) return;
  const link = navEl.querySelector(`.topic-link[data-topic="${topicId}"]`);
  if (link) {
    link.classList.add("active");
    link.closest(".cat")?.classList.add("open");
    const entry = getTopic(topicId);
    if (entry && entry.track !== activeTrack) {
      buildNav(entry.track);
      navEl.querySelector(`.topic-link[data-topic="${topicId}"]`)?.classList.add("active");
    }
  }
}

searchEl.addEventListener("input", () => {
  const q = searchEl.value.trim().toLowerCase();
  navEl.querySelectorAll(".cat").forEach((cat) => {
    let any = false;
    cat.querySelectorAll(".topic-link").forEach((a) => {
      const match = !q || a.textContent.toLowerCase().includes(q);
      a.style.display = match ? "" : "none";
      if (match) any = true;
    });
    cat.style.display = any ? "" : "none";
    if (q && any) cat.classList.add("open");
  });
});

/* ---------------------------------------------------------------- teardown - */
function teardown() {
  if (activeSim?.dispose) { try { activeSim.dispose(); } catch (e) {} }
  if (activeScene) { try { activeScene.dispose(); } catch (e) {} }
  activeSim = null;
  activeScene = null;
}

/* -------------------------------------------------------------------- home - */
function renderHome() {
  teardown();
  highlightNav(null);
  crumbsEl.innerHTML = `<b>Home</b>`;

  const cast = PAYMENT_CAST.map(
    (c) => `<span class="cast-item"><span class="dot" style="color:${c.color}"></span>${c.label}</span>`
  ).join("");

  const trackCards = TRACKS.map((tr) => {
    const count = tr.categories.reduce((n, c) => n + c.topics.length, 0);
    const gems = hiddenGems(tr.id).length;
    return `
      <a class="track-card" href="#/track/${tr.id}">
        <div class="track-badge">${tr.short}</div>
        <h3>${tr.title}</h3>
        <p>${tr.desc}</p>
        <div class="track-meta"><b>${count}</b> topics · <b>${tr.categories.length}</b> categories${gems ? ` · <span class="gem-label">${gems} hidden gems</span>` : ""}</div>
      </a>`;
  }).join("");

  appEl.innerHTML = `
    <section class="hero">
      <h1>Distributed Systems Lab</h1>
      <p>Three learning tracks — <b>Production Failures</b>, <b>HLD</b>, and <b>LLD</b> — all through one payment platform example. Every topic has pros/cons, when-to-use guidance, and an interactive diagram.</p>
      <div class="stats">
        <div class="stat"><b>3</b><span>tracks</span></div>
        <div class="stat"><b>${TOPIC_COUNT}</b><span>topics</span></div>
        <div class="stat"><b>${TOPIC_COUNT}</b><span>interactive diagrams</span></div>
      </div>
    </section>

    <section class="track-grid">${trackCards}</section>

    <section class="legend">
      <h3>The cast (used in every simulation)</h3>
      <p>Same characters everywhere: Wallet, Order Service, Payment Gateway, Event Queue, and Ledger.</p>
      <div class="cast">${cast}</div>
    </section>
  `;
  appEl.scrollTop = 0;
}

/* -------------------------------------------------------------- track hub - */
function renderTrack(trackId) {
  teardown();
  highlightNav(null);
  const track = getTrack(trackId);
  if (!track) { renderHome(); return; }
  buildNav(trackId);
  crumbsEl.innerHTML = `<a href="#/">Home</a> / <b>${track.title}</b>`;

  const gems = hiddenGems(trackId);
  const gemSection = gems.length ? `
    <section class="gems-section">
      <h3><span class="gem">◆</span> Hidden gems <span class="sub">— lesser-known concepts worth learning</span></h3>
      <div class="chips">${gems.map((t) => `<a class="chip gem-chip" href="#/topic/${t.id}">${t.title}</a>`).join("")}</div>
    </section>` : "";

  const cards = track.categories.map((cat) => {
    const chips = cat.topics
      .map((t) => `<a class="chip${t.tier === "hidden-gem" ? " gem-chip" : ""}" href="#/topic/${t.id}">${t.tier === "hidden-gem" ? "◆ " : ""}${t.title}</a>`)
      .join("");
    return `
      <div class="cat-card">
        <h3><span class="n">${String(cat.num).padStart(2, "0")}</span> ${cat.title}</h3>
        <p class="desc">${cat.desc}</p>
        <div class="chips">${chips}</div>
      </div>`;
  }).join("");

  const count = track.categories.reduce((n, c) => n + c.topics.length, 0);

  appEl.innerHTML = `
    <section class="hero track-hero">
      <div class="track-badge large">${track.short}</div>
      <h1>${track.title}</h1>
      <p>${track.desc}</p>
      <div class="stats">
        <div class="stat"><b>${track.categories.length}</b><span>categories</span></div>
        <div class="stat"><b>${count}</b><span>topics</span></div>
        <div class="stat"><b>${gems.length}</b><span>hidden gems</span></div>
      </div>
    </section>
    ${gemSection}
    <div class="cat-grid">${cards}</div>
  `;
  appEl.scrollTop = 0;
}

/* ------------------------------------------------------------------ topic -- */
function section(tag, title, html) {
  if (!html) return "";
  return `<div class="section"><h2><span class="tag ${tag}">${tag}</span>${title}</h2>${html}</div>`;
}

function tradeoffsSection(content) {
  if (content.tradeoffsHtml) return section("tradeoffs", "Tradeoffs", content.tradeoffsHtml);
  const t = content.tradeoffs;
  if (!t) return "";
  const list = (items) => items?.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : "";
  return section("tradeoffs", "Tradeoffs", `
    <div class="tradeoff-grid">
      <div class="tradeoff-col pros"><h4>Pros</h4>${list(t.pros)}</div>
      <div class="tradeoff-col cons"><h4>Cons</h4>${list(t.cons)}</div>
      <div class="tradeoff-col use"><h4>Use when</h4>${list(t.whenToUse)}</div>
      <div class="tradeoff-col avoid"><h4>Avoid when</h4>${list(t.whenNotToUse)}</div>
    </div>`);
}

function relatedSection(content) {
  if (!content.related?.length) return "";
  const links = content.related
    .map((id) => { const e = getTopic(id); return e ? `<a href="#/topic/${id}">${e.title}</a>` : null; })
    .filter(Boolean)
    .join(", ");
  if (!links) return "";
  return `<div class="article-section related-section"><h2>Related topics</h2><p>${links}</p></div>`;
}

function figureHtml(fig) {
  if (!fig?.svg) return "";
  return `<figure class="figure" id="fig-${fig.id || ""}">
    <div class="figure-svg">${fig.svg}</div>
    ${fig.caption ? `<figcaption>${fig.caption}</figcaption>` : ""}
  </figure>`;
}

function articleSections(content) {
  if (!content.sections?.length) return "";
  const figs = content.figures || [];
  const figById = Object.fromEntries(figs.map((f) => [f.id, f]));
  const placed = new Set();
  let figIdx = 0;

  const nextFallbackFig = () => {
    while (figIdx < figs.length) {
      const f = figs[figIdx++];
      if (!placed.has(f.id)) return f;
    }
    return null;
  };

  const html = content.sections.map((sec, i) => {
    let figBlock = "";
    if (sec.figureAfter && figById[sec.figureAfter] && !placed.has(sec.figureAfter)) {
      placed.add(sec.figureAfter);
      figBlock = figureHtml(figById[sec.figureAfter]);
    } else if (!sec.figureAfter) {
      const useFallback = i === 0 || i === Math.floor(content.sections.length / 2);
      if (useFallback) {
        const f = nextFallbackFig();
        if (f) {
          placed.add(f.id);
          figBlock = figureHtml(f);
        }
      }
    }
    return `${figBlock}<section class="article-section"><h2>${sec.title}</h2><div class="prose">${sec.body}</div></section>`;
  }).join("");

  const remaining = figs.filter((f) => !placed.has(f.id)).map(figureHtml).join("");
  return html + remaining;
}

function legacyContent(content) {
  const banner = `<div class="migration-banner"><p><em>Legacy layout — this topic will migrate to flexible article sections.</em></p></div>`;
  return banner + [
    content.plainEnglish ? section("intro", "Overview", content.plainEnglish) : contentInProgressNotice(),
    section("technical", "How it works", content.technical),
    section("problem", "The problem", content.problem),
    section("solution", "The solution", content.solution),
    tradeoffsSection(content),
    section("after", "After applying", content.after),
    section("example", "In our payment system", content.example),
  ].join("");
}

function renderArticleBody(content) {
  if (content.sections?.length) {
    const archetype = content.archetype ? `<span class="archetype-badge">${content.archetype}</span>` : "";
    return `<article class="article">${archetype}${articleSections(content)}${relatedSection(content)}</article>`;
  }
  return `<div class="content legacy-content">${legacyContent(content)}${relatedSection(content)}</div>`;
}

function contentInProgressNotice() {
  return `<div class="content-progress"><p><em>Content in progress — overview and technical sections are being enriched.</em></p></div>`;
}

async function renderTopic(id) {
  teardown();
  const entry = getTopic(id);
  if (!entry) { renderHome(); return; }
  if (entry.track !== activeTrack) buildNav(entry.track);
  highlightNav(id);

  const track = getTrack(entry.track);
  crumbsEl.innerHTML = `<a href="#/">Home</a> / <a href="#/track/${entry.track}">${track?.short || entry.track}</a> / ${entry.category.title} / <b>${entry.title}</b>`;

  appEl.innerHTML = `<div class="loading">Loading simulation…</div>`;

  let mod;
  try {
    mod = await import(bustUrl(entry.module));
  } catch (e) {
    console.error(e);
    appEl.innerHTML = `
      <div class="topic">
        <div class="topic-header">
          <div class="kicker">${entry.category.title}</div>
          <h1>${entry.title}</h1>
        </div>
        <div class="section"><p>Module failed to load. Serve over HTTP. <br><code>${entry.module}</code></p><pre>${(e?.message) || e}</pre></div>
      </div>`;
    return;
  }

  const content = mod.content || {};
  const nb = neighbors(id);
  const tierBadge = entry.tier === "hidden-gem" ? `<span class="tier-badge gem">Hidden gem</span>` : "";
  const trackBadge = `<span class="tier-badge track-${entry.track}">${track?.short || entry.track}</span>`;

  const hasSim = typeof mod.createSimulation === "function";
  const simHtml = hasSim ? `
      <div class="sim-wrap">
        <div class="sim-grid">
          <div class="sim-stage" id="stage"></div>
          <div class="controls" id="panel"></div>
        </div>
      </div>` : "";

  appEl.innerHTML = `
    <div class="topic">
      <div class="topic-header">
        <div class="kicker">${String(entry.category.num).padStart(2, "0")} · ${entry.category.title} ${trackBadge} ${tierBadge}</div>
        <h1>${entry.title}</h1>
        <div class="oneliner">${content.oneliner || entry.blurb}</div>
      </div>
${simHtml}

      ${renderArticleBody(content)}

      <div class="pager">
        ${nb.prev ? `<a class="prev" href="#/topic/${nb.prev.id}"><div class="dir">← Previous</div><div class="t">${nb.prev.title}</div></a>` : `<span></span>`}
        ${nb.next ? `<a class="next" href="#/topic/${nb.next.id}"><div class="dir">Next →</div><div class="t">${nb.next.title}</div></a>` : `<span></span>`}
      </div>
    </div>
  `;
  appEl.scrollTop = 0;

  activeSim = null;
  activeScene = null;
  if (!hasSim) return;

  const stage = document.getElementById("stage");
  const panel = document.getElementById("panel");
  try {
    activeScene = new Stage(stage);
    activeSim = mod.createSimulation(activeScene, panel, stage);
    if (!activeSim) activeSim = null;
  } catch (e) {
    console.error(e);
    stage.innerHTML = `<div class="loading">Diagram failed: ${(e?.message) || e}</div>`;
  }
}

/* ----------------------------------------------------------------- router -- */
function route() {
  const hash = location.hash || "#/";
  shellEl.classList.remove("nav-open");

  let m = hash.match(/^#\/topic\/(.+)$/);
  if (m) { renderTopic(decodeURIComponent(m[1])); return; }

  m = hash.match(/^#\/track\/(\w+)$/);
  if (m) { renderTrack(m[1]); return; }

  renderHome();
}

document.getElementById("mobile-nav")?.addEventListener("click", () => shellEl.classList.toggle("nav-open"));
document.getElementById("sidebar-toggle")?.addEventListener("click", () => shellEl.classList.toggle("nav-open"));

window.addEventListener("hashchange", route);
buildNav();
route();
