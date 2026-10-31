import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAbsoluteHttpUrl, normalizeRemoteAtlasBase, rewriteAtlasIndexPreload } from "./src/atlas/root";
// Local-only content is never copied into dist or the public archive.
function localMedia(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const route = (req.url || "").split("?")[0];
  const root = path.resolve(".local");
  if (route === "/local/catalog.json") {
    const file = path.join(root, "catalog.json");
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
    return;
  }
  const match = route.match(
    /^\/local\/media\/(image|uk|us|sentence)\/(\d{1,5})$/,
  );
  if (!match) {
    next();
    return;
  }
  try {
    const map = JSON.parse(
      fs.readFileSync(path.join(root, "media-map.json"), "utf8"),
    );
    const stored = map[match[2]]?.[match[1]];
    const file =
      typeof stored === "string"
        ? path.isAbsolute(stored)
          ? stored
          : path.resolve(root, stored)
        : undefined;
    if (!file || !fs.existsSync(file)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
    };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");
    const size = fs.statSync(file).size;
    const range = req.headers.range;
    if (range) {
      const r = range.match(/^bytes=(\d+)-(\d*)$/);
      const start = r ? Number(r[1]) : -1;
      const end = r && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
      if (start < 0 || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", size);
      fs.createReadStream(file).pipe(res);
    }
  } catch {
    res.statusCode = 404;
    res.end();
  }
}
/** Drop copied `dist/atlas` once `VITE_ATLAS_BASE` points the app at R2. Source `public/atlas` is left in place. */
function omitRemoteAtlas(remote: string): Plugin {
  let outDir = path.resolve("dist");
  const strip = () => {
    const root = path.resolve(outDir);
    const target = path.join(root, "atlas");
    const source = path.resolve("public/atlas");
    if (target === source) throw new Error(`refusing to delete source media at ${target}`);
    if (!fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`[omit-remote-atlas] removed ${target}`);
  };
  return {
    name: "omit-remote-atlas",
    enforce: "post",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      if (!remote) return;
      if (!isAbsoluteHttpUrl(remote)) {
        config.logger.warn(`VITE_ATLAS_BASE should be an absolute http(s) URL. Got: ${remote}`);
      }
      if (config.command === "build") {
        config.logger.info(`Atlas media served from ${remote}; ${path.join(outDir, "atlas")} will be omitted`);
      }
    },
    transformIndexHtml(html) {
      return rewriteAtlasIndexPreload(html, remote);
    },
    closeBundle() {
      if (!remote) return;
      // Public files are copied before the bundle closes. beforeExit covers a later copy.
      strip();
      process.once("beforeExit", strip);
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const remote = normalizeRemoteAtlasBase(process.env.VITE_ATLAS_BASE ?? fileEnv.VITE_ATLAS_BASE);
  return {
    // Deploy under a sub-path with ATLAS_BASE=/words/ npm run build
    base: process.env.ATLAS_BASE || "/",
    plugins: [
      react(),
      {
        name: "private-local-library",
        configureServer(server) {
          server.middlewares.use(localMedia);
        },
        configurePreviewServer(server) {
          server.middlewares.use(localMedia);
        },
      },
      omitRemoteAtlas(remote),
    ],
    server: { port: 5188, strictPort: true },
    preview: { port: 5188, strictPort: true },
    build: { chunkSizeWarningLimit: 600 },
  };
});
