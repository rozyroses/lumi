import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ElleApp from "./ElleApp";
import "./elle.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/lumi/service-worker.js"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ElleApp />
  </StrictMode>,
);
