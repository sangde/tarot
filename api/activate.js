const { setCors, json, readBody } = require("./_lib/http");
const { activationCodes, getSession, sessionCookie } = require("./_lib/auth");
const { getUser, saveUser } = require("./_lib/store");

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

  const code = String(body.code || "")
    .trim()
    .toUpperCase();
  if (!code) {
    return json(res, 400, { error: "missing_code", message: "Nhập mã kích hoạt." }, {}, req);
  }

  if (!activationCodes().has(code)) {
    return json(res, 403, { error: "invalid_code", message: "Mã không hợp lệ." }, {}, req);
  }

  const session = getSession(req);
  const email = (body.email || session?.email || "").trim().toLowerCase();

  if (email) {
    const user = await getUser(email);
    if (user) {
      user.activated = true;
      user.activatedAt = new Date().toISOString();
      user.activatedBy = code;
      await saveUser(user);
    }
  }

  return json(
    res,
    200,
    {
      ok: true,
      premium: true,
      message: "Kích hoạt thành công. Bạn có thể rút bài không giới hạn.",
    },
    { "Set-Cookie": sessionCookie({ premium: true, email: email || null, via: "code" }) },
    req
  );
};
