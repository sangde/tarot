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

const $ = (s) => document.querySelector(s);

function showLogin(msg = "") {
  $("#admin-login").hidden = false;
  $("#admin-dash").hidden = true;
  $("#admin-logout").hidden = true;
  $("#login-hint").textContent = msg;
}

function showDash(meta) {
  $("#admin-login").hidden = true;
  $("#admin-dash").hidden = false;
  $("#admin-logout").hidden = false;
  $("#admin-meta").textContent = `${meta.email} · storage: ${meta.storage}`;
  $("#admin-badge").textContent = `Admin · ${meta.email}`;
}

async function loadCodes() {
  const { codes } = await api("/api/admin/codes");
  const body = $("#codes-body");
  body.innerHTML = codes
    .map((c) => {
      const used = c.maxUses == null ? `${c.used || 0} / ∞` : `${c.used || 0} / ${c.maxUses}`;
      const status = c.source === "env" ? "ENV" : c.active ? "Active" : "Off";
      const actions =
        c.source === "env"
          ? `<span class="tag">chỉ đọc</span>`
          : `<div class="row-actions">
              <button type="button" data-toggle-code="${c.code}" data-active="${c.active}">${
                c.active ? "Tắt" : "Bật"
              }</button>
              <button type="button" data-del-code="${c.code}">Xóa</button>
            </div>`;
      return `<tr>
        <td><strong>${c.code}</strong><div style="color:var(--ink-muted);font-size:0.78rem">${c.note || ""}</div></td>
        <td>${used}</td>
        <td><span class="tag ${c.active ? "ok" : "off"}">${status}</span></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-toggle-code]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const active = btn.dataset.active !== "true";
      await api("/api/admin/codes", {
        method: "PATCH",
        body: JSON.stringify({ code: btn.dataset.toggleCode, active }),
      });
      await loadCodes();
    });
  });
  body.querySelectorAll("[data-del-code]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Xóa mã ${btn.dataset.delCode}?`)) return;
      await api("/api/admin/codes", {
        method: "DELETE",
        body: JSON.stringify({ code: btn.dataset.delCode }),
      });
      await loadCodes();
    });
  });
}

async function loadUsers() {
  const { users } = await api("/api/admin/users");
  const body = $("#users-body");
  body.innerHTML = users.length
    ? users
        .map((u) => {
          return `<tr>
            <td>${u.email}</td>
            <td><span class="tag ${u.activated ? "ok" : "off"}">${u.activated ? "Premium" : "Free"}</span></td>
            <td>${u.role || "user"}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-act-user="${u.email}" data-on="${!u.activated}">${
                  u.activated ? "Hủy Premium" : "Kích hoạt"
                }</button>
                <button type="button" data-role-user="${u.email}" data-role="${
                  u.role === "admin" ? "user" : "admin"
                }">${u.role === "admin" ? "Bỏ admin" : "Cho admin"}</button>
                <button type="button" data-del-user="${u.email}">Xóa</button>
              </div>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="color:var(--ink-muted)">Chưa có tài khoản đăng ký.</td></tr>`;

  body.querySelectorAll("[data-act-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ email: btn.dataset.actUser, activated: btn.dataset.on === "true" }),
      });
      await loadUsers();
    });
  });
  body.querySelectorAll("[data-role-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ email: btn.dataset.roleUser, role: btn.dataset.role }),
      });
      await loadUsers();
    });
  });
  body.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Xóa tài khoản ${btn.dataset.delUser}?`)) return;
      await api("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ email: btn.dataset.delUser }),
      });
      await loadUsers();
    });
  });
}

async function bootDash() {
  const me = await api("/api/admin/me");
  showDash(me);
  await Promise.all([loadCodes(), loadUsers()]);
}

$("#admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#admin-email").value,
        password: $("#admin-password").value,
      }),
    });
    await bootDash();
  } catch (err) {
    showLogin(err.data?.message || err.message);
  }
});

$("#create-code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/codes", {
    method: "POST",
    body: JSON.stringify({
      code: $("#new-code").value,
      note: $("#new-code-note").value,
      maxUses: $("#new-code-max").value || null,
    }),
  });
  $("#create-code-form").reset();
  await loadCodes();
});

$("#refresh-users").addEventListener("click", () => loadUsers());
$("#admin-logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  showLogin("Đã đăng xuất.");
});

bootDash().catch(() => showLogin("Đăng nhập để tiếp tục."));
