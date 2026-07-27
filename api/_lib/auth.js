const crypto = require("crypto");

const COOKIE = "tarot_session";
const DAY = 24 * 60 * 60;

function secret() {
  return process.env.AUTH_SECRET || "tarot-dev-secret-change-me";
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expect = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(body).toString("utf8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(next, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function headerValue(headers, name) {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : null;
}

function clientIp(req) {
  const headers = req.headers || {};
  const candidates = [
    headerValue(headers, "x-vercel-forwarded-for"),
    headerValue(headers, "x-real-ip"),
    headerValue(headers, "cf-connecting-ip"),
    headerValue(headers, "x-forwarded-for"),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ip = String(raw).split(",")[0].trim().replace(/^::ffff:/, "");
    if (!ip || ip === "0.0.0.0" || ip === "::" || ip === "127.0.0.1") continue;
    return ip;
  }
  const socketIp = req.socket?.remoteAddress?.replace(/^::ffff:/, "");
  if (socketIp && socketIp !== "0.0.0.0" && socketIp !== "::" && socketIp !== "127.0.0.1") {
    return socketIp;
  }
  return null;
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(`${secret()}:${ip || "unknown"}`).digest("hex").slice(0, 32);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function mintGuestId() {
  return crypto.randomBytes(16).toString("hex");
}

function guestIdCookie(gid) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `tarot_gid=${encodeURIComponent(gid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}${secure}`;
}

/** Stable free-tier identity: always key by guest id cookie; IP is optional extra. */
function freeIdentity(req) {
  const ip = clientIp(req);
  const cookies = parseCookies(req);
  let gid = cookies.tarot_gid;
  let newGidCookie = null;
  if (!gid) {
    gid = mintGuestId();
    newGidCookie = guestIdCookie(gid);
  }
  return {
    key: `gid:${gid}`,
    ipKey: ip ? `ip:${hashIp(ip)}` : null,
    ip,
    gid,
    newGidCookie,
  };
}

function getSession(req) {
  const cookies = parseCookies(req);
  return verify(cookies[COOKIE]);
}

function sessionCookie(payload, maxAgeSec = 30 * DAY) {
  const token = sign({ ...payload, exp: Date.now() + maxAgeSec * 1000 });
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function activationCodes() {
  const raw = process.env.ACTIVATION_CODES || "TAROT-VIP-2026,DEMO-UNLOCK";
  return new Set(
    raw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
  );
}

function adminEmail() {
  return (process.env.ADMIN_EMAIL || "admin@tarot.local").trim().toLowerCase();
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "TarotAdmin@2026";
}

function isAdminSession(session) {
  return Boolean(session?.admin);
}

module.exports = {
  COOKIE,
  sign,
  verify,
  hashPassword,
  checkPassword,
  clientIp,
  hashIp,
  getSession,
  sessionCookie,
  clearSessionCookie,
  activationCodes,
  freeIdentity,
  guestIdCookie,
  adminEmail,
  adminPassword,
  isAdminSession,
};
