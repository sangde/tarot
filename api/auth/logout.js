const { setCors, json } = require("../_lib/http");
const { clearSessionCookie } = require("../_lib/auth");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" }, {}, req);

  return json(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() }, req);
};
