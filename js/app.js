import { createEngine } from "./core/engine.js";
import { runAsciiPreloader } from "./core/preloader.js";
import { createLandingPage } from "./pages/landing.js";
import { createProjectsPage } from "./pages/projects.js";
import { createAboutPage } from "./pages/about.js";

const factories = {
  landing: createLandingPage,
  projects: createProjectsPage,
  about: createAboutPage
};

const PRELOADER_KEY = "violabylucas-preloader-seen";
const RETURN_TO_LANDING_KEY = "violabylucas-return-to-landing";

const LOADER_DESKTOP = String.raw`
     ██╗   ██╗██╗ ██████╗ ██╗      █████╗    ██████╗ ██╗   ██╗   ██╗     ██╗   ██╗ ██████╗ █████╗ ███████╗
    ██║   ██║██║██╔═══██╗██║     ██╔══██╗   ██╔══██╗╚██╗ ██╔╝   ██║     ██║   ██║██╔════╝██╔══██╗██╔════╝
   ██║   ██║██║██║   ██║██║     ███████║   ██████╔╝ ╚████╔╝    ██║     ██║   ██║██║     ███████║███████╗
  ╚██╗ ██╔╝██║██║   ██║██║     ██╔══██║   ██╔══██╗  ╚██╔╝     ██║     ██║   ██║██║     ██╔══██║╚════██║
  ╚████╔╝ ██║╚██████╔╝███████╗██║  ██║   ██████╔╝   ██║      ███████╗╚██████╔╝╚██████╗██║  ██║███████║
   ╚═══╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═════╝    ╚═╝      ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝
`.trimEnd();

const LOADER_TABLET = String.raw`
       
  ██   █  ██  ████  █     ███      █████  █ █      ██    █  █   ██   ███   ███
  ██ █   ██  █  █  █    █   █     ███     ██      ██    █  █  █    █   █   ██
  ██   ██  ████   ███  █ █ █    █████   ██       ████   ██   ███  █ █ █  ███
`.trimEnd();

const LOADER_MOBILE = String.raw`
┌────────┐
│ viola. │
│        │
└───┐    └───────┐
    │     By     │ 
    ├────        └──────────┐
    │       Lucas           │
    └────────────┐          │
                 │Portfolio.│
     ▞ hi there  └──────────┘
`.trimEnd();

function getNavigationType() {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry?.type || "navigate";
}

function hasSeenPreloader() {
  try {
    return sessionStorage.getItem(PRELOADER_KEY) === "1";
  } catch {
    return false;
  }
}

function markPreloaderSeen() {
  try {
    sessionStorage.setItem(PRELOADER_KEY, "1");
  } catch {}
}

function consumeReturnToLandingFlag() {
  try {
    const isReturning = sessionStorage.getItem(RETURN_TO_LANDING_KEY) === "1";
    sessionStorage.removeItem(RETURN_TO_LANDING_KEY);
    return isReturning;
  } catch {
    return false;
  }
}

function markReturnToLanding() {
  try {
    sessionStorage.setItem(RETURN_TO_LANDING_KEY, "1");
  } catch {}
}

function isLandingHref(href) {
  if (!href) return false;

  const normalized = href.trim();

  return (
    normalized === "./index.html" ||
    normalized === "index.html" ||
    normalized === "/" ||
    normalized === "./"
  );
}

function shouldRunPreloader(page) {
  if (page !== "landing") return false;

  const navigationType = getNavigationType();

  if (navigationType === "reload") {
    return true;
  }

  if (navigationType === "back_forward") {
    return false;
  }

  if (consumeReturnToLandingFlag()) {
    return false;
  }

  return !hasSeenPreloader();
}

function installLinkBehavior() {
  if ("ontouchstart" in window) {
    document.addEventListener(
      "touchstart",
      (event) => {
        const link = event.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");
        if (isLandingHref(href)) {
          markReturnToLanding();
        }

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

    const href = link.getAttribute("href");
    if (isLandingHref(href)) {
      markReturnToLanding();
    }

    event.preventDefault();

    if (link.target === "_blank") {
      window.open(link.href, "_blank", "noopener,noreferrer");
    } else {
      location.href = link.href;
    }
  });
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    const loader = document.getElementById("ascii-loader");
    if (loader) loader.remove();
  }
});

async function boot() {
  const page = document.body.dataset.page || "landing";
  const source = document.getElementById("source");
  const screen = document.getElementById("ascii-screen");
  const loader = document.getElementById("ascii-loader");
  const factory = factories[page] || factories.landing;

  if (page === "landing" && loader) {
    if (shouldRunPreloader(page)) {
      await runAsciiPreloader({
        element: loader,
        marks: [LOADER_DESKTOP, LOADER_TABLET, LOADER_MOBILE],
        duration: 1350,
        hold: 160,
        fade: 480,
        unrevealedChar: "."
      });

      markPreloaderSeen();
    } else {
      loader.remove();
    }
  } else if (loader) {
    loader.remove();
  }

  const config = await factory({ source, screen });

  if (typeof config.mount === "function") {
    await config.mount();
  }

  const engine = createEngine({ element: screen, ...config });
  installLinkBehavior();
  engine.start();
}


boot();