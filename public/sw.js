/* Word Atlas offline cache: app shell network-first, everything else cache-first.
   When the page registers sw.js?atlas=<base>, media on that origin is cached too. */
const VERSION = "atlas-v1";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

function remoteAtlasRoot() {
  const raw = new URL(self.location.href).searchParams.get("atlas");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { origin: u.origin, path: u.pathname.replace(/\/+$/, "") };
  } catch {
    return null;
  }
}

const REMOTE = remoteAtlasRoot();

function isRemoteAtlas(url) {
  if (!REMOTE || url.origin !== REMOTE.origin) return false;
  if (!REMOTE.path) return true;
  return url.pathname === REMOTE.path || url.pathname.startsWith(`${REMOTE.path}/`);
}

function isAtlasMedia(url) {
  if (url.origin === location.origin) return /\/atlas\/(img|thumb|audio)\//.test(url.pathname);
  if (!isRemoteAtlas(url)) return false;
  const rel = REMOTE.path ? url.pathname.slice(REMOTE.path.length) : url.pathname;
  return /^\/(img|thumb|audio)\//.test(rel);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !isRemoteAtlas(url)) return;
  const isShell = req.mode === "navigate" || url.pathname.endsWith("/index.json");
  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const media = isAtlasMedia(url);
          // Same-origin responses are "basic". Remote JSON and CORS images are "cors".
          // <audio> and <img> without crossorigin are opaque; only media is stored that way.
          const storable = (res.ok && (res.type === "basic" || res.type === "cors")) || (res.type === "opaque" && media);
          if (storable) {
            const copy = res.clone();
            const name = media ? MEDIA : SHELL;
            caches.open(name).then((c) => c.put(req, copy)).then(() => name === MEDIA && trim(MEDIA, 1500));
          }
          return res;
        }),
    ),
  );
});
