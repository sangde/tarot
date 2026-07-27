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
let access = {
  premium: false,
  email: null,
  drawsLeft: 1,
  features: {
    multiSpread: false,
    reversed: false,
    libraryFull: false,
    unlimitedDraws: false,
  },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

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
  return deck.slice(0, count).map((card) => ({
    card,
    reversed: allowReversed ? Math.random() < 0.35 : false,
    position: null,
    delay: 180,
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

function applyAccessUI() {
  const badge = $("#access-badge");
  const note = $("#access-note");
  const premium = access.premium;

  if (premium) {
    badge.textContent = access.email ? `Premium · ${access.email}` : "Premium đã kích hoạt";
    badge.classList.add("is-premium");
    note.innerHTML = "Tài khoản Premium: rút không giới hạn, trải 3 lá / tình cảm, lá ngược, thư viện đầy đủ.";
  } else {
    const left = access.drawsLeft ?? 0;
    badge.textContent = left > 0 ? `Miễn phí · còn ${left} lần` : "Hết lượt miễn phí";
    badge.classList.remove("is-premium");
    note.innerHTML =
      left > 0
        ? `Khách: mỗi IP chỉ rút <strong>1 lần · 1 lá</strong>. Còn <strong>${left}</strong> lượt. Có mã / tài khoản kích hoạt để mở đủ chức năng.`
        : `IP này đã hết lượt miễn phí. <button type="button" class="nav-link" id="note-open-access">Nhập mã hoặc đăng nhập</button> để rút tiếp.`;
    $("#note-open-access")?.addEventListener("click", () => $("#access-dialog").showModal());
  }

  $$(".premium-only").forEach((el) => {
    el.classList.toggle("is-locked", !premium);
    const input = el.querySelector("input");
    if (input) {
      input.disabled = !premium;
      if (!premium && input.type === "radio" && input.checked) {
        $('input[name="spread"][value="1"]').checked = true;
      }
      if (!premium && input.type === "checkbox") input.checked = false;
    }
  });

  $("#library-section-lock")?.remove();
  if (!premium) {
    const hint = document.createElement("p");
    hint.className = "library-lock-hint";
    hint.id = "library-section-lock";
    hint.textContent = "Thư viện xem nhanh miễn phí. Chi tiết đầy đủ mở khi kích hoạt Premium.";
    $(".library-filters")?.before(hint);
  }

  $("#logout-btn").hidden = !access.email && !access.premium;
  $("#access-dialog-status").textContent = premium
    ? "Bạn đang dùng Premium — rút bài không giới hạn."
    : access.email
      ? `Đã đăng nhập ${access.email} (chưa kích hoạt). Nhập mã để mở khóa.`
      : "Chưa kích hoạt. Nhập mã, hoặc đăng ký / đăng nhập rồi kích hoạt.";

  renderLibrary($$(".chip.active")?.dataset.filter || "all");
}

function renderInterpretation(drawnCard) {
  if (!drawnCard?.card) return;
  const { card, reversed } = drawnCard;
  const bundle = meaningBundle(drawnCard);
  const tabs = access.premium
    ? TAB_DEFS.filter((tab) => textForFields(bundle, tab.fields))
    : TAB_DEFS.filter((tab) => tab.id === "overview" && textForFields(bundle, tab.fields));
  const firstTab = tabs[0]?.id || "overview";
  const img = card.image || card.icon || "";
  const keywordsHtml = (bundle.keywords || [])
    .map((k) => `<span class="keyword">${escapeHtml(k)}</span>`)
    .join("");

  const actionsHtml =
    access.premium && bundle.actions?.length
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
      : access.premium
        ? ""
        : `<div class="actions-block"><p>Premium để xem đủ chủ đề (công việc, tình yêu, tài chính…) và hành động gợi ý.</p></div>`;

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
      ${tabs
        .map(
          (t) =>
            `<button type="button" class="tab ${t.id === firstTab ? "active" : ""}" data-tab="${t.id}" role="tab">${t.label}</button>`
        )
        .join("")}
    </div>
    ${tabs
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
    }" data-index="${index}">
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

  drawn.forEach((d, index) => {
    setTimeout(() => {
      const el = $(`.drawn-card[data-index="${index}"]`, row);
      if (el) el.classList.add("is-revealed");
    }, 200 + index * 320);
  });
}

function showDrawError(message) {
  let box = $("#draw-error");
  if (!box) {
    box = document.createElement("p");
    box.id = "draw-error";
    box.className = "access-feedback is-err";
    $("#draw-form")?.after(box);
  }
  box.hidden = false;
  box.innerHTML = `${escapeHtml(message)} <button type="button" class="nav-link" id="err-open-access">Mở tài khoản / mã</button>`;
  $("#err-open-access")?.addEventListener("click", () => $("#access-dialog").showModal());
}

async function runDraw(event) {
  event?.preventDefault();
  const spreadKey = $$('input[name="spread"]:checked')[0]?.value || "1";
  const positions = SPREADS[spreadKey];
  if (!positions) {
    showDrawError("Kiểu trải không hợp lệ.");
    return;
  }
  if (!cards.length) {
    showDrawError("Đang tải bộ bài, thử lại sau giây lát.");
    return;
  }

  const allowReversed = Boolean($("#allow-reversed")?.checked) && access.premium;
  const question = $("#question").value.trim();
  if ($("#draw-error")) $("#draw-error").hidden = true;

  document.body.classList.add("shuffling");
  $("#draw-btn").disabled = true;
  $("#draw-btn").textContent = "Đang xào bài…";

  try {
    await api("/api/draw", {
      method: "POST",
      body: JSON.stringify({ spread: spreadKey, allowReversed }),
    });
  } catch (err) {
    document.body.classList.remove("shuffling");
    $("#draw-btn").disabled = false;
    $("#draw-btn").textContent = "Xào bài & rút";
    showDrawError(err.data?.message || err.message || "Không rút được bài.");
    if (err.data?.error === "ip_limit" || err.data?.error === "free_limit") {
      $("#access-dialog").showModal();
    }
    await refreshAccess();
    return;
  }

  await wait(350);

  drawn = pickCards(positions.length, allowReversed).map((d, i) => ({
    ...d,
    position: positions[i],
    delay: 180 + i * 320,
  }));

  if (!drawn.length || !drawn[0]?.card) {
    document.body.classList.remove("shuffling");
    $("#draw-btn").disabled = false;
    $("#draw-btn").textContent = "Xào bài & rút";
    showDrawError("Không lấy được lá bài. Tải lại trang rồi thử lại.");
    return;
  }

  activeIndex = 0;
  $("#reading").hidden = false;
  $("#reading-question").textContent = question
    ? `“${question}”`
    : positions.length === 1
      ? "Thông điệp dành cho bạn"
      : "Trải bài của bạn";

  renderDrawnCards();
  renderInterpretation(drawn[0]);

  $("#draw-btn").disabled = false;
  $("#draw-btn").textContent = "Xào bài & rút";
  document.body.classList.remove("shuffling");
  $("#reading").scrollIntoView({ behavior: "smooth", block: "start" });
  refreshAccess().catch(() => {});
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

  if (!access.premium) {
    $("#dialog-inner").innerHTML = `
      <div class="interp-header">
        ${card.image ? `<img src="${card.image}" alt="" referrerpolicy="no-referrer" />` : ""}
        <div>
          <h3>${escapeHtml(displayName(card))}</h3>
          <span class="badge">${card.numberLine || (card.arcana === "major" ? "Ẩn chính" : card.suit)}</span>
          <div class="keywords">${keywords}</div>
        </div>
      </div>
      <div class="tab-panel">${escapeHtml(
        (card.description || upright.overview || "").slice(0, 280) + "…"
      )}</div>
      <div class="actions-block">
        <p>Kích hoạt Premium để đọc đủ mô tả, tình yêu, công việc và các chủ đề khác.</p>
        <button type="button" class="btn btn-primary" id="lib-open-access">Tài khoản / Mã</button>
      </div>
    `;
    $("#lib-open-access")?.addEventListener("click", () => {
      dialog.close();
      $("#access-dialog").showModal();
    });
    dialog.showModal();
    return;
  }

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

function showFeedback(msg, ok) {
  const el = $("#access-feedback");
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle("is-ok", ok);
  el.classList.toggle("is-err", !ok);
}

async function refreshAccess() {
  try {
    access = await api("/api/status");
  } catch {
    access = {
      premium: false,
      email: null,
      drawsLeft: 1,
      features: { multiSpread: false, reversed: false, libraryFull: false, unlimitedDraws: false },
    };
  }
  applyAccessUI();
}

function bindAccess() {
  $("#open-access").addEventListener("click", () => $("#access-dialog").showModal());

  $$("[data-access-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-access-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".access-panel").forEach((p) => (p.hidden = p.dataset.panel !== btn.dataset.accessTab));
    });
  });

  $("#panel-code").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/api/activate", {
        method: "POST",
        body: JSON.stringify({
          code: $("#activate-code").value,
          email: access.email || undefined,
        }),
      });
      showFeedback(data.message, true);
      await refreshAccess();
    } catch (err) {
      showFeedback(err.data?.message || err.message, false);
    }
  });

  $("#panel-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("#login-email").value,
          password: $("#login-password").value,
        }),
      });
      showFeedback(data.message, true);
      await refreshAccess();
    } catch (err) {
      showFeedback(err.data?.message || err.message, false);
    }
  });

  $("#panel-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: $("#register-email").value,
          password: $("#register-password").value,
        }),
      });
      showFeedback(data.message, true);
      await refreshAccess();
    } catch (err) {
      showFeedback(err.data?.message || err.message, false);
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    showFeedback("Đã đăng xuất.", true);
    await refreshAccess();
  });
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
  bindAccess();
  $("#draw-btn").disabled = true;
  $("#draw-btn").textContent = "Đang tải bài…";

  try {
    const res = await fetch("./cards.json");
    cards = await res.json();
    cards = cards.filter((c) => c.name && !c.error);
    renderLibrary();
  } catch (err) {
    console.error(err);
    $("#library-grid").innerHTML =
      "<p>Không tải được dữ liệu lá bài. Hãy tải lại trang.</p>";
    showDrawError("Không tải được bộ bài. Hãy tải lại trang.");
    return;
  }

  $("#draw-btn").disabled = false;
  $("#draw-btn").textContent = "Xào bài & rút";
  await refreshAccess();
}

boot();
