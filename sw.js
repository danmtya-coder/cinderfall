/* SYLVELIGHT — service worker (WEB-01, ADR-036). Gabarit : tools/_sw-rust.js y inscrit la version et la liste.
   Le jeu se lance hors ligne après une première visite, et personne ne reste bloqué sur une vieille version :
   - la page est demandée au réseau d'abord ; le cache ne sert que sans réseau (ou réseau trop lent) ;
   - le WebAssembly et le chargeur ont une adresse versionnée (?v=…) : le cache ne rend que l'adresse exacte, donc
     jamais un binaire d'une version avec la page d'une autre ;
   - rien n'est mis en cache hors de l'installation, et l'installation échoue en entier si un seul fichier manque :
     un chargement raté n'est jamais gardé. */
const V = 'sylve-63f6c987f0e9', ASSETS = ["cinderfall.wasm?v=57082514dba0","icon-180.png","icon-192.png","icon-512.png","icon.svg","./","manifest-en.webmanifest","manifest.webmanifest","mq_js_bundle.js?v=57082514dba0","rust/"];
const ATTENTE_MS = 4000; // réseau muet : au-delà, la page gardée en cache démarre le jeu
const RACINE = new URL('./', location).pathname;
// les pages du site : la racine (le jeu) et /rust/ (l'ancienne adresse, qui renvoie à la racine avec sa requête)
const PAGES = { [RACINE]: './', [RACINE + 'index.html']: './', [RACINE + 'rust/']: 'rust/', [RACINE + 'rust/index.html']: 'rust/' };
const garde = () => caches.open(V);

self.addEventListener('install', e => {
  e.waitUntil(garde().then(c => Promise.all(ASSETS.map(u =>
    // une adresse versionnée ne change jamais de contenu : le cache du navigateur suffit (pas de second téléchargement)
    fetch(new Request(u, { cache: u.includes('?v=') ? 'default' : 'reload' })).then(r => {
      if (!r || !r.ok) throw new Error('précache : ' + u);
      return c.put(u, r.redirected ? new Response(r.body, { status: r.status, headers: r.headers }) : r);
    })))).then(() => self.skipWaiting(), err => caches.delete(V).then(() => { throw err; })));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => {
    // « cf- » : les caches du jeu JS, qui occupait la racine avant ADR-036
    const vieux = ks.filter(k => (k.startsWith('sylve-') || k.startsWith('cf-')) && k !== V), js = vieux.some(k => k.startsWith('cf-'));
    return Promise.all(vieux.map(k => caches.delete(k))).then(() => self.clients.claim())
      // une page du jeu JS encore ouverte (servie par son ancien cache) est rechargée une fois : elle devient le vrai jeu.
      // Sans attendre la fin du rechargement : il passe par ce service worker, qui ne répond qu'une fois activé.
      .then(() => { if (js) self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.navigate(c.url).catch(() => {}))); });
  }));
});

function page(r, cle) {
  const gardee = () => garde().then(c => c.match(cle, { ignoreVary: true }));
  return new Promise(rendre => {
    let fini = false;
    const une = x => { if (!fini) { fini = true; rendre(x); } };
    const t = setTimeout(() => gardee().then(hit => { if (hit) une(hit); }), ATTENTE_MS);
    fetch(r).then(res => { clearTimeout(t); if (res && res.ok) une(res); else gardee().then(hit => une(hit || res)); },
      () => { clearTimeout(t); gardee().then(hit => une(hit || Response.error())); });
  });
}

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (r.mode === 'navigate') {
    const cle = PAGES[u.pathname];
    if (cle) e.respondWith(page(r, cle)); // la requête (?seed=…) reste dans l'adresse : la page la lit elle-même
    return;
  }
  e.respondWith(garde().then(c => c.match(r, { ignoreVary: true })).then(hit => hit || fetch(r)));
});
