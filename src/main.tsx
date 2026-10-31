import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { normalizeRemoteAtlasBase } from "./atlas/root";
import App from "./App";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const remote = normalizeRemoteAtlasBase(import.meta.env.VITE_ATLAS_BASE);
    const q = remote ? `?atlas=${encodeURIComponent(remote)}` : "";
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js${q}`).catch(() => null);
  });
}
