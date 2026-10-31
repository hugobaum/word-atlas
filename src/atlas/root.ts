/**
 * Directory that contains `index.json` (and `entries/`, `img/`, `thumb/`, `audio/`).
 * A remote base replaces the same-origin `{site}/atlas` path. A trailing slash is ignored.
 */
export function resolveAtlasRoot(siteBase: string, remoteBase?: string | null): string {
  const remote = normalizeRemoteAtlasBase(remoteBase);
  if (remote) return remote;
  return `${siteBase.replace(/\/$/, "")}/atlas`;
}

/** Trimmed remote base, or "" when atlas media should stay on the site origin. */
export function normalizeRemoteAtlasBase(remoteBase?: string | null): string {
  return (remoteBase ?? "").trim().replace(/\/+$/, "");
}

/** Absolute http(s) URL. Relative site paths such as `/atlas/img/a.webp` are not remote. */
export function isAbsoluteHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

const ATLAS_INDEX_PRELOAD = /(href=")(?:%BASE_URL%|(?:(?!atlas\/index\.json)[^"])*)atlas\/index\.json(")/;

/** Point the index preload at R2 when a remote base is set. Unset leaves the tag unchanged. */
export function rewriteAtlasIndexPreload(html: string, remoteBase?: string | null): string {
  const remote = normalizeRemoteAtlasBase(remoteBase);
  if (!remote) return html;
  return html.replace(ATLAS_INDEX_PRELOAD, `$1${remote}/index.json$2`);
}
