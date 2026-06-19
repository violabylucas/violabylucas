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
    objectMinWidthPx: 240,
    rowStaggerMs: 36,
    scrambleDurationMs: 240,
    glitchStepMs: 42,
    baseScrambleIntensity: 0.82,
    minScrambleIntensity: 0.12,
    jitterChance: 0.18,
    jitterDurationMs: 150,
    dropChance: 0.07
  },
  mobile: {
    textMaxWidth: 34,
    textOffsetCols: 0,
    textOffsetRows: -8,
    objectAnchorText: "back",
    objectOffsetXCols: 0,
    objectOffsetYRows: 2,
    objectWidthCols: 34,
    objectHeightRows: 12,
    objectGapRows: 1,
    objectMinWidthPx: 240,
    rowStaggerMs: 46,
    scrambleDurationMs: 220,
    glitchStepMs: 48,
    baseScrambleIntensity: 0.78,
    minScrambleIntensity: 0.1,
    jitterChance: 0.14,
    jitterDurationMs: 130,
    dropChance: 0.05
  }
};

const GLITCH_GLYPHS = "@#%&*+=-_.:/\\|<>[]{}01█▓▒░";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signalNoise(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function pickGlyph(seed) {
  const index = Math.floor(signalNoise(seed) * GLITCH_GLYPHS.length);
  return GLITCH_GLYPHS[index] || GLITCH_GLYPHS[0];
}

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

function scrambleRunText(run, frame, progress, layout) {
  const intensity = clamp(
    layout.minScrambleIntensity + (1 - progress) * layout.baseScrambleIntensity,
    0,
    1
  );

  let result = "";

  for (let index = 0; index < run.text.length; index += 1) {
    const char = run.text[index];

    if (char === " ") {
      result += " ";
      continue;
    }

    const seed = run.x * 17 + run.y * 131 + index * 37 + frame * 53;
    const value = signalNoise(seed);

    if (value < intensity) {
      result += pickGlyph(seed + frame * 7);
      continue;
    }

    if (/[a-z]/i.test(char) && value < intensity + 0.08) {
      result += char.toUpperCase();
      continue;
    }

    result += char;
  }

  return result;
}

function buildAnimatedRuns(runs, state, context, layout) {
  if (context.reduceMotion || !runs.length) {
    return runs;
  }

  const elapsed = state.time - context.startedAt;
  const frame = Math.floor(elapsed / layout.glitchStepMs);
  const minY = Math.min(...runs.map((run) => run.y));

  return runs.flatMap((run) => {
    const rowIndex = run.y - minY;
    const rowStart = rowIndex * layout.rowStaggerMs;
    const rowElapsed = elapsed - rowStart;

    if (rowElapsed <= 0) {
      return [];
    }

    if (rowElapsed < layout.scrambleDurationMs) {
      const progress = clamp(rowElapsed / layout.scrambleDurationMs, 0, 1);
      const flickerSeed = run.x * 29 + run.y * 211 + frame * 17;

      const shouldDrop =
        signalNoise(flickerSeed) < layout.dropChance * (1 - progress);

      if (shouldDrop) {
        return [];
      }

      const jitterActive =
        rowElapsed < layout.jitterDurationMs &&
        signalNoise(flickerSeed + 11) < layout.jitterChance;

      const jitterX = jitterActive
        ? (signalNoise(flickerSeed + 23) < 0.5 ? -1 : 1)
        : 0;

      return [
        {
          ...run,
          x: run.x + jitterX,
          text: scrambleRunText(run, frame, progress, layout)
        }
      ];
    }

    return [run];
  });
}

export async function createAboutPage({ source }) {
  const blocks = source ? parseSource(source) : [];
  const objectMount = document.getElementById("about-inline-object");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      disposeObject: null,
      startedAt: 0,
      reduceMotion
    },
    async mount() {
      if (objectMount) {
        this.context.disposeObject = await mountAboutAsciiObject(objectMount);
      }
    },
    setup(state, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);

      if (!context.startedAt) {
        context.startedAt = state.time;
      }
    },
    updateGlobal(state, input, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);
      updateInteractionField(state, input, context);
    },
    renderCell(cell, state, input, buffer, context) {
      return sampleWordField(cell.x, cell.y, state, context);
    },
    overlay(state, input, buffer, context) {
      const layout = getLayoutSettings(state);
      const runs = buildAboutRuns(state, context);
      const animatedRuns = buildAnimatedRuns(runs, state, context, layout);

      stampRuns(buffer, state.cols, state.rows, animatedRuns);
      placeInlineObject(state, context, runs);

      for (const run of animatedRuns) {
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