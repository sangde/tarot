const crypto = require("crypto");
const { setCors, json, readBody } = require("./_lib/http");
const { getSession, freeIdentity } = require("./_lib/auth");
const { hasDrawn, markDrawn, usingRedis } = require("./_lib/store");

function guestUsedCookieValue(key) {
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const sig = crypto.createHmac("sha256", secret).update(`guest:${key}`).digest("hex").slice(0, 24);
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `tarot_guest=${encodeURIComponent(`${key}.${sig}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    60 * 60 * 24 * 365
  }${secure}`;
}

/** True if browser already has a valid used-guest cookie (any key). */
function hasValidGuestUsedCookie(req) {
  const raw = req.headers.cookie || "";
  const m = raw.match(/(?:^|;\s*)tarot_guest=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const storedKey = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!storedKey || !sig) return false;
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const expect = crypto.createHmac("sha256", secret).update(`guest:${storedKey}`).digest("hex").slice(0, 24);
  return sig === expect;
}

function setCookies(headers, cookies) {
  const list = cookies.filter(Boolean);
  if (!list.length) return headers;
  headers["Set-Cookie"] = list.length === 1 ? list[0] : list;
  return headers;
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
  const identity = freeIdentity(req);
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
        setCookies({}, [identity.newGidCookie]),
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
        setCookies({}, [identity.newGidCookie]),
        req
      );
    }

    // Cookie is source of truth without Redis. With Redis, also enforce IP.
    let used = hasValidGuestUsedCookie(req);
    if (!used && usingRedis()) {
      used =
        (await hasDrawn(identity.key)) ||
        (identity.ipKey ? await hasDrawn(identity.ipKey) : false);
    } else if (!used) {
      // memory fallback only by stable guest id (not shared IP bucket)
      used = await hasDrawn(identity.key);
    }

    if (used) {
      return json(
        res,
        403,
        {
          error: "ip_limit",
          message:
            "Bạn đã dùng hết 1 lượt miễn phí trên trình duyệt này. Nhập mã kích hoạt (vd DEMO-UNLOCK) để rút tiếp.",
        },
        setCookies({}, [identity.newGidCookie]),
        req
      );
    }

    await markDrawn(identity.key);
    if (usingRedis() && identity.ipKey) await markDrawn(identity.ipKey);
    setCookies(headers, [identity.newGidCookie, guestUsedCookieValue(identity.key)]);
  }

  return json(res, 200, { ok: true, premium, drawsLeft: premium ? null : 0 }, headers, req);
};
