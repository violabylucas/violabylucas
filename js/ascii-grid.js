(() => {
  function getFlipSequence(baseChar) {
    if (baseChar === " ") return null;

    if ("-_=".includes(baseChar)) {
      return [baseChar, "/", "|", "\\", baseChar];
    }

    if ("|![](){}".includes(baseChar)) {
      return [baseChar, ":", "|", ":", baseChar];
    }

    if (/[A-Za-z0-9]/.test(baseChar)) {
      return [baseChar, ".", ":", "|", baseChar];
    }

    if ("/\\<>".includes(baseChar)) {
      return [baseChar, ".", "|", ".", baseChar];
    }

    return [baseChar, ".", ":", ".", baseChar];
  }

  function flipCell(cell) {
    if (!cell || cell.char === " " || cell.el.dataset.flipping === "1") return;

    const sequence = getFlipSequence(cell.char);
    if (!sequence) return;

    cell.el.dataset.flipping = "1";
    cell.el.classList.add("is-flipping");

    const steps = [0, 90, 190, 300, 420];

    steps.forEach((delay, index) => {
      window.setTimeout(() => {
        cell.el.textContent = sequence[index];
      }, delay);
    });

    window.setTimeout(() => {
      cell.el.textContent = cell.char;
      cell.el.classList.remove("is-flipping");
      cell.el.dataset.flipping = "0";
    }, 430);
  }

  function render(target, rows, options = {}) {
    if (!target) return null;

    target.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = `ascii-grid ${options.className || ""}`.trim();

    const cells = [];
    const lineCount = rows.length;
    const colCount = Math.max(...rows.map((row) => row.length));

    rows.forEach((line, rowIndex) => {
      const row = document.createElement("div");
      row.className = "ascii-grid__row";

      for (let colIndex = 0; colIndex < line.length; colIndex++) {
        const char = line[colIndex];
        const cell = document.createElement("span");

        cell.className = "ascii-grid__cell";
        if (char === " ") cell.classList.add("is-space");

        cell.textContent = char;
        cell.dataset.row = String(rowIndex);
        cell.dataset.col = String(colIndex);

        row.appendChild(cell);

        cells.push({
          el: cell,
          char,
          row: rowIndex,
          col: colIndex
        });
      }

      grid.appendChild(row);
    });

    target.appendChild(grid);

    return {
      target,
      grid,
      rows,
      cells,
      lineCount,
      colCount,
      flipCell,
      flipRegion(centerRow, centerCol, radius = 2) {
        cells.forEach((cell) => {
          const distance = Math.abs(cell.row - centerRow) + Math.abs(cell.col - centerCol);
          if (distance <= radius) {
            window.setTimeout(() => flipCell(cell), distance * 28);
          }
        });
      },
      flipAll(filterFn = null, stagger = 10) {
        let index = 0;

        cells.forEach((cell) => {
          if (cell.char === " ") return;
          if (filterFn && !filterFn(cell)) return;

          window.setTimeout(() => flipCell(cell), index * stagger);
          index += 1;
        });
      }
    };
  }

  function attachRegionHover(instance, radius = 2) {
  if (!instance) return;

  let touchActive = false;
  let lastKey = "";

  const triggerCell = (cell) => {
    if (!cell) return;

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const key = `${row}:${col}`;

    if (key === lastKey) return;
    lastKey = key;
    instance.flipRegion(row, col, radius);
  };

  instance.grid.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;

    const cell = event.target.closest(".ascii-grid__cell");
    if (!cell) return;
    triggerCell(cell);
  });

  instance.grid.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;

    touchActive = true;
    lastKey = "";

    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".ascii-grid__cell");
    triggerCell(cell);
  });

  instance.grid.addEventListener("pointermove", (event) => {
    if (!touchActive || event.pointerType !== "touch") return;

    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".ascii-grid__cell");
    triggerCell(cell);
  });

  const endTouch = () => {
    touchActive = false;
    lastKey = "";
  };

  instance.grid.addEventListener("pointerup", endTouch);
  instance.grid.addEventListener("pointercancel", endTouch);
  instance.grid.addEventListener("pointerleave", endTouch);
}

  function attachWaveHover(instance, filterFn = null, stagger = 10) {
    if (!instance) return;

    instance.grid.addEventListener("pointerenter", () => {
      instance.flipAll(filterFn, stagger);
    });

    instance.grid.addEventListener("focusin", () => {
      instance.flipAll(filterFn, stagger);
    });
  }

  window.AsciiGrid = {
    render,
    flipCell,
    attachRegionHover,
    attachWaveHover
  };
})();