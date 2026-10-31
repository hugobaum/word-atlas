/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute URL of the directory that contains `index.json`
   * (`entries/`, `img/`, `thumb/`, `audio/` sit beside it).
   * Trailing slash optional. Unset: same-origin `{BASE_URL}atlas/`.
   */
  readonly VITE_ATLAS_BASE?: string;
}
