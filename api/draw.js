const crypto = require("crypto");
const { setCors, json, readBody } = require("./_lib/http");
const { getSession, freeIdentity } = require("./_lib/auth");
const { hasDrawn, markDrawn } = require("./_lib/store");

function guestUsedCookie(key) {
  const secret = process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
  const sig = crypto.createHmac("sha256", secret).update(`guest:${key}`).digest("hex").slice(0, 24);
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `tarot_guest=${encodeURIComponent(`${key}.${sig}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    60 * 60 * 24 * 365
  }${secure}`;
}

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

function setCookies(headers, cookies) {
  const list = cookies.filter(Boolean);
  if (!list.length) return headers;
  // Node/Vercel accepts array for multiple Set-Cookie
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

    const used = (await hasDrawn(identity.key)) || guestCookieUsed(req, identity.key);
    if (used) {
      return json(
        res,
        403,
        {
          error: "ip_limit",
          message:
            "Bạn đã dùng hết 1 lượt miễn phí trên thiết bị/mạng này. Nhập mã kích hoạt hoặc đăng nhập tài khoản đã kích hoạt để rút tiếp.",
        },
        setCookies({}, [identity.newGidCookie]),
        req
      );
    }

    await markDrawn(identity.key);
    setCookies(headers, [identity.newGidCookie, guestUsedCookie(identity.key)]);
  }

  return json(res, 200, { ok: true, premium, drawsLeft: premium ? null : 0 }, headers, req);
};
