// API do Blefe no Vercel. Guarda as mesas no Upstash Redis (plano grátis) pela API REST, sem dependências.
// Variáveis criadas sozinhas ao conectar o Upstash no painel do Vercel:
//   KV_REST_API_URL + KV_REST_API_TOKEN   (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24 * 3; // mesas somem sozinhas 3 dias depois da última jogada
const PATH_OK = /^[A-Za-z0-9_\-.~:@+]{1,60}(\/[A-Za-z0-9_\-.~:@+]{1,60}){1,3}$/;

async function redis(route, body) {
  const r = await fetch(URL_ + route, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("Redis respondeu " + r.status);
  return r.json();
}
const unwrap = arr => arr.map(x => { if (x && x.error) throw new Error(x.error); return x.result; });
const cmd = (...a) => redis("", a).then(j => { if (j.error) throw new Error(j.error); return j.result; });
const multi = cmds => redis("/multi-exec", cmds).then(unwrap);

function merge(alvo, fonte) {
  for (const [k, v] of Object.entries(fonte)) {
    if (v && typeof v === "object" && !Array.isArray(v) && alvo[k] && typeof alvo[k] === "object" && !Array.isArray(alvo[k])) merge(alvo[k], v);
    else alvo[k] = v;
  }
}
async function readDoc(kd, kv, kr) {
  const [d, v, r] = await multi([["GET", kd], ["GET", kv], ["HGETALL", kr]]);
  if (!d) return { v: Number(v || 0), data: null };
  const data = JSON.parse(d);
  data.resp = {};
  for (let i = 0; i + 1 < (r || []).length; i += 2) { try { data.resp[r[i]] = JSON.parse(r[i + 1]); } catch (e) {} }
  return { v: Number(v || 0), data };
}
const respFields = resp => Object.entries(resp || {}).flatMap(([k, v]) => [k, JSON.stringify(v)]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "unavailable", message: "Banco não configurado: conecte o Upstash Redis em Storage, no painel do projeto no Vercel, e faça Redeploy." });
  if (req.method !== "POST") return res.status(405).json({ error: "invalid_argument" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const op = String((req.query && req.query.op) || "");
  const path = body.path;
  if (typeof path !== "string" || !PATH_OK.test(path)) return res.json({ error: "invalid_argument" });
  const kd = "d:" + path, kv = "v:" + path, kr = "r:" + path;
  try {
    switch (op) {
      case "get": return res.json(await readDoc(kd, kv, kr));
      case "watch": {
        const v = Number((await cmd("GET", kv)) || 0);
        if (v === body.since) return res.json({ v, same: true });
        return res.json(await readDoc(kd, kv, kr));
      }
      case "set": {
        const data = body.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) return res.json({ error: "invalid_argument" });
        const json = JSON.stringify(data);
        if (json.length > 200000) return res.json({ error: "invalid_argument" });
        const { resp, ...rest } = data;
        const f = respFields(resp);
        const cmds = [["SET", kd, JSON.stringify(rest), "EX", TTL], ["DEL", kr]];
        if (f.length) cmds.push(["HSET", kr, ...f], ["EXPIRE", kr, TTL]);
        cmds.push(["INCR", kv], ["EXPIRE", kv, TTL]);
        await multi(cmds);
        return res.json({ ok: true });
      }
      case "update": {
        const data = body.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) return res.json({ error: "invalid_argument" });
        if (!(await cmd("EXISTS", kd))) return res.json({ error: "invalid_argument" });
        const { resp, ...rest } = data;
        const cmds = [];
        if (Object.keys(rest).length) { const cur = JSON.parse((await cmd("GET", kd)) || "{}"); merge(cur, rest); cmds.push(["SET", kd, JSON.stringify(cur), "EX", TTL]); }
        const f = respFields(resp);
        if (f.length) cmds.push(["HSET", kr, ...f], ["EXPIRE", kr, TTL]);
        cmds.push(["INCR", kv]);
        await multi(cmds);
        return res.json({ ok: true });
      }
      case "delete": await multi([["DEL", kd], ["DEL", kr], ["INCR", kv]]); return res.json({ ok: true });
      case "acquire": {
        const kl = "l:" + path, holder = String(body.holder || "").slice(0, 80);
        const ttl = Math.min(600000, Math.max(1000, Number(body.ttlMs) || 30000));
        if ((await cmd("SET", kl, holder, "NX", "PX", ttl)) === "OK") return res.json({ acquired: true, holder });
        const [cur, pttl] = await multi([["GET", kl], ["PTTL", kl]]);
        if (cur === null || cur === holder) { await cmd("SET", kl, holder, "PX", ttl); return res.json({ acquired: true, holder }); }
        return res.json({ acquired: false, expiresAt: new Date(Date.now() + Math.max(0, Number(pttl) || 0)).toISOString() });
      }
      default: return res.json({ error: "invalid_argument" });
    }
  } catch (e) {
    return res.status(500).json({ error: "unavailable", message: String((e && e.message) || e) });
  }
}
