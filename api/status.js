const crypto = require("crypto");
const { setCors, json } = require("./_lib/http");
const { getSession, freeIdentity } = require("./_lib/auth");
const { hasDrawn, usingRedis } = require("./_lib/store");

function guestCookieUsed(req, key) {
  const raw = req.headers.cookie || "";
  const m = raw.match(/(?:^|;\s*)tarot_guest=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const storedKey = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const expect = crypto.createHmac("sha256", secret).update(`guest:${storedKey}`).digest("hex").slice(0, 24);
  if (sig !== expect) return false;
  return storedKey === key;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" }, {}, req);

  const session = getSession(req);
  const premium = Boolean(session?.premium);
  const identity = freeIdentity(req);
  const drawn = premium
    ? false
    : (await hasDrawn(identity.key)) || guestCookieUsed(req, identity.key);

  const headers = {};
  if (identity.newGidCookie) headers["Set-Cookie"] = identity.newGidCookie;

  return json(
    res,
    200,
    {
      premium,
      email: session?.email || null,
      drawsLeft: premium ? null : drawn ? 0 : 1,
      features: {
        multiSpread: premium,
        reversed: premium,
        libraryFull: premium,
        unlimitedDraws: premium,
      },
      storage: usingRedis() ? "redis" : "memory+cookie",
      ipDetected: Boolean(identity.ip),
    },
    headers,
    req
  );
};
