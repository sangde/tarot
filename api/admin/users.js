const { setCors, json, readBody } = require("../_lib/http");
const { getSession, isAdminSession } = require("../_lib/auth");
const { listUsers, getUser, saveUser, deleteUser } = require("../_lib/store");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const session = getSession(req);
  if (!isAdminSession(session)) {
    return json(res, 401, { error: "unauthorized", message: "Cần đăng nhập admin." }, {}, req);
  }

  if (req.method === "GET") {
    const users = await listUsers();
    return json(res, 200, { users }, {}, req);
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" }, {}, req);
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email) return json(res, 400, { error: "missing_email", message: "Thiếu email." }, {}, req);

  if (req.method === "PATCH") {
    const user = await getUser(email);
    if (!user) return json(res, 404, { error: "not_found", message: "Không tìm thấy user." }, {}, req);

    if (typeof body.activated === "boolean") {
      user.activated = body.activated;
      user.activatedAt = body.activated ? new Date().toISOString() : null;
      user.activatedBy = body.activated ? session.email || "admin" : null;
    }
    if (body.role === "admin" || body.role === "user") {
      user.role = body.role;
      if (body.role === "admin") user.activated = true;
    }
    await saveUser(user);
    return json(res, 200, { ok: true, user: { email: user.email, activated: user.activated, role: user.role } }, {}, req);
  }

  if (req.method === "DELETE") {
    if (email === String(session.email || "").toLowerCase()) {
      return json(res, 400, { error: "self", message: "Không thể tự xóa tài khoản admin đang dùng." }, {}, req);
    }
    await deleteUser(email);
    return json(res, 200, { ok: true }, {}, req);
  }

  return json(res, 405, { error: "Method not allowed" }, {}, req);
};
