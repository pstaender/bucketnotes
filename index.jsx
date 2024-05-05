import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { HashRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";

import { registerSW } from "virtual:pwa-register";
import { deleteDatabase, setupDatabase } from "./src/db";

if (window.location.hash === "#reset") {
  localStorage.clear();
  sessionStorage.clear();
  deleteDatabase();
} else {
  setupDatabase();
}

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://996ab580af0a2ef1c2c80563630df19b@o1128238.ingest.us.sentry.io/4507013037228032",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false
      })
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      "localhost" /*, /^https:\/\/yourserver\.io\/api/*/
    ],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });
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
