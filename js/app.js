import { createEngine } from "./core/engine.js";
import { createLandingPage } from "./pages/landing.js";
import { createProjectsPage } from "./pages/projects.js";
import { createAboutPage } from "./pages/about.js";

const factories = {
  landing: createLandingPage,
  projects: createProjectsPage,
  about: createAboutPage
};

function installLinkBehavior() {
  if ("ontouchstart" in window) {
    document.addEventListener(
      "touchstart",
      (event) => {
        const link = event.target.closest("a[href]");
        if (!link) return;
        event.preventDefault();
        if (link.target === "_blank") {
          window.open(link.href, "_blank", "noopener,noreferrer");
        } else {
          location.href = link.href;
        }
      },
      { passive: false }
    );
    return;
  }

  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const link = event.target.closest("a[href]");
    if (!link) return;
    event.preventDefault();
    if (link.target === "_blank") {
      window.open(link.href, "_blank", "noopener,noreferrer");
    } else {
      location.href = link.href;
    }
  });
}

async function boot() {
  const page = document.body.dataset.page || "landing";
  const source = document.getElementById("source");
  const screen = document.getElementById("ascii-screen");
  const factory = factories[page] || factories.landing;
  const config = await factory({ source, screen });
  const engine = createEngine({ element: screen, ...config });
  installLinkBehavior();
  engine.start();
}

boot();