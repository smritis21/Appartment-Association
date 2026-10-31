import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./i18n"; // Bug 23: initialize i18next before the app renders

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
