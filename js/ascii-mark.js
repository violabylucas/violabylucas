(() => {
  const MOBILE_QUERY = "(max-width: 865px)";

  async function loadAsciiRows(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Could not load ASCII JSON: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.rows) ? data.rows : [];
  }

  function getSource(root) {
    const mobileMql = window.matchMedia(MOBILE_QUERY);
    return mobileMql.matches
      ? root.dataset.asciiSrcMobile || root.dataset.asciiSrc
      : root.dataset.asciiSrc;
  }

  function createMarkController(root) {
    let currentSrc = null;
    let currentGrid = null;

    async function render() {
      const nextSrc = getSource(root);
      if (!nextSrc || nextSrc === currentSrc) return;

      currentSrc = nextSrc;

      try {
        const rows = await loadAsciiRows(nextSrc);
        root.innerHTML = "";

        currentGrid = window.AsciiGrid.render(root, rows, {
          className: "ascii-mark-grid"
        });

        window.AsciiGrid.attachRegionHover(currentGrid, 2);
      } catch (error) {
        console.error(error);
        root.textContent = "ascii mark failed to load";
      }
    }

    return { render };
  }

  function initAsciiMark() {
    const root = document.getElementById("ascii-mark");
    if (!root || !window.AsciiGrid) return;

    const controller = createMarkController(root);
    const mediaQuery = window.matchMedia(MOBILE_QUERY);

    controller.render();

    mediaQuery.addEventListener("change", () => {
      controller.render();
    });
  }

  window.PortfolioAsciiMark = {
    init: initAsciiMark
  };
})();