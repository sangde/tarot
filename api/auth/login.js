const { setCors, json, readBody } = require("../_lib/http");
const { checkPassword, sessionCookie } = require("../_lib/auth");
const { getUser } = require("../_lib/store");

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

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const user = await getUser(email);
  if (!user || !checkPassword(password, user.passwordHash)) {
    return json(
      res,
      401,
      { error: "auth", message: "Email hoặc mật khẩu không đúng." },
      {},
      req
    );
  }

  return json(
    res,
    200,
    {
      ok: true,
      premium: Boolean(user.activated),
      email: user.email,
      message: user.activated
        ? "Đăng nhập thành công."
        : "Đăng nhập thành công. Tài khoản chưa kích hoạt — nhập mã để mở khóa.",
    },
    {
      "Set-Cookie": sessionCookie({
        premium: Boolean(user.activated),
        email: user.email,
        via: "login",
      }),
    },
    req
  );
};
