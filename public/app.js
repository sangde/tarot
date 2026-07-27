const SPREADS = {
  1: [{ key: "message", label: "Thông điệp" }],
  3: [
    { key: "past", label: "Quá khứ" },
    { key: "present", label: "Hiện tại" },
    { key: "future", label: "Tương lai" },
  ],
  love: [
    { key: "you", label: "Bạn" },
    { key: "other", label: "Đối phương" },
    { key: "bond", label: "Mối quan hệ" },
  ],
};

const TAB_DEFS = [
  { id: "overview", label: "Tổng quan", fields: ["intro", "overview", "description"] },
  { id: "career", label: "Công việc", fields: ["career"] },
  { id: "love", label: "Tình yêu", fields: ["love"] },
  { id: "finance", label: "Tài chính", fields: ["finance"] },
  { id: "health", label: "Sức khỏe", fields: ["health"] },
  { id: "spirit", label: "Tinh thần", fields: ["spirit"] },
];

const VI_NAMES = {
  fool: "Chú Hề",
  magician: "Pháp Sư",
  "high-priestess": "Nữ Tư Tế",
  empress: "Nữ Hoàng",
  emperor: "Hoàng Đế",
  hierophant: "Giáo Hoàng",
  lovers: "Người Tình",
  chariot: "Cỗ Xe",
  strength: "Sức Mạnh",
  hermit: "Ẩn Sĩ",
  "wheel-of-fortune": "Bánh Xe Số Phận",
  justice: "Công Lý",
  "hanged-man": "Người Treo",
  death: "Thần Chết",
  temperance: "Tiết Độ",
  devil: "Ác Quỷ",
  tower: "Tòa Tháp",
  star: "Ngôi Sao",
  moon: "Mặt Trăng",
  sun: "Mặt Trời",
  judgement: "Phán Xét",
  world: "Thế Giới",
};

let cards = [];
let drawn = [];
let activeIndex = 0;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function displayName(card) {
  const vi = VI_NAMES[card.id];
  return vi ? `${card.name} · ${vi}` : card.name;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickCards(count, allowReversed) {
  const deck = shuffle(cards);
  return deck.slice(0, count).map((card, i) => ({
    card,
    reversed: allowReversed ? Math.random() < 0.35 : false,
    position: null,
    delay: 180 + i * 320,
  }));
}

function meaningBundle(drawnCard) {
  const { card, reversed } = drawnCard;
  const orient = reversed ? card.reversed || {} : card.upright || {};
  return {
    ...orient,
    description: card.description || "",
    keywords: card.keywords || [],
    actions: card.actions || [],
    opposing: card.opposing || [],
    supporting: card.supporting || [],
  };
}

function textForFields(bundle, fields) {
  const chunks = [];
  for (const field of fields) {
    if (field === "description" && bundle.description) {
      chunks.push(bundle.description);
      continue;
    }
    if (bundle[field]) chunks.push(bundle[field]);
  }
  return chunks.join("\n\n").trim();
}

function renderInterpretation(drawnCard) {
  const { card, reversed } = drawnCard;
  const bundle = meaningBundle(drawnCard);
  const availableTabs = TAB_DEFS.filter((tab) => textForFields(bundle, tab.fields));
  const firstTab = availableTabs[0]?.id || "overview";

  const img = card.image || card.icon || "";
  const actionsHtml =
    bundle.actions?.length > 0
      ? `<div class="actions-block">
          <h4>Trong hành động</h4>
          ${bundle.actions
            .map(
              (a) =>
                `<h4 style="font-size:1.05rem;margin-top:0.75rem">${escapeHtml(a.title)}</h4>
                 <ul>${a.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
            )
            .join("")}
        </div>`
      : "";

  const keywordsHtml = (bundle.keywords || [])
    .map((k) => `<span class="keyword">${escapeHtml(k)}</span>`)
    .join("");

  $("#interpretation").innerHTML = `
    <div class="interp-header">
      ${img ? `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
      <div>
        <h3>${escapeHtml(displayName(card))}</h3>
        <span class="badge">${reversed ? "Lá ngược" : "Lá xuôi"} · ${
          card.arcana === "major" ? "Ẩn chính" : `Bộ ${card.suit}`
        }</span>
        <div class="keywords">${keywordsHtml}</div>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${availableTabs
        .map(
          (t, i) =>
            `<button type="button" class="tab ${t.id === firstTab ? "active" : ""}" data-tab="${t.id}" role="tab">${t.label}</button>`
        )
        .join("")}
    </div>
    ${availableTabs
      .map((t) => {
        const body = textForFields(bundle, t.fields);
        return `<div class="tab-panel" data-panel="${t.id}" ${
          t.id === firstTab ? "" : "hidden"
        }>${escapeHtml(body)}</div>`;
      })
      .join("")}
    ${actionsHtml}
    <a class="source-link" href="${card.url}" target="_blank" rel="noopener">Xem nguồn trên tarot.vn →</a>
  `;

  $$(".tab", $("#interpretation")).forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab", $("#interpretation")).forEach((b) => b.classList.remove("active"));
      $$(".tab-panel", $("#interpretation")).forEach((p) => (p.hidden = true));
      btn.classList.add("active");
      const panel = $(`.tab-panel[data-panel="${btn.dataset.tab}"]`, $("#interpretation"));
      if (panel) panel.hidden = false;
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cardFaceHtml(card) {
  const src = card.image || card.icon;
  if (src) {
    return `<img src="${src}" alt="${escapeHtml(card.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'card-fallback',textContent:this.alt}))" />`;
  }
  return `<div class="card-fallback">${escapeHtml(card.name)}</div>`;
}

function renderDrawnCards() {
  const row = $("#cards-row");
  row.innerHTML = drawn
    .map(
      (d, index) => `
    <button type="button" class="drawn-card ${d.reversed ? "is-reversed" : ""} ${
      index === activeIndex ? "is-active" : ""
    }" data-index="${index}" style="animation-delay:${d.delay}ms">
      <p class="position">${escapeHtml(d.position.label)}</p>
      <div class="card-stage">
        <div class="card-flip">
          <div class="card-face back"></div>
          <div class="card-face front">${cardFaceHtml(d.card)}</div>
        </div>
      </div>
      <p class="card-name">${escapeHtml(d.card.name)}</p>
      <p class="card-orient">${d.reversed ? "Ngược" : "Xuôi"}</p>
    </button>`
    )
    .join("");

  $$(".drawn-card", row).forEach((el) => {
    el.addEventListener("click", () => {
      activeIndex = Number(el.dataset.index);
      $$(".drawn-card", row).forEach((c) => c.classList.remove("is-active"));
      el.classList.add("is-active");
      renderInterpretation(drawn[activeIndex]);
    });
  });

  // Reveal with stagger
  drawn.forEach((d, index) => {
    setTimeout(() => {
      const el = $(`.drawn-card[data-index="${index}"]`, row);
      if (el) el.classList.add("is-revealed");
    }, d.delay + 200);
  });
}

async function runDraw(event) {
  event?.preventDefault();
  const spreadKey = $$('input[name="spread"]:checked')[0]?.value || "1";
  const positions = SPREADS[spreadKey];
  const allowReversed = $("#allow-reversed").checked;
  const question = $("#question").value.trim();

  document.body.classList.add("shuffling");
  $("#draw-btn").textContent = "Đang xào bài…";

  await wait(650);

  drawn = pickCards(positions.length, allowReversed).map((d, i) => ({
    ...d,
    position: positions[i],
  }));
  activeIndex = 0;

  $("#reading").hidden = false;
  $("#reading-question").textContent = question
    ? `“${question}”`
    : positions.length === 1
      ? "Thông điệp dành cho bạn"
      : "Trải bài của bạn";

  renderDrawnCards();
  renderInterpretation(drawn[0]);

  $("#draw-btn").textContent = "Xào bài & rút";
  document.body.classList.remove("shuffling");
  $("#reading").scrollIntoView({ behavior: "smooth", block: "start" });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderLibrary(filter = "all") {
  const grid = $("#library-grid");
  const list = cards.filter((c) => {
    if (filter === "all") return true;
    if (filter === "major") return c.arcana === "major";
    return c.suit === filter;
  });

  grid.innerHTML = list
    .map((card) => {
      const thumb = card.icon || card.image || "";
      return `
      <button type="button" class="lib-card" data-id="${card.id}">
        ${
          thumb
            ? `<img src="${thumb}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
            : `<div class="card-fallback" style="height:140px">${escapeHtml(card.name)}</div>`
        }
        <strong>${escapeHtml(card.name)}</strong>
        <span>${card.arcana === "major" ? "Ẩn chính" : card.suit}</span>
      </button>`;
    })
    .join("");

  $$(".lib-card", grid).forEach((btn) => {
    btn.addEventListener("click", () => openLibraryCard(btn.dataset.id));
  });
}

function openLibraryCard(id) {
  const card = cards.find((c) => c.id === id);
  if (!card) return;
  const dialog = $("#card-dialog");
  const keywords = (card.keywords || [])
    .map((k) => `<span class="keyword">${escapeHtml(k)}</span>`)
    .join("");
  const upright = card.upright || {};
  $("#dialog-inner").innerHTML = `
    <div class="interp-header">
      ${card.image ? `<img src="${card.image}" alt="" referrerpolicy="no-referrer" />` : ""}
      <div>
        <h3>${escapeHtml(displayName(card))}</h3>
        <span class="badge">${card.numberLine || (card.arcana === "major" ? "Ẩn chính" : card.suit)}</span>
        <div class="keywords">${keywords}</div>
      </div>
    </div>
    <div class="tab-panel">${escapeHtml(card.description || upright.overview || upright.intro || "Chưa có mô tả.")}</div>
    ${
      upright.love
        ? `<div class="actions-block"><h4>Tình yêu (xuôi)</h4><p>${escapeHtml(upright.love)}</p></div>`
        : ""
    }
    ${
      upright.career
        ? `<div class="actions-block"><h4>Công việc (xuôi)</h4><p>${escapeHtml(upright.career)}</p></div>`
        : ""
    }
    <a class="source-link" href="${card.url}" target="_blank" rel="noopener">Nguồn tarot.vn →</a>
  `;
  dialog.showModal();
}

function initStars() {
  const canvas = $("#stars");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, stars;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = Array.from({ length: Math.min(140, Math.floor((w * h) / 14000)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.6 + 0.15,
      s: Math.random() * 0.02 + 0.005,
      p: Math.random() * Math.PI * 2,
    }));
  }

  function tick(t) {
    ctx.clearRect(0, 0, w, h);
    for (const star of stars) {
      const twinkle = 0.55 + Math.sin(t * star.s + star.p) * 0.45;
      ctx.beginPath();
      ctx.fillStyle = `rgba(243, 235, 224, ${star.a * twinkle})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);
}

function bindNav() {
  $$("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.scroll);
      el?.scrollIntoView({ behavior: "smooth" });
    });
  });

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      renderLibrary(chip.dataset.filter);
    });
  });

  $("#draw-form").addEventListener("submit", runDraw);
  $("#redraw-btn").addEventListener("click", runDraw);
}

async function boot() {
  initStars();
  bindNav();
  try {
    const res = await fetch("./cards.json");
    cards = await res.json();
    cards = cards.filter((c) => c.name && !c.error);
    renderLibrary();
  } catch (err) {
    console.error(err);
    $("#library-grid").innerHTML =
      "<p>Không tải được dữ liệu lá bài. Hãy chạy lại từ thư mục public.</p>";
  }
}

boot();
