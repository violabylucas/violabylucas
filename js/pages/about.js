import { parseSource } from "../content/parse-source.js";
import { layoutContent } from "../content/layout-source.js";
import { stampRuns } from "../content/stamp-text.js";
import {
  ensureInteractionStore,
  updateInteractionField,
  disturbTextCell
} from "../effects/interaction-field.js";
import { applyGlyphCycle } from "../effects/glyph-cycler.js";
import { sampleWordField } from "../effects/word-field.js";
import { COLORS } from "../effects/palette.js";
import { mountAboutAsciiObject } from "./about-object.js";

const ABOUT_LAYOUT = {
  breakpointCols: 72,
  desktop: {
    textMaxWidth: 66,
    textOffsetCols: 0,
    textOffsetRows: 0,
    objectAnchorText: "back",
    objectOffsetXCols: 0,
    objectOffsetYRows: 2,
    objectWidthCols: 60,
    objectHeightRows: 15,
    objectGapRows: 2,
    objectMinWidthPx: 240
  },
  mobile: {
    textMaxWidth: 34,
    textOffsetCols: 0,
    textOffsetRows: -4,
    objectAnchorText: "back",
    objectOffsetXCols: 0,
    objectOffsetYRows: 2,
    objectWidthCols: 34,
    objectHeightRows: 12,
    objectGapRows: 1,
    objectMinWidthPx: 240
  }
};

function getLayoutSettings(state) {
  return state.cols < ABOUT_LAYOUT.breakpointCols
    ? ABOUT_LAYOUT.mobile
    : ABOUT_LAYOUT.desktop;
}

function findAnchorRun(runs, anchorText) {
  const normalizedAnchor = (anchorText || "").trim().toLowerCase();
  return runs.find((run) => run.text.trim().toLowerCase() === normalizedAnchor) || runs[0];
}

function buildAboutRuns(state, context) {
  const layout = getLayoutSettings(state);

  const maxWidth = Math.min(
    state.cols - 4,
    layout.textMaxWidth
  );
// console.log("textMaxWidth:", layout.textMaxWidth, "cols:", state.cols, "maxWidth:", maxWidth);
  const runs = layoutContent(context.blocks, state.cols, state.rows, {
    mode: "stack",
    maxWidth
  }).map((run) => ({
    ...run,
    x: run.x + layout.textOffsetCols,
    y: run.y + layout.textOffsetRows
  }));

  if (!runs.length) return runs;

  const anchorRun = findAnchorRun(runs, layout.objectAnchorText);
  const anchorIndex = runs.indexOf(anchorRun);

  return runs.map((run, index) => {
    if (index <= anchorIndex) return run;
    return {
      ...run,
      y: run.y + layout.objectHeightRows + layout.objectGapRows
    };
  });
}

function placeInlineObject(state, context, runs) {
  const mount = context.objectMount;
  if (!mount || !runs.length) return;

  const layout = getLayoutSettings(state);
  const metrics = state.m;
  const anchorRun = findAnchorRun(runs, layout.objectAnchorText);

  const widthCols = Math.min(
    Math.max(1, state.cols - anchorRun.x - 4),
    layout.objectWidthCols
  );

  const left = (anchorRun.x + layout.objectOffsetXCols) * metrics.charWidth;
  const top = (anchorRun.y + layout.objectOffsetYRows) * metrics.lineHeight;
  const width = Math.max(layout.objectMinWidthPx, widthCols * metrics.charWidth);
  const height = layout.objectHeightRows * metrics.lineHeight;

  mount.style.left = `${left}px`;
  mount.style.top = `${top}px`;
  mount.style.width = `${width}px`;
  mount.style.height = `${height}px`;
}

export async function createAboutPage({ source }) {
  const blocks = source ? parseSource(source) : [];
  const objectMount = document.getElementById("about-inline-object");

  return {
    fps: 60,
    defaults: {
      background: "#000000",
      color: COLORS.base,
      weight: "400"
    },
    context: {
      blocks,
      objectMount,
      interaction: { radiusSquared: 0, energy: 0 },
      effectCells: [],
      disposeObject: null
    },
    async mount() {
      if (objectMount) {
        this.context.disposeObject = await mountAboutAsciiObject(objectMount);
      }
    },
    setup(state, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);
    },
    updateGlobal(state, input, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);
      updateInteractionField(state, input, context);
    },
    renderCell(cell, state, input, buffer, context) {
      return sampleWordField(cell.x, cell.y, state, context);
    },
    overlay(state, input, buffer, context) {
      const runs = buildAboutRuns(state, context);
      stampRuns(buffer, state.cols, state.rows, runs);
      placeInlineObject(state, context, runs);

      for (const run of runs) {
        for (let offset = 0; offset < run.text.length; offset += 1) {
          const x = run.x + offset;
          const y = run.y;

          if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) continue;

          const index = x + y * state.cols;
          disturbTextCell(
            context.effectCells[index],
            x,
            y,
            state,
            input,
            context.interaction
          );
        }
      }

      applyGlyphCycle(buffer, context);
    }
  };
}