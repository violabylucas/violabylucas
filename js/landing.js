(() => {
  function initLanding() {
    if (window.PortfolioAsciiMark) {
      window.PortfolioAsciiMark.init();
    }

    if (window.PortfolioAsciiBoxes) {
      window.PortfolioAsciiBoxes.init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLanding);
  } else {
    initLanding();
  }
})();