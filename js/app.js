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

const TOUCH_TAP_THRESHOLD_PX = 12;
const NAVIGATION_UNLOCK_MS = 400;
const TOUCH_PRESS_EFFECT_MS = 180;
const TOUCH_NAV_DELAY_MS = 85;

let navigationLocked = false;
let touchPressCleanupTimeout = 0;

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

function updateInputModeClass() {
  const isTouchUI =
    window.matchMedia("(hover: none), (pointer: coarse)").matches;

  document.documentElement.classList.toggle("touch-ui", isTouchUI);

  if (!isTouchUI) {
    delete document.documentElement.dataset.touchPressedUntil;
  }
}

function triggerTouchPressFeedback() {
  const root = document.documentElement;
  const until = performance.now() + TOUCH_PRESS_EFFECT_MS;
  root.dataset.touchPressedUntil = String(until);

  if (touchPressCleanupTimeout) {
    window.clearTimeout(touchPressCleanupTimeout);
  }

  touchPressCleanupTimeout = window.setTimeout(() => {
    const currentUntil = Number(root.dataset.touchPressedUntil || 0);
    if (currentUntil <= performance.now()) {
      delete root.dataset.touchPressedUntil;
    }
  }, TOUCH_PRESS_EFFECT_MS + 40);
}

function completeNavigation(link) {
  const href = link.getAttribute("href");

  if (isLandingHref(href)) {
    markReturnToLanding();
  }

  if (link.target === "_blank") {
    window.open(link.href, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      navigationLocked = false;
    }, NAVIGATION_UNLOCK_MS);
    return;
  }

  location.href = link.href;
}

function queueNavigation(link, { touchFeedback = false } = {}) {
  if (!link || navigationLocked) return;

  navigationLocked = true;

  if (touchFeedback) {
    triggerTouchPressFeedback();
    window.setTimeout(() => {
      completeNavigation(link);
    }, TOUCH_NAV_DELAY_MS);
    return;
  }

  completeNavigation(link);
}

function installLinkBehavior() {
  if ("ontouchstart" in window) {
    let touchStartX = 0;
    let touchStartY = 0;
    let activeTouchLink = null;
    let activeTouchMoved = false;

    document.addEventListener(
      "touchstart",
      (event) => {
        if (navigationLocked) return;

        const link = event.target.closest("a[href]");
        activeTouchLink = link;
        activeTouchMoved = false;

        if (!link) return;

        const touch = event.changedTouches[0];
        if (!touch) return;

        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      (event) => {
        if (!activeTouchLink) return;

        const touch = event.changedTouches[0];
        if (!touch) return;

        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        if (dx > TOUCH_TAP_THRESHOLD_PX || dy > TOUCH_TAP_THRESHOLD_PX) {
          activeTouchMoved = true;
        }
      },
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      (event) => {
        const link = activeTouchLink;
        activeTouchLink = null;

        if (!link || navigationLocked || activeTouchMoved) return;

        const touch = event.changedTouches[0];
        if (touch) {
          const dx = Math.abs(touch.clientX - touchStartX);
          const dy = Math.abs(touch.clientY - touchStartY);

          if (dx > TOUCH_TAP_THRESHOLD_PX || dy > TOUCH_TAP_THRESHOLD_PX) {
            return;
          }
        }

        event.preventDefault();
        queueNavigation(link, { touchFeedback: true });
      },
      { passive: false }
    );

    document.addEventListener(
      "touchcancel",
      () => {
        activeTouchLink = null;
        activeTouchMoved = false;
      },
      { passive: true }
    );

    return;
  }

  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest("a[href]");
    if (!link || navigationLocked) return;

    event.preventDefault();
    queueNavigation(link);
  });
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    const loader = document.getElementById("ascii-loader");
    if (loader) loader.remove();
  }
});

window.addEventListener("resize", updateInputModeClass);

async function boot() {
  updateInputModeClass();

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