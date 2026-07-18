import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { StoreProvider } from "./lib/store.jsx";
import { AuthProvider } from "./lib/auth.jsx";
// Typefaces: STIX Two Text (scientific-publishing serif, display),
// IBM Plex Sans (body/UI), IBM Plex Mono (scores, codes, data).
import "@fontsource/stix-two-text/600.css";
import "@fontsource/stix-two-text/700.css";
import "@fontsource/stix-two-text/600-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles.css";

// PWA: register the (minimal, non-caching) service worker so the app is
// installable to a phone home screen. Production only — dev behavior and the
// normal browser experience are unchanged.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Fade out the PWA launch splash once the app has mounted. (In a normal browser
// tab the splash is display:none via CSS, so this is a harmless no-op there.)
const splash = document.getElementById("pwa-splash");
if (splash) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      splash.classList.add("hide");
      setTimeout(() => splash.remove(), 500);
    }, 450);
  });
}
