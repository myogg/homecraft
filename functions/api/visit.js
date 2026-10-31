// 门口门牌的访客计数。部署为 Cloudflare Pages Function，路由 /api/visit。
//
// 需要在 Pages 项目里绑定一个 KV namespace，变量名必须是 VISITS：
//   Dashboard → 你的 Pages 项目 → Settings → Bindings → Add → KV namespace
//   Variable name: VISITS      KV namespace: 任选一个（新建一个叫 visits 即可）
//
// 没绑定 KV 时返回 503，前端会静默不显示数字，房子照常可用。

const TTL_DAY = 86400;

export async function onRequest({ request, env }) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (!env.VISITS) return json({ ok: false, reason: 'no-kv' }, 503);

  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('cf-connecting-ip') || '';

  // 同一个 IP 一天只算一次，避免刷新把数字刷上去。只存哈希，不存原始 IP。
  const seenKey = ip ? `seen:${day}:${await digest(ip)}` : '';
  const fresh = Boolean(seenKey) && !(await env.VISITS.get(seenKey));
  if (fresh) await env.VISITS.put(seenKey, '1', { expirationTtl: TTL_DAY + 3600 });

  let total = Number((await env.VISITS.get('total')) || 0);
  let today = Number((await env.VISITS.get(`day:${day}`)) || 0);
  if (fresh) {
    total += 1;
    today += 1;
    // KV 没有原子自增，并发时可能少记一两次；对一个门牌来说足够。
    await Promise.all([
      env.VISITS.put('total', String(total)),
      env.VISITS.put(`day:${day}`, String(today), { expirationTtl: TTL_DAY * 7 }),
    ]);
  }

  return json({ ok: true, total, today, country: request.cf?.country || '' });
}

async function digest(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${s}|jiangxiaoxiao`));
  return Array.from(new Uint8Array(buf).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}
