(() => {
  function makeAsciiBox(label, minInnerWidth = 18) {
    const innerWidth = Math.max(minInnerWidth, label.length + 4);
    const leftPad = Math.floor((innerWidth - label.length) / 2);
    const rightPad = innerWidth - label.length - leftPad;

    const top = "+" + "-".repeat(innerWidth) + "+";
    const empty = "|" + " ".repeat(innerWidth) + "|";
    const middle = "|" + " ".repeat(leftPad) + label + " ".repeat(rightPad) + "|";

    return [top, empty, middle, empty, top];
  }

  function isBorderCell(cell) {
    return cell.char !== " " && !/[A-Za-z0-9]/.test(cell.char);
  }

  function initAsciiBoxes() {
    if (!window.AsciiGrid) return;

    const projectRoot = document.getElementById("projects-box");
    const aboutRoot = document.getElementById("about-box");

    if (projectRoot) {
      const projectGrid = window.AsciiGrid.render(projectRoot, makeAsciiBox("projects"), {
        className: "ascii-box-grid"
      });

      window.AsciiGrid.attachWaveHover(projectGrid, null, 12);
    }

    if (aboutRoot) {
      const aboutGrid = window.AsciiGrid.render(aboutRoot, makeAsciiBox("aboutMe"), {
        className: "ascii-box-grid"
      });

      window.AsciiGrid.attachWaveHover(aboutGrid, null, 12);
    }
  }

  window.PortfolioAsciiBoxes = {
    init: initAsciiBoxes
  };
})();