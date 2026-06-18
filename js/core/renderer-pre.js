import { escapeHtml } from "./utils.js";

function sameStyle(a = {}, b = {}) {
  return a.weight === b.weight && a.color === b.color && a.background === b.background;
}

function styleString(cell, defaults) {
  const parts = [];
  if (cell.color && cell.color !== defaults.color) parts.push(`color:${cell.color}`);
  if (cell.background && cell.background !== defaults.background) parts.push(`background:${cell.background}`);
  if (cell.weight && cell.weight !== defaults.weight) parts.push(`font-weight:${cell.weight}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

export function createPreRenderer(element) {
  let previous = [];
  let previousCols = 0;
  let previousRows = 0;

  function ensureRows(rows) {
    while (element.childElementCount < rows) {
      const row = document.createElement("span");
      element.appendChild(row);
    }
    while (element.childElementCount > rows) {
      element.removeChild(element.lastChild);
    }
  }

  function render(state, buffer) {
    const { cols, rows, defaults } = state;
    if (cols !== previousCols || rows !== previousRows) {
      previousCols = cols;
      previousRows = rows;
      previous = [];
      previous.length = cols * rows;
    }

    element.style.backgroundColor = defaults.background;
    element.style.color = defaults.color;
    element.style.fontWeight = defaults.weight;

    ensureRows(rows);

    for (let row = 0; row < rows; row += 1) {
      const offset = row * cols;
      let changed = false;

      for (let col = 0; col < cols; col += 1) {
        const index = offset + col;
        const current = buffer[index];
        const prior = previous[index];
        if (
          !prior ||
          prior.char !== current.char ||
          prior.weight !== current.weight ||
          prior.color !== current.color ||
          prior.background !== current.background ||
          prior.l !== current.l ||
          prior.u !== current.u
        ) {
          changed = true;
          previous[index] = { ...current };
        }
      }

      if (!changed) continue;

      let html = "";
      let styleState = {};
      let spanOpen = false;

      for (let col = 0; col < cols; col += 1) {
        const cell = buffer[offset + col];

        if (cell.l) {
          if (spanOpen) {
            html += "</span>";
            spanOpen = false;
            styleState = {};
          }
          html += cell.l;
        }

        if (!sameStyle(cell, styleState)) {
          if (spanOpen) html += "</span>";
          html += `<span${styleString(cell, defaults)}>`;
          spanOpen = true;
          styleState = cell;
        }

        html += escapeHtml(cell.char || " ");

        if (cell.u) {
          if (spanOpen) {
            html += "</span>";
            spanOpen = false;
            styleState = {};
          }
          html += cell.u;
        }
      }

      if (spanOpen) html += "</span>";
      element.childNodes[row].innerHTML = html;
    }
  }

  return { render };
}