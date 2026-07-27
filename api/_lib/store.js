/**
 * Storage for IP draws + users.
 * Prefer Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * Falls back to in-memory Map (local/dev; not durable across serverless instances).
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
    await redis("SET", [key, value]);
  } catch (e) {
    console.warn("store.set redis", e.message);
  }
}

async function hasDrawn(ipHash) {
  const v = await get(`ip:${ipHash}`);
  return v === "1" || v === 1 || v === true;
}

async function markDrawn(ipHash) {
  await set(`ip:${ipHash}`, "1");
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
}

function usingRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

module.exports = {
  hasDrawn,
  markDrawn,
  getUser,
  saveUser,
  usingRedis,
};
