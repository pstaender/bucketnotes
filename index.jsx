import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import { registerSW } from "virtual:pwa-register";
import { deleteDatabase, setupDatabase } from "./src/db";

// if nothing works, try #reset
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
  onOfflineReady() {},
  onNeedRefresh() {
    if (confirm("New app available. Reload?")) {
      updateSW(true);
    }
  },
});

const container = document.getElementById("app");
const root = createRoot(container);

// A data router (createBrowserRouter/createHashRouter + RouterProvider) is
// required so the app can use useBlocker() to warn about unsaved changes on
// in-app navigation.
// Set VITE_APP_ROUTER=HashRouter in .env to use hash-based routing (needed
// when the app is served from a static host without SPA fallback routing).
// Also enable it on PWA, to ensure that the manifest scope is respected.
// Any other value (or unset) defaults to path-based BrowserRouter.
const createRouter =
  import.meta.env.VITE_APP_ROUTER === "HashRouter" ||
  new URLSearchParams(document.location.search).get("source") === 'pwa'
    ? createHashRouter
    : createBrowserRouter;

const router = createRouter(
  [
    {
      path: "*",
      element: (
        <App
          version={import.meta.env.VITE_APP_VERSION}
          appName="bucketnotes.app"
        />
      ),
    },
  ],
  { future: { v7_relativeSplatPath: true } },
);

root.render(
  <RouterProvider router={router} future={{ v7_startTransition: true }} />,
);
