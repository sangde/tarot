/**
 * Storage for draws, users, and activation codes.
 * Prefer Upstash Redis. Falls back to in-memory (dev / single instance).
 */

const memory = globalThis.__tarotStore || (globalThis.__tarotStore = new Map());

async function redis(command, args = []) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis ${command} failed: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

async function get(key) {
  try {
    const r = await redis("GET", [key]);
    if (r !== null && r !== undefined) return r;
  } catch (e) {
    console.warn("store.get redis", e.message);
  }
  return memory.has(key) ? memory.get(key) : null;
}

async function set(key, value) {
  memory.set(key, value);
  try {
    await redis("SET", [key, String(value)]);
  } catch (e) {
    console.warn("store.set redis", e.message);
  }
}

async function del(key) {
  memory.delete(key);
  try {
    await redis("DEL", [key]);
  } catch (e) {
    console.warn("store.del redis", e.message);
  }
}

async function sadd(key, member) {
  const cur = memory.get(key);
  const setVal = new Set(Array.isArray(cur) ? cur : cur ? [cur] : []);
  setVal.add(member);
  memory.set(key, [...setVal]);
  try {
    await redis("SADD", [key, member]);
  } catch (e) {
    console.warn("store.sadd redis", e.message);
  }
}

async function srem(key, member) {
  const cur = memory.get(key);
  const setVal = new Set(Array.isArray(cur) ? cur : cur ? [cur] : []);
  setVal.delete(member);
  memory.set(key, [...setVal]);
  try {
    await redis("SREM", [key, member]);
  } catch (e) {
    console.warn("store.srem redis", e.message);
  }
}

async function smembers(key) {
  try {
    const r = await redis("SMEMBERS", [key]);
    if (Array.isArray(r)) return r.map(String);
  } catch (e) {
    console.warn("store.smembers redis", e.message);
  }
  const cur = memory.get(key);
  if (Array.isArray(cur)) return cur.map(String);
  return [];
}

async function hasDrawn(key) {
  const v = await get(key);
  return v === "1" || v === 1 || v === true;
}

async function markDrawn(key) {
  await set(key, "1");
}

async function getUser(email) {
  const raw = await get(`user:${email.toLowerCase()}`);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function saveUser(user) {
  const email = user.email.toLowerCase();
  await set(`user:${email}`, JSON.stringify({ ...user, email }));
  await sadd("users:index", email);
}

async function deleteUser(email) {
  const key = email.toLowerCase();
  await del(`user:${key}`);
  await srem("users:index", key);
}

async function listUsers() {
  const emails = await smembers("users:index");
  const users = [];
  for (const email of emails) {
    const u = await getUser(email);
    if (u) {
      users.push({
        email: u.email,
        activated: Boolean(u.activated),
        role: u.role || "user",
        createdAt: u.createdAt || null,
        activatedAt: u.activatedAt || null,
        activatedBy: u.activatedBy || null,
      });
    }
  }
  users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return users;
}

function envCodes() {
  const raw = process.env.ACTIVATION_CODES || "TAROT-VIP-2026,DEMO-UNLOCK";
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((code) => ({
      code,
      note: "ENV",
      maxUses: null,
      used: 0,
      active: true,
      source: "env",
    }));
}

async function getCode(code) {
  const raw = await get(`code:${code.toUpperCase()}`);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function saveCode(codeObj) {
  const code = codeObj.code.toUpperCase();
  const data = {
    code,
    note: codeObj.note || "",
    maxUses: codeObj.maxUses == null || codeObj.maxUses === "" ? null : Number(codeObj.maxUses),
    used: Number(codeObj.used || 0),
    active: codeObj.active !== false,
    createdAt: codeObj.createdAt || new Date().toISOString(),
    source: "store",
  };
  await set(`code:${code}`, JSON.stringify(data));
  await sadd("codes:index", code);
  return data;
}

async function deleteCode(code) {
  const key = code.toUpperCase();
  await del(`code:${key}`);
  await srem("codes:index", key);
}

async function listCodes() {
  const keys = await smembers("codes:index");
  const stored = [];
  for (const code of keys) {
    const c = await getCode(code);
    if (c) stored.push(c);
  }
  const env = envCodes().filter((e) => !stored.some((s) => s.code === e.code));
  return [...stored, ...env].sort((a, b) => a.code.localeCompare(b.code));
}

async function findValidCode(codeInput) {
  const code = String(codeInput || "")
    .trim()
    .toUpperCase();
  if (!code) return null;

  const stored = await getCode(code);
  if (stored) {
    if (!stored.active) return null;
    if (stored.maxUses != null && Number(stored.used || 0) >= Number(stored.maxUses)) return null;
    return stored;
  }

  const fromEnv = envCodes().find((c) => c.code === code);
  return fromEnv || null;
}

async function consumeCode(codeInput) {
  const code = String(codeInput || "")
    .trim()
    .toUpperCase();
  const stored = await getCode(code);
  if (!stored) return true; // env codes: no counter
  stored.used = Number(stored.used || 0) + 1;
  await saveCode(stored);
  return true;
}

function usingRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

module.exports = {
  hasDrawn,
  markDrawn,
  getUser,
  saveUser,
  deleteUser,
  listUsers,
  getCode,
  saveCode,
  deleteCode,
  listCodes,
  findValidCode,
  consumeCode,
  usingRedis,
};
