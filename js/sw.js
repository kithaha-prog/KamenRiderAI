// ===== Service Worker：素材缓存 =====
// - Assets/（图片、音频）：缓存优先，只下载一次。素材更新后把下面 ASSET_VER 加 1，旧缓存会被清掉重新下载。
// - index.html / js/ 等代码：网络优先（每次校验，不会读到旧代码），断网时用缓存兜底。
// - 音频的 Range 请求（<audio> 拖动/跳转）：从缓存里切片返回 206，避免缓存失效。
const ASSET_VER = 3;
const ASSET_CACHE = 'kr-assets-v' + ASSET_VER;
const CODE_CACHE = 'kr-code-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== ASSET_CACHE && k !== CODE_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

const isAsset = u => /\/Assets\//i.test(u.pathname) || /\.(png|jpe?g|webp|gif|svg|mp3|m4a|ogg|wav|woff2?|ttf|otf)$/i.test(u.pathname);

async function rangeResponse(full, rangeHdr) {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHdr || '');
  if (!m) return full;
  const buf = await full.arrayBuffer(), size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - (+m[2] || 0)) : +m[1];
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  const h = new Headers(full.headers);
  h.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  h.set('Content-Length', String(end - start + 1));
  h.set('Accept-Ranges', 'bytes');
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: h });
}

async function assetFetch(req) {
  const cache = await caches.open(ASSET_CACHE);
  const key = new Request(req.url);                       // 去掉 Range 等头，用 URL 做缓存键
  let hit = await cache.match(key);
  if (!hit) {
    try {
      const res = await fetch(key);                         // 一律拉完整文件
      if (res.ok && res.status === 200) { cache.put(key, res.clone()); hit = res; }
      else return res;
    } catch (err) { return Response.error(); }
  }
  const range = req.headers.get('range');
  return range ? rangeResponse(hit.clone(), range) : hit;
}

async function codeFetch(req) {
  const cache = await caches.open(CODE_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });   // 带 ETag 校验，没改动就是极小的 304
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;          // Supabase / CDN 不拦截
  if (u.pathname.endsWith('/sw.js')) return;
  e.respondWith(isAsset(u) ? assetFetch(req) : codeFetch(req));
});
