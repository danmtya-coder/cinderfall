/* CINDERFALL — service worker (W-01). Gabarit : tools/build.js y injecte la version et la liste de précache.
   Cache d'abord : après une première visite, le jeu se lance hors ligne. Une nouvelle version s'installe en arrière-plan
   et sert au lancement suivant — jamais en pleine partie (tout le jeu tient dans index.html, chargé une fois). */
const V = 'cf-806853f0d11e', ASSETS = ["./","manifest.json","icon.svg","icon-192.png","icon-512.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('cf-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  // navigation vers la page du jeu (y compris ?seed=… pour W-05) → la page en cache. Les autres pages du site
  // (ex. /rust/, la version Rust en test, ADR-008) ne sont jamais détournées vers le jeu JS.
  if (r.mode === 'navigate' && new URL(r.url).pathname !== new URL('./', location).pathname) return;
  e.respondWith(caches.open(V).then(c => c.match(r.mode === 'navigate' ? './' : r, { ignoreSearch: true }).then(hit => hit || fetch(r))));
});
