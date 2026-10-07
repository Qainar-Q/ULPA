import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/auth.css";
import "./styles/photos.css";
import "./styles/tasks.css";
import "./styles/extras.css";
import App from "./App.jsx";
import { applyTheme, watchSystemTheme } from "./lib/theme.js";
import { startPwaUpdates } from "./lib/pwaUpdate.js";
import UpdateToast from "./components/UpdateToast.jsx";

applyTheme();
watchSystemTheme();
startPwaUpdates();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <UpdateToast />
    </BrowserRouter>
  </React.StrictMode>
);
