const { setCors, json, readBody } = require("./_lib/http");
const { getSession, sessionCookie } = require("./_lib/auth");
const { findValidCode, consumeCode, getUser, saveUser } = require("./_lib/store");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" }, {}, req);

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" }, {}, req);
  }

  const code = String(body.code || "").trim();
  if (!code) {
    return json(res, 400, { error: "missing_code", message: "Nhập mã kích hoạt." }, {}, req);
  }

  const valid = await findValidCode(code);
  if (!valid) {
    return json(res, 403, { error: "invalid_code", message: "Mã không hợp lệ hoặc đã hết lượt." }, {}, req);
  }

  const session = getSession(req);
  const email = (body.email || session?.email || "").trim().toLowerCase();

  if (email) {
    const user = await getUser(email);
    if (user) {
      user.activated = true;
      user.activatedAt = new Date().toISOString();
      user.activatedBy = valid.code;
      await saveUser(user);
    }
  }

  await consumeCode(code);

  return json(
    res,
    200,
    {
      ok: true,
      premium: true,
      message: "Kích hoạt thành công. Bạn có thể rút bài không giới hạn.",
    },
    {
      "Set-Cookie": sessionCookie({
        premium: true,
        email: email || null,
        admin: Boolean(session?.admin),
        via: "code",
      }),
    },
    req
  );
};
