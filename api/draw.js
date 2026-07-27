const crypto = require("crypto");
const { setCors, json, readBody } = require("./_lib/http");
const { getSession, clientIp, hashIp } = require("./_lib/auth");
const { hasDrawn, markDrawn } = require("./_lib/store");

function guestCookie(ipHash) {
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const sig = crypto.createHmac("sha256", secret).update(`guest:${ipHash}`).digest("hex").slice(0, 24);
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `tarot_guest=${ipHash}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure}`;
}

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
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" }, {}, req);

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" }, {}, req);
  }

  const session = getSession(req);
  const premium = Boolean(session?.premium);
  const spread = String(body.spread || "1");
  const allowReversed = Boolean(body.allowReversed);
  const ipHash = hashIp(clientIp(req));
  const headers = {};

  if (!premium) {
    if (spread !== "1") {
      return json(
        res,
        403,
        {
          error: "free_limit",
          message: "Khách chỉ được rút 1 lá. Kích hoạt tài khoản để dùng trải 3 lá / tình cảm.",
        },
        {},
        req
      );
    }
    if (allowReversed) {
      return json(
        res,
        403,
        {
          error: "free_limit",
          message: "Lá ngược dành cho tài khoản đã kích hoạt.",
        },
        {},
        req
      );
    }

    const used = (await hasDrawn(ipHash)) || guestAlreadyUsed(req, ipHash);
    if (used) {
      return json(
        res,
        403,
        {
          error: "ip_limit",
          message:
            "IP này đã rút miễn phí 1 lần. Nhập mã kích hoạt hoặc đăng nhập tài khoản đã kích hoạt để rút tiếp.",
        },
        {},
        req
      );
    }
    await markDrawn(ipHash);
    headers["Set-Cookie"] = guestCookie(ipHash);
  }

  return json(res, 200, { ok: true, premium, drawsLeft: premium ? null : 0 }, headers, req);
};
