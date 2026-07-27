const { setCors, json, readBody } = require("../_lib/http");
const { getSession, isAdminSession } = require("../_lib/auth");
const { listCodes, saveCode, deleteCode, getCode } = require("../_lib/store");

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
    const codes = await listCodes();
    return json(res, 200, { codes }, {}, req);
  }

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" }, {}, req);
  }

  if (req.method === "POST") {
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    if (!code || code.length < 4) {
      return json(res, 400, { error: "invalid", message: "Mã tối thiểu 4 ký tự." }, {}, req);
    }
    const existing = await getCode(code);
    if (existing) {
      return json(res, 409, { error: "exists", message: "Mã đã tồn tại." }, {}, req);
    }
    const saved = await saveCode({
      code,
      note: body.note || "",
      maxUses: body.maxUses,
      used: 0,
      active: true,
    });
    return json(res, 201, { ok: true, code: saved }, {}, req);
  }

  if (req.method === "PATCH") {
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    const existing = await getCode(code);
    if (!existing) {
      return json(
        res,
        404,
        { error: "not_found", message: "Chỉ sửa được mã tạo trong admin (không sửa mã ENV)." },
        {},
        req
      );
    }
    if (typeof body.active === "boolean") existing.active = body.active;
    if (body.note != null) existing.note = String(body.note);
    if (body.maxUses !== undefined) {
      existing.maxUses =
        body.maxUses == null || body.maxUses === "" ? null : Number(body.maxUses);
    }
    const saved = await saveCode(existing);
    return json(res, 200, { ok: true, code: saved }, {}, req);
  }

  if (req.method === "DELETE") {
    const code = String(body.code || "")
      .trim()
      .toUpperCase();
    const existing = await getCode(code);
    if (!existing) {
      return json(res, 404, { error: "not_found", message: "Không xóa được mã ENV." }, {}, req);
    }
    await deleteCode(code);
    return json(res, 200, { ok: true }, {}, req);
  }

  return json(res, 405, { error: "Method not allowed" }, {}, req);
};
