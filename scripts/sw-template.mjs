export function renderWorker(version, shell) {
  return `const CACHE = 'posture-${version}';
const shell = ${JSON.stringify(shell)}.map(path => new URL(path, self.registration.scope).href);
const inference = url => url.startsWith(self.registration.scope) && /\\/(mediapipe\\/wasm\\/vision_wasm_(internal|nosimd_internal)\\.(js|wasm)|models\\/pose_landmarker_(lite|full)\\.task)$/.test(url);
self.addEventListener('install', e => e.waitUntil((async () => {
  try {
    const cache = await caches.open(CACHE);
    const previousAssets = new Set();
    for (const key of await caches.keys()) {
      if (!key.startsWith('posture-') || key === CACHE) continue;
      for (const request of await (await caches.open(key)).keys())
        if (inference(request.url)) previousAssets.add(request.url);
    }
    await cache.addAll(shell.concat([...previousAssets]));
    await self.skipWaiting();
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(k => k.startsWith('posture-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message', e => {
  if (e.data?.type !== 'PREPARE') return;
  e.waitUntil((async () => {
    try {
      const model = e.data.model === 'lite' ? 'lite' : 'full';
      const variant = e.data.variant === 'nosimd_internal' ? 'nosimd_internal' : 'internal';
      const urls = [
        './mediapipe/wasm/vision_wasm_' + variant + '.js',
        './mediapipe/wasm/vision_wasm_' + variant + '.wasm',
        './models/pose_landmarker_' + model + '.task'
      ].map(path => new URL(path, self.registration.scope).href);
      const cache = await caches.open(CACHE);
      for (const url of urls) if (!await cache.match(url)) await cache.add(url);
      e.ports[0]?.postMessage({ ok: true });
    } catch { e.ports[0]?.postMessage({ ok: false }); }
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (e.request.mode !== 'navigate' && !shell.includes(url.href) && !inference(url.href)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = e.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : url.href;
    // Public static assets are identical across Origin/request-mode headers.
    return await cache.match(key, { ignoreVary: true }) || fetch(e.request);
  })());
});`;
}
