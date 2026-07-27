const { setCors, json, readBody } = require("../_lib/http");
const { hashPassword, sessionCookie } = require("../_lib/auth");
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
  if (!email || !email.includes("@") || password.length < 6) {
    return json(
      res,
      400,
      {
        error: "invalid_input",
        message: "Email hợp lệ và mật khẩu tối thiểu 6 ký tự.",
      },
      {},
      req
    );
  }

  if (await getUser(email)) {
    return json(res, 409, { error: "exists", message: "Email đã được đăng ký." }, {}, req);
  }

  const user = {
    email,
    passwordHash: hashPassword(password),
    activated: false,
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);

  return json(
    res,
    201,
    {
      ok: true,
      premium: false,
      email,
      message: "Đăng ký thành công. Nhập mã kích hoạt để mở khóa đầy đủ.",
    },
    { "Set-Cookie": sessionCookie({ premium: false, email, via: "register" }) },
    req
  );
};
