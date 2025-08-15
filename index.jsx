import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { HashRouter } from "react-router-dom";

import { registerSW } from "virtual:pwa-register";
import { deleteDatabase, setupDatabase } from "./src/db";

if (window.location.hash === "#reset") {
  localStorage.clear();
  sessionStorage.clear();
  deleteDatabase();
} else {
  setupDatabase();
}

// see: https://vite-pwa-org.netlify.app/guide/auto-update.html#ready-to-work-offline
// make this app work offline
const updateSW = registerSW({
  onOfflineReady() {
  },
  onNeedRefresh() {
    if (confirm("New app available. Reload?")) {
      updateSW(true);
    }
  },
});


const container = document.getElementById("app");
const root = createRoot(container);
root.render(
  <HashRouter>
    <App version={import.meta.env.VITE_APP_VERSION} appName="bucketnotes.app" />
  </HashRouter>
);
