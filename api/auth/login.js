const { setCors, json, readBody } = require("../_lib/http");
const {
  checkPassword,
  sessionCookie,
  adminEmail,
  adminPassword,
  hashPassword,
} = require("../_lib/auth");
const { getUser, saveUser } = require("../_lib/store");

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

  // Built-in admin from env
  if (email === adminEmail() && password === adminPassword()) {
    let user = await getUser(email);
    if (!user) {
      user = {
        email,
        passwordHash: hashPassword(password),
        activated: true,
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      await saveUser(user);
    } else if (user.role !== "admin") {
      user.role = "admin";
      user.activated = true;
      await saveUser(user);
    }

    return json(
      res,
      200,
      {
        ok: true,
        premium: true,
        admin: true,
        email,
        message: "Đăng nhập admin thành công.",
      },
      {
        "Set-Cookie": sessionCookie({
          premium: true,
          email,
          admin: true,
          via: "admin",
        }),
      },
      req
    );
  }

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

  const isAdmin = user.role === "admin";
  const premium = Boolean(user.activated) || isAdmin;

  return json(
    res,
    200,
    {
      ok: true,
      premium,
      admin: isAdmin,
      email: user.email,
      message: premium
        ? isAdmin
          ? "Đăng nhập admin thành công."
          : "Đăng nhập thành công."
        : "Đăng nhập thành công. Tài khoản chưa kích hoạt — nhập mã để mở khóa.",
    },
    {
      "Set-Cookie": sessionCookie({
        premium,
        email: user.email,
        admin: isAdmin,
        via: "login",
      }),
    },
    req
  );
};
