# Cloudflare Pages + R2

`public/atlas` is about 37,500 files (~630 MB of WebP, MP3, entry JSON, and `index.json`). Cloudflare Pages' free plan allows at most 20,000 files in one deployment and 25 MiB per file, so a build that publishes that folder fails. The files stay in the repo. Set `VITE_ATLAS_BASE` at build time to the public URL of the directory that contains `index.json`. The app then loads atlas JSON, images, and audio from there, and the production build removes `dist/atlas` after Vite has copied `public/`.

`brand/`, `sfx/`, the favicon, and the web manifest stay on Pages. Learning progress stays in `localStorage`. There is no backend.

Leave `VITE_ATLAS_BASE` unset for local work. `npm run dev` still serves `public/atlas` at `/atlas/…`.

`ATLAS_BASE` is a different variable. It sets Vite's `base` (`/words/`) when the **app** is hosted under a subpath. It is not the R2 URL.

## URL shape

`VITE_ATLAS_BASE` is an absolute `http(s)` URL of the folder that contains `index.json`. A trailing slash is optional and stripped. Do not append `index.json`.

Upload so the object keys keep the paths inside `public/atlas` under an `atlas/` prefix (`atlas/index.json`, `atlas/entries/0.json`, `atlas/img/….webp`, `atlas/audio/…`). Then:

```bash
VITE_ATLAS_BASE=https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas
```

The app requests:

| File | URL |
| --- | --- |
| Index | `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas/index.json` |
| Entry chunk | `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas/entries/0.json` |
| Illustration | `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas/img/<id>.webp` |
| Thumbnail | `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas/thumb/<id>.webp` |
| Audio | `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas/audio/<uk\|us\|ex\|ex2>/<id>.mp3` |

If `index.json` is stored at the bucket root instead, drop the `/atlas` suffix: `https://pub-xxxxxxxxxxxxxxxx.r2.dev`.

## 1. Create the bucket

1. Cloudflare dashboard → **R2** → **Create bucket**, for example `word-atlas`.
2. Open the bucket → **Settings** → **Public access**.
3. Enable the `r2.dev` subdomain, or connect a custom domain.
4. Copy the public origin, for example `https://pub-xxxxxxxxxxxxxxxx.r2.dev`.

Until public access is on, the browser cannot read the objects. The site sends unauthenticated GETs only.

## 2. Upload `public/atlas` and keep the paths

[rclone](https://rclone.org/install/) is the upload that preserves the tree. `rclone config` a remote named `r2`:

- Storage: `s3`
- Provider: `Cloudflare`
- Access key id and secret: an R2 token with Object Read & Write on this bucket
- Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- Region empty, ACL private

`rclone copy` transfers the **contents** of the source directory (as `rsync` does with a trailing slash) and recreates every relative path:

```bash
rclone copy public/atlas r2:word-atlas/atlas --progress --transfers 16 --checkers 32
```

Objects land at `atlas/index.json`, not `atlas/public/atlas/index.json`. Run it again later; unchanged files are skipped.

rclone sets `Content-Type` from the extension. Spot-check `application/json`, `image/webp`, and `audio/mpeg`.

Wrangler writes one object per invocation (up to 315 MB), which is a useful smoke test and a poor way to push ~37,500 files:

```bash
npx wrangler r2 object put word-atlas/atlas/index.json \
  --file public/atlas/index.json \
  --content-type application/json
```

The same CLI can `wrangler r2 bulk put` from a JSON list of `{ "key", "file" }` pairs. Prefer rclone for this folder.

## 3. CORS

`fetch()` of `index.json` and `entries/*.json` reads a JSON body from another origin, so the response must include `Access-Control-Allow-Origin` for the Pages host. Share cards draw illustrations with `crossOrigin = "anonymous"`; without that header the canvas is tainted and the PNG export fails. Word audio uses `new Audio(url)` and plays as a normal media request, so it does not need CORS to start. The starfield is drawn procedurally and does not upload atlas images as WebGL textures.

Allow `GET` and `HEAD`. Also allow the `Range` request header so a media request that includes it is not rejected. Origins are `scheme://host` only, with no path.

In the dashboard: bucket → **Settings** → **CORS policy** → JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://<project>.pages.dev",
      "https://*.<project>.pages.dev"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

`https://*.<project>.pages.dev` covers preview deployments. Add a custom domain origin as another entry if you have one.

`wrangler r2 bucket cors set` does not accept the S3-style keys above. Save this file as `cors.json` and apply it (it is the same policy):

```json
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://<project>.pages.dev",
          "https://*.<project>.pages.dev"
        ],
        "methods": ["GET", "HEAD"],
        "headers": ["Range"]
      },
      "exposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
      "maxAgeSeconds": 86400
    }
  ]
}
```

```bash
npx wrangler r2 bucket cors set word-atlas --file cors.json
npx wrangler r2 bucket cors list word-atlas
```

The service worker is registered as `sw.js?atlas=<VITE_ATLAS_BASE>` in production when the variable is set, and then caches that origin the same way it caches same-origin `/atlas/` (network-first for `index.json`, cache-first otherwise). With the variable unset, the registration URL is still `sw.js`. `manifest.webmanifest` does not reference atlas files. `sfx/` and `brand/` stay same-origin.

## 4. Pages

| Setting | Value |
| --- | --- |
| Production branch | the branch you deploy |
| Framework preset | Vite, or None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root |
| Variable | `VITE_ATLAS_BASE` = `https://pub-xxxxxxxxxxxxxxxx.r2.dev/atlas` |
| Node.js | 20 or newer (`NODE_VERSION` = `22` if the image defaults lower) |

Do not set `ATLAS_BASE` unless this Pages project is served from a subpath.

Pages runs the install from `package-lock.json` itself; the build command stays `npm run build` (`tsc -b && vite build`).

With the variable set, `dist/` has no `atlas/` directory, so the upload is far under 20,000 files and no remaining file is over 25 MiB (`brand/` and `sfx/` stay). With the variable unset, the build still copies `public/atlas` into `dist/` for hosts that can take it.
