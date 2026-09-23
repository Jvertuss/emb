/* ============================================================================
   VECTOR — router, views, search, progress
   COURSE_ORDER and CONCEPTS below drive navigation. Adding a chapter file
   (chapters/chNN.js calling registerChapter) is enough to make it appear as
   long as its id is also listed in COURSE_ORDER; leaving an id out of
   COURSE_ORDER's chapter files renders it as a dimmed, unclickable "pending"
   row instead.
   ========================================================================= */

const COURSE_ORDER = [
  { id: "ch00", num: "00", title: "Exam Review: MSP430 Fundamentals", short: "EEL 4742C · Labs 1–3, pre-interrupts" },
  { id: "ch01", num: "01", title: "Numbers, Memory & the Register Model", short: "Bits, hex, and the memory map" },
  { id: "ch02", num: "02", title: "GPIO: Digital Input & Output", short: "Pins, pulls, and debouncing" },
  { id: "ch03", num: "03", title: "Interrupts & ISRs", short: "Coming soon" },
  { id: "ch04", num: "04", title: "Timers & PWM", short: "Prescalers, ARR, and duty cycle" },
  { id: "ch05", num: "05", title: "Serial Communication", short: "UART, SPI, and I2C" },
];

const CONCEPTS = [
  {
    id: "atomic-access",
    name: "Atomic register access",
    blurb: "A read-modify-write on a shared register is three separate instructions to the CPU. Anything that can interrupt between them — an ISR, a second core, a preemptive task — can make the write you thought you did disappear.",
    appears: [
      { ch: "ch01", item: "race-condition", note: "Where the three-instruction read-modify-write comes from, and the specific interleaving that loses a bit." },
      { ch: "ch04", item: "isr-timing", note: "Why an ISR that shares a variable with main() needs the same care, plus what `volatile` does and doesn't buy you." },
      { ch: "ch05", item: "buffer-race", note: "The same hazard applied to a UART ring buffer's head/tail indices." },
    ],
  },
  {
    id: "debounce",
    name: "Debouncing a mechanical input",
    blurb: "A mechanical switch doesn't transition cleanly — the contacts physically bounce for a few milliseconds, and a naive edge-triggered read sees that bounce as several fast presses.",
    appears: [
      { ch: "ch02", item: "button-bounce", note: "What bounce physically looks like on a scope trace and the simplest software fix: a delay-and-recheck." },
      { ch: "ch04", item: "timer-debounce", note: "Replacing the blocking delay with a timer-driven poll, so debouncing costs no CPU time." },
    ],
  },
  {
    id: "duty-cycle",
    name: "Duty cycle",
    blurb: "The fraction of one period that a signal spends high. It's how a digital pin fakes an analog voltage — a dimmed LED or a motor at half speed is really a full-brightness pin blinking faster than you can see.",
    appears: [
      { ch: "ch04", item: "pwm-basics", note: "Deriving duty cycle from ARR and CCR, and why the eye or a motor's inertia low-pass-filters the pulses into something that reads as analog." },
    ],
  },
  {
    id: "bit-timing",
    name: "Bit timing & baud",
    blurb: "Two UARTs with no shared clock line agree on when a bit starts and ends purely by both counting time at the same rate. Baud rate is that rate — get it wrong by more than a few percent and framing errors follow.",
    appears: [
      { ch: "ch05", item: "uart-framing", note: "How a start bit resynchronizes the receiver's clock every single byte, and how much drift 8N1 can tolerate before it misreads a frame." },
    ],
  },
];

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const LS_THEME = "vector-theme";
const LS_PROGRESS = "vector-progress";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_PROGRESS)) || {}; }
  catch (e) { return {}; }
}
let progress = loadProgress();
function saveProgress() { localStorage.setItem(LS_PROGRESS, JSON.stringify(progress)); }
function isDone(probId) { return !!progress[probId]; }
function toggleDone(probId) { progress[probId] = !progress[probId]; saveProgress(); }

function chapterById(id) { return CHAPTERS.find(c => c.id === id); }
function courseEntry(id) { return COURSE_ORDER.find(c => c.id === id); }
function chapterProblemCount(id) { const c = chapterById(id); return c && c.problems ? c.problems.length : 0; }
function chapterDoneCount(id) {
  const c = chapterById(id); if (!c || !c.problems) return 0;
  return c.problems.filter(p => isDone(p.id)).length;
}

// ---------------------------------------------------------------------------
// markdown + math + widget pipeline
// ---------------------------------------------------------------------------
let pendingWidgets = [];
let widgetCounter = 0;

function mdMath(src) {
  const mathStash = [];
  const widgetStash = [];

  // inline concept links: [[concept:atomic-access]] -> a link using CONCEPTS' name
  let text = src.replace(/\[\[concept:([\w-]+)\]\]/g, (m, id) => {
    const c = CONCEPTS.find(x => x.id === id);
    return c ? `[${c.name}](#/concept/${id})` : m;
  });

  // stash widgets: [[widget:type|k=v|k2=v2]]
  text = text.replace(/\[\[widget:([\w-]+)((?:\|[^\[\]|]+)*)\]\]/g, (m, type, argsStr) => {
    const opts = {};
    argsStr.split("|").filter(Boolean).forEach(pair => {
      const idx = pair.indexOf("=");
      if (idx === -1) return;
      const k = pair.slice(0, idx).trim();
      let v = pair.slice(idx + 1).trim();
      if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (!isNaN(Number(v)) && v !== "") v = Number(v);
      opts[k] = v;
    });
    const id = "w" + (++widgetCounter);
    widgetStash.push({ id, type, opts });
    const token = `@@WIDGET${widgetStash.length - 1}@@`;
    return token;
  });

  // stash math: $$...$$ then $...$ (never nested, never spans a stashed widget token)
  text = text.replace(/\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$/g, (m) => {
    mathStash.push(m);
    return `@@MATH${mathStash.length - 1}@@`;
  });

  let html = marked.parse(text);

  html = html.replace(/@@MATH(\d+)@@/g, (m, i) => mathStash[Number(i)]);
  html = html.replace(/(<p>)?@@WIDGET(\d+)@@(<\/p>)?/g, (m, _p1, i, _p2) => {
    const w = widgetStash[Number(i)];
    if (!w || !Widgets[w.type]) return "";
    pendingWidgets.push(w);
    return Widgets[w.type].html(w.id, w.opts);
  });
  return html;
}

function mountPendingWidgets() {
  pendingWidgets.forEach(w => { if (Widgets[w.type]) Widgets[w.type].mount(w.id, w.opts); });
  pendingWidgets = [];
}

function renderMath(container) {
  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

function afterInsert(container) {
  mountPendingWidgets();
  renderMath(container);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---------------------------------------------------------------------------
// nav (chapter drawer)
// ---------------------------------------------------------------------------
function buildNav(activeChapterId) {
  const nav = document.getElementById("nav");
  let html = `<h2>Course</h2>`;
  COURSE_ORDER.forEach(entry => {
    const ch = chapterById(entry.id);
    if (!ch) {
      html += `<div class="nav-item pending"><span class="n">${entry.num}</span><span class="t">${esc(entry.title)}</span></div>`;
      return;
    }
    const total = chapterProblemCount(entry.id);
    const done = chapterDoneCount(entry.id);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const active = entry.id === activeChapterId;
    html += `
      <button class="nav-item${active ? " active" : ""}" data-nav-chapter="${entry.id}">
        <span class="n">${entry.num}</span>
        <span class="t">${esc(ch.title)}</span>
      </button>
      <div class="prog"><span style="width:${pct}%"></span></div>`;
  });
  html += `<h2>Reference</h2>
    <button class="nav-item" data-nav-route="#/concepts">Concept index</button>
    <button class="nav-item" data-nav-route="#/ref">Formula & data tables</button>`;
  nav.innerHTML = html;
  nav.querySelectorAll("[data-nav-chapter]").forEach(btn => {
    btn.addEventListener("click", () => {
      location.hash = `#/ch/${btn.getAttribute("data-nav-chapter").replace("ch", "")}/guide`;
      closeMobileNav();
    });
  });
  nav.querySelectorAll("[data-nav-route]").forEach(btn => {
    btn.addEventListener("click", () => { location.hash = btn.getAttribute("data-nav-route"); closeMobileNav(); });
  });
}

function closeMobileNav() {
  document.getElementById("nav").classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
}

// ---------------------------------------------------------------------------
// section rail (scroll spy) — desktop railwrap + mobile strip
// ---------------------------------------------------------------------------
let railObserver = null;
function buildRail(anchors, foot) {
  if (railObserver) { railObserver.disconnect(); railObserver = null; }
  const railHtml = `
    <div class="railwrap">
      <div class="rail-title">On this page</div>
      <div class="rail">
        <div class="rail-mark"></div>
        ${anchors.map(a => `<a href="#${a.id}" data-anchor="${a.id}"><span class="id">${esc(a.tag)}</span>${esc(a.label)}</a>`).join("")}
      </div>
      ${foot || ""}
    </div>`;
  const stripHtml = `
    <div class="strip">
      ${anchors.map(a => `<a href="#${a.id}" data-anchor="${a.id}">${esc(a.tag)}</a>`).join("")}
    </div>`;
  return { railHtml, stripHtml };
}

function wireRailScrollSpy(root) {
  const links = root.querySelectorAll("[data-anchor]");
  if (!links.length) return;
  links.forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const target = document.getElementById(a.getAttribute("data-anchor"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const sections = Array.from(links).map(a => document.getElementById(a.getAttribute("data-anchor"))).filter(Boolean);
  if (!sections.length) return;
  const setActive = (id) => {
    root.querySelectorAll("[data-anchor]").forEach(a => a.classList.toggle("on", a.getAttribute("data-anchor") === id));
    const mark = root.querySelector(".rail-mark");
    const onLink = root.querySelector(`.rail a[data-anchor="${id}"]`);
    if (mark && onLink) mark.style.top = onLink.offsetTop + 6 + "px";
  };
  railObserver = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: "-110px 0px -70% 0px", threshold: 0 });
  sections.forEach(s => railObserver.observe(s));
  setActive(sections[0].id);
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------
function setMain(html) {
  const main = document.getElementById("main");
  main.innerHTML = html;
  window.scrollTo({ top: 0 });
  return main;
}

function viewHome() {
  buildNav(null);
  let seq = `<div class="seq">`;
  COURSE_ORDER.forEach((entry, i) => {
    const ch = chapterById(entry.id);
    if (ch) {
      const total = chapterProblemCount(entry.id), done = chapterDoneCount(entry.id);
      seq += `
        <button class="seqrow live" data-go="#/ch/${entry.num}/guide">
          <span class="ord">${entry.num}</span>
          <span class="ttl">${esc(ch.title)}<small>${esc(entry.short)}</small></span>
          <span class="st">${done}/${total} solved</span>
        </button>`;
    } else {
      seq += `
        <div class="seqrow dim">
          <span class="ord">${entry.num}</span>
          <span class="ttl">${esc(entry.title)}<small>${esc(entry.short)}</small></span>
          <span class="st">pending</span>
        </div>`;
    }
  });
  seq += `</div>`;

  const cgrid = `<div class="cgrid">` + CONCEPTS.map(c => `
    <button class="ccard" data-go="#/concept/${c.id}">
      <div class="cn">${esc(c.name)}</div>
      <div class="cd">${esc(c.blurb.slice(0, 84))}${c.blurb.length > 84 ? "…" : ""}</div>
      <div class="cs">${c.appears.length} chapter${c.appears.length > 1 ? "s" : ""}</div>
    </button>`).join("") + `</div>`;

  const main = setMain(`
    <div class="hero">
      <h1>A companion for <em>embedded systems</em>, built for understanding.</h1>
      <p>Guides, register-level formula sheets, and original problems — for the gap between "the code compiles" and "I know why the pin went high."</p>
    </div>
    <div class="sect-label">Course</div>
    ${seq}
    <div class="sect-label">Concepts that cross chapters</div>
    ${cgrid}
    <div class="sect-label">Quick reference</div>
    <div class="seq">
      <button class="seqrow live" data-go="#/ref">
        <span class="ord">REF</span>
        <span class="ttl">Formula & data tables<small>Number ranges, GPIO modes, timer math, UART/SPI/I2C comparison</small></span>
        <span class="st">open</span>
      </button>
    </div>
  `);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => location.hash = el.getAttribute("data-go")));
}

function viewConceptsIndex() {
  buildNav(null);
  const grid = `<div class="cgrid">` + CONCEPTS.map(c => `
    <button class="ccard" data-go="#/concept/${c.id}">
      <div class="cn">${esc(c.name)}</div>
      <div class="cd">${esc(c.blurb)}</div>
      <div class="cs">appears in ${c.appears.length} chapter${c.appears.length > 1 ? "s" : ""}</div>
    </button>`).join("") + `</div>`;
  const main = setMain(`
    <div class="masthead">
      <div class="eyebrow">Concept index</div>
      <h1 class="chap">One idea, several chapters</h1>
      <div class="brief"><p>The same hazard or trick shows up under different names in different chapters. These pages pull the thread.</p></div>
    </div>
    ${grid}
  `);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => location.hash = el.getAttribute("data-go")));
}

function viewConcept(id) {
  const c = CONCEPTS.find(x => x.id === id);
  buildNav(null);
  if (!c) { setMain(`<div class="empty">No such concept.</div>`); return; }
  const appearsHtml = c.appears.map(a => {
    const ch = chapterById(a.ch);
    const entry = courseEntry(a.ch);
    if (!ch) return "";
    return `
      <button class="chit" data-go="#/ch/${entry.num}/guide#${a.item}">
        <div class="cw">${entry.num} · ${esc(ch.title)}</div>
        <div class="cx">${esc(a.note)}</div>
      </button>`;
  }).join("");
  const main = setMain(`
    <div class="masthead">
      <div class="eyebrow">Concept</div>
      <h1 class="chap">${esc(c.name)}</h1>
      <div class="brief"><p>${esc(c.blurb)}</p></div>
    </div>
    <div class="sect-label">Appears in</div>
    ${appearsHtml}
  `);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => {
    const target = el.getAttribute("data-go");
    const [hashPart, anchor] = target.split("#").filter(Boolean);
    location.hash = "#" + hashPart;
    if (anchor) setTimeout(() => { const t = document.getElementById(anchor); if (t) t.scrollIntoView({ behavior: "smooth" }); }, 60);
  }));
}

function renderFormulaBlock(f) {
  return `<div class="ccard formula-card" style="cursor:default"><div class="cn">${esc(f.name)}</div><div class="katex-display-wrap">$$${f.tex}$$</div></div>`;
}

function viewReference() {
  buildNav(null);
  const groups = REFERENCE ? REFERENCE.groups : [];
  const anchors = groups.map(g => ({ id: "ref-" + g.id, tag: "REF", label: g.title }));
  const { railHtml, stripHtml } = buildRail(anchors);

  let body = "";
  groups.forEach(g => {
    body += `<div class="gsec" id="ref-${g.id}">
      <div class="gsec-head"><span class="gsec-id">${esc(g.title)}</span></div>
      <div class="gsec-rule"></div>`;
    (g.tables || []).forEach(t => {
      body += `<div class="gitem"><div class="gitem-title">${esc(t.name)}</div>`;
      if (t.tex) {
        body += `<div class="guide-body">$$${t.tex}$$</div>`;
      } else {
        body += `<div class="guide-body"><table><thead><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
        t.rows.forEach(r => {
          body += `<tr>${r.map(cell => `<td>${t.math ? mdMath(`$${cell}$`) : esc(cell)}</td>`).join("")}</tr>`;
        });
        body += `</tbody></table></div>`;
      }
      body += `</div>`;
    });
    (g.formulas || []).forEach(f => {
      body += `<div class="gitem"><div class="gitem-title">${esc(f.name)}</div><div class="guide-body">$$${f.tex}$$</div></div>`;
    });
    body += `</div>`;
  });

  const main = setMain(`
    <div class="layout-inner">
      ${stripHtml}
      <div class="masthead">
        <div class="eyebrow">Reference</div>
        <h1 class="chap">Formula & data tables</h1>
        <div class="brief"><p>Everything here is quoted elsewhere in a guide. This page exists so you don't have to hunt a chapter down mid-problem.</p></div>
      </div>
      ${body}
    </div>
  `);
  // inject railwrap alongside main via layout restructure
  insertRail(railHtml);
  afterInsert(main);
  wireRailScrollSpy(document);
}

// The rail sits as a sibling of <main> inside .layout, so it survives
// independent of which view is rendered — this small helper (re)inserts it.
function insertRail(railHtml) {
  const layout = document.getElementById("layout");
  let old = document.querySelector(".railwrap");
  if (old) old.remove();
  if (!railHtml) return;
  const div = document.createElement("div");
  div.innerHTML = railHtml;
  layout.appendChild(div.firstElementChild);
}

function chapterMasthead(entry, ch, activeTab) {
  const total = chapterProblemCount(entry.id), done = chapterDoneCount(entry.id);
  return `
    <div class="masthead">
      <div class="eyebrow">Chapter ${entry.num}</div>
      <h1 class="chap">${esc(ch.title)}</h1>
      <div class="chap-sub">${esc(entry.short)}</div>
      <div class="brief">${(ch.brief || []).map(p => `<p>${esc(p)}</p>`).join("")}</div>
    </div>
    <div class="tabs">
      <button class="${activeTab === "guide" ? "active" : ""}" data-go="#/ch/${entry.num}/guide">Guide</button>
      <button class="${activeTab === "problems" ? "active" : ""}" data-go="#/ch/${entry.num}/problems">Problems<span class="count">${done}/${total}</span></button>
    </div>`;
}

function viewChapterGuide(num) {
  const entry = COURSE_ORDER.find(c => c.num === num);
  const ch = entry && chapterById(entry.id);
  buildNav(entry ? entry.id : null);
  if (!ch) { setMain(`<div class="empty">Chapter ${esc(num)} isn't written yet.</div>`); insertRail(""); return; }

  const anchors = [];
  let body = "";
  ch.sections.forEach(sec => {
    body += `<div class="gsec"><div class="gsec-head"><span class="gsec-id">${esc(sec.id)}</span><span class="gsec-name">${esc(sec.name)}</span></div><div class="gsec-rule"></div>`;
    sec.items.forEach(item => {
      anchors.push({ id: item.id, tag: sec.id, label: item.title });
      body += `<div class="gitem" id="${item.id}"><div class="gitem-title">${esc(item.title)}</div><div class="guide-body">${mdMath(item.body)}</div></div>`;
    });
    body += `</div>`;
  });

  const idx = COURSE_ORDER.findIndex(c => c.id === entry.id);
  const prevEntry = COURSE_ORDER.slice(0, idx).reverse().find(c => chapterById(c.id));
  const nextEntry = COURSE_ORDER.slice(idx + 1).find(c => chapterById(c.id));
  const foot = `<div class="rail-foot">
      <button class="seqbtn" data-go="${prevEntry ? `#/ch/${prevEntry.num}/guide` : ""}" ${prevEntry ? "" : "disabled"}><span class="k">Previous</span><span class="v">${prevEntry ? esc(chapterById(prevEntry.id).title) : "—"}</span></button>
      <button class="seqbtn" data-go="${nextEntry ? `#/ch/${nextEntry.num}/guide` : ""}" ${nextEntry ? "" : "disabled"}><span class="k">Next</span><span class="v">${nextEntry ? esc(chapterById(nextEntry.id).title) : "—"}</span></button>
    </div>`;
  const { railHtml, stripHtml } = buildRail(anchors, foot);

  const main = setMain(`
    ${stripHtml}
    ${chapterMasthead(entry, ch, "guide")}
    ${body}
  `);
  insertRail(railHtml);
  afterInsert(main);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => { if (el.getAttribute("data-go")) location.hash = el.getAttribute("data-go"); }));
  wireRailScrollSpy(document);
}

let problemFilter = "all";
function viewChapterProblems(num) {
  const entry = COURSE_ORDER.find(c => c.num === num);
  const ch = entry && chapterById(entry.id);
  buildNav(entry ? entry.id : null);
  insertRail("");
  if (!ch) { setMain(`<div class="empty">Chapter ${esc(num)} isn't written yet.</div>`); return; }

  const probs = ch.problems || [];
  const filtered = problemFilter === "all" ? probs : probs.filter(p => p.tags.includes(problemFilter));
  const done = probs.filter(p => isDone(p.id)).length;
  const pct = probs.length ? Math.round((done / probs.length) * 100) : 0;

  let list = filtered.map((p, i) => {
    const doneNow = isDone(p.id);
    return `
    <div class="prob${doneNow ? " done" : ""}" id="${p.id}">
      <div class="prob-head">
        <span class="prob-num">${entry.num}.${i + 1}</span>
        ${p.tags.map(t => `<span class="tag ${t}">${t}</span>`).join("")}
      </div>
      <div class="prob-body">${mdMath(p.body)}
        <div class="prob-actions">
          ${p.hint ? `<button class="act" data-reveal="${p.id}-hint">Hint</button>` : ""}
          ${p.solution ? `<button class="act" data-reveal="${p.id}-sol">Solution</button>` : ""}
          ${p.expert ? `<button class="act expert" data-reveal="${p.id}-expert">Silicon note</button>` : ""}
          <button class="act ${doneNow ? "done" : "primary"}" data-done="${p.id}">${doneNow ? "Solved ✓" : "Mark solved"}</button>
        </div>
        ${p.hint ? `<div class="reveal hidden" id="${p.id}-hint"><h4>Hint</h4><div class="body">${mdMath(p.hint)}</div></div>` : ""}
        ${p.solution ? `<div class="reveal hidden" id="${p.id}-sol"><h4>Solution</h4><div class="body">${mdMath(p.solution)}</div></div>` : ""}
        ${p.expert ? `<div class="reveal expert hidden" id="${p.id}-expert"><h4>Silicon note</h4><div class="body">${mdMath(p.expert)}</div></div>` : ""}
      </div>
    </div>`;
  }).join("");
  if (!filtered.length) list = `<div class="empty">No problems match this filter.</div>`;

  const main = setMain(`
    ${chapterMasthead(entry, ch, "problems")}
    <div class="filters">
      <label>Tag<select id="tag-filter">
        <option value="all">All</option>
        <option value="warmup">Warm-up</option>
        <option value="core">Core</option>
        <option value="challenge">Challenge</option>
      </select></label>
      <div class="pbar"><span style="width:${pct}%"></span></div>
      <div class="pcount">${done}/${probs.length} solved</div>
    </div>
    ${list}
  `);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => location.hash = el.getAttribute("data-go")));
  main.querySelector("#tag-filter").value = problemFilter;
  main.querySelector("#tag-filter").addEventListener("change", (e) => { problemFilter = e.target.value; viewChapterProblems(num); });
  main.querySelectorAll("[data-reveal]").forEach(btn => btn.addEventListener("click", () => {
    document.getElementById(btn.getAttribute("data-reveal")).classList.toggle("hidden");
  }));
  main.querySelectorAll("[data-done]").forEach(btn => btn.addEventListener("click", () => {
    toggleDone(btn.getAttribute("data-done"));
    viewChapterProblems(num);
  }));
  afterInsert(main);
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------
let lastRouteBeforeSearch = null;

function highlight(text, q) {
  if (!q) return esc(text);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return esc(text);
  return esc(text.slice(0, idx)) + "<mark>" + esc(text.slice(idx, idx + q.length)) + "</mark>" + esc(text.slice(idx + q.length));
}

function runSearch(q) {
  q = q.trim();
  if (!q) { if (lastRouteBeforeSearch !== null) { route(); } return; }
  if (lastRouteBeforeSearch === null) lastRouteBeforeSearch = location.hash;
  buildNav(null);
  insertRail("");
  const qLower = q.toLowerCase();
  let groupsHtml = "";
  COURSE_ORDER.forEach(entry => {
    const ch = chapterById(entry.id);
    if (!ch) return;
    let rows = "";
    ch.sections.forEach(sec => sec.items.forEach(item => {
      const hay = (item.title + " " + item.body).toLowerCase();
      if (hay.includes(qLower)) {
        rows += `<button class="chit" data-go="#/ch/${entry.num}/guide#${item.id}">
          <div class="cw">${entry.num} · ${esc(sec.id)}</div>
          <div class="cb">${highlight(item.title, q)}</div>
        </button>`;
      }
    }));
    (ch.problems || []).forEach((p, i) => {
      if (p.body.toLowerCase().includes(qLower)) {
        rows += `<button class="chit" data-go="#/ch/${entry.num}/problems#${p.id}">
          <div class="cw">${entry.num}.${i + 1} · problem</div>
          <div class="cb">${highlight(p.body.replace(/\$[^$]*\$/g, "…"), q)}</div>
        </button>`;
      }
    });
    if (rows) groupsHtml += `<div class="sres-grp">${esc(ch.title)}</div>${rows}`;
  });
  CONCEPTS.forEach(c => {
    if ((c.name + " " + c.blurb).toLowerCase().includes(qLower)) {
      groupsHtml += `<div class="sres-grp">Concepts</div>
        <button class="chit" data-go="#/concept/${c.id}"><div class="cb">${highlight(c.name, q)}</div><div class="cx">${esc(c.blurb.slice(0, 100))}…</div></button>`;
    }
  });
  const main = setMain(`
    <div class="masthead">
      <div class="eyebrow">Search</div>
      <h1 class="chap">Results for "${esc(q)}"</h1>
    </div>
    ${groupsHtml || `<div class="empty">Nothing matched "${esc(q)}".</div>`}
  `);
  main.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => {
    const target = el.getAttribute("data-go");
    const [hashPart, anchor] = target.split("#").filter(Boolean);
    document.getElementById("search").value = "";
    lastRouteBeforeSearch = null;
    location.hash = "#" + hashPart;
    if (anchor) setTimeout(() => { const t = document.getElementById(anchor); if (t) t.scrollIntoView({ behavior: "smooth" }); }, 80);
  }));
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------
function route() {
  const hash = location.hash || "#/";
  let m;
  if (hash === "#/" || hash === "") { viewHome(); insertRail(""); }
  else if (hash === "#/concepts") { viewConceptsIndex(); insertRail(""); }
  else if ((m = hash.match(/^#\/concept\/([\w-]+)$/))) { viewConcept(m[1]); insertRail(""); }
  else if (hash === "#/ref") { viewReference(); }
  else if ((m = hash.match(/^#\/ch\/(\d+)\/guide$/))) { viewChapterGuide(m[1]); }
  else if ((m = hash.match(/^#\/ch\/(\d+)\/problems$/))) { viewChapterProblems(m[1]); }
  else if ((m = hash.match(/^#\/ch\/(\d+)$/))) { location.replace(`#/ch/${m[1]}/guide`); }
  else { setMain(`<div class="empty">Nothing here.</div>`); insertRail(""); }
}
window.addEventListener("hashchange", route);

// ---------------------------------------------------------------------------
// chrome: theme, mobile nav, search box
// ---------------------------------------------------------------------------
function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}
(function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(dark);
})();
document.getElementById("theme-btn").addEventListener("click", () => {
  const dark = !document.documentElement.classList.contains("dark");
  applyTheme(dark);
  localStorage.setItem(LS_THEME, dark ? "dark" : "light");
});
document.getElementById("brand-btn").addEventListener("click", () => { location.hash = "#/"; });
document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("nav").classList.add("open");
  document.getElementById("backdrop").classList.add("show");
});
document.getElementById("backdrop").addEventListener("click", closeMobileNav);
let searchDebounce = null;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  const q = e.target.value;
  searchDebounce = setTimeout(() => runSearch(q), 140);
});

route();
