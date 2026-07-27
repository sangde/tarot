const crypto = require("crypto");
const { setCors, json } = require("./_lib/http");
const { getSession, clientIp, hashIp } = require("./_lib/auth");
const { hasDrawn, usingRedis } = require("./_lib/store");

function guestAlreadyUsed(req, ipHash) {
  const raw = req.headers.cookie || "";
  const m = raw.match(/(?:^|;\s*)tarot_guest=([^;]+)/);
  if (!m) return false;
  const [hash, sig] = decodeURIComponent(m[1]).split(".");
  if (!hash || !sig) return false;
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const expect = crypto
    .createHmac("sha256", secret)
    .update(`guest:${hash}`)
    .digest("hex")
    .slice(0, 24);
  if (sig !== expect) return false;
  return hash === ipHash;
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
  const ipHash = hashIp(clientIp(req));
  const drawn = premium ? false : (await hasDrawn(ipHash)) || guestAlreadyUsed(req, ipHash);

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
    },
    {},
    req
  );
};
