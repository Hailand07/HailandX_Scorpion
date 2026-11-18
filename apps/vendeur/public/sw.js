/*
 * Service minimal des applications Hailand (§60) : rien n'est mis en cache, les pages viennent toujours du réseau.
 * Seul ajout : sans connexion, une page « Pas de connexion » au lieu de l'erreur du navigateur.
 */
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pas de connexion</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f6f4ef;color:#12141c;font-family:system-ui,sans-serif}
main{max-width:22rem;padding:2rem 1.5rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .6rem}p{color:#5f6372;font-weight:500;line-height:1.5;margin:0 0 1.5rem}
button{height:3.2rem;width:100%;border:0;border-radius:1rem;background:#12141c;color:#ffffff;font-size:1rem;font-weight:800}</style></head>
<body><main><h1>Pas de connexion</h1><p>Vérifiez vos données mobiles ou le Wi-Fi, puis réessayez.</p><button onclick="location.reload()">Réessayer</button></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
