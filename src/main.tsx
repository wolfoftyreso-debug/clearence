import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

/*
 * Service-workern registreras EFTER att appen renderats, och bara i
 * produktionsbyggen.
 *
 * Efter, för att registreringen aldrig ska konkurrera med första
 * målningen: den som just klickat på en länk i kris ska se innehåll, inte
 * vänta på en installation hen inte bett om.
 *
 * Bara i produktion, för att en service-worker under utveckling cachar
 * moduler som Vite just bytt ut - och då felsöker man sin egen cache i
 * stället för sin kod.
 *
 * Ett fel här får aldrig fälla appen. Workern är en förbättring
 * (installerbarhet och en ärlig offline-sida), inte ett villkor för att
 * tjänsten ska fungera.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Privat läge, blockerad lagring eller osäker origin. Appen fungerar ändå. */
    });
  });
}
