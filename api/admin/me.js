const { setCors, json } = require("../_lib/http");
const { getSession, isAdminSession } = require("../_lib/auth");
const { usingRedis } = require("../_lib/store");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" }, {}, req);

  const session = getSession(req);
  if (!isAdminSession(session)) {
    return json(res, 401, { error: "unauthorized", message: "Cần đăng nhập admin." }, {}, req);
  }

  return json(
    res,
    200,
    {
      ok: true,
      email: session.email,
      admin: true,
      storage: usingRedis() ? "redis" : "memory",
    },
    {},
    req
  );
};
