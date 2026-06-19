import { layoutContent } from "../content/layout-source.js";
import { parseSource } from "../content/parse-source.js";
import { stampRuns } from "../content/stamp-text.js";
import { applyGlyphCycle } from "../effects/glyph-cycler.js";
import {
  ensureInteractionStore,
  updateInteractionField,
  disturbTextCell
} from "../effects/interaction-field.js";
import { COLORS } from "../effects/palette.js";
import { sampleWordField } from "../effects/word-field.js";

const PROJECTS_LAYOUT = {
  breakpointCols: 72,
  desktop: {
    textMaxWidth: 66,
    textOffsetCols: 0,
    textOffsetRows: 0,
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
    textOffsetRows: -2,
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
  return state.cols < PROJECTS_LAYOUT.breakpointCols
    ? PROJECTS_LAYOUT.mobile
    : PROJECTS_LAYOUT.desktop;
}

async function injectProjects(source) {
  const mount = source.querySelector("[data-projects-root]");
  if (!mount) return;

  const response = await fetch("./data/projects.json");
  const data = await response.json();
  mount.innerHTML = "";

  data.projects.forEach((project) => {
    const div = document.createElement("div");
    div.innerHTML = `<a href="${project.href}">${project.title} — ${project.year} — ${project.summary}</a>`;
    mount.appendChild(div);
  });
}

function buildProjectRuns(state, context) {
  const layout = getLayoutSettings(state);

  const maxWidth = Math.min(
    state.cols - 4,
    layout.textMaxWidth
  );

  return layoutContent(context.blocks, state.cols, state.rows, {
    mode: "stack",
    maxWidth
  }).map((run) => ({
    ...run,
    x: run.x + layout.textOffsetCols,
    y: run.y + layout.textOffsetRows
  }));
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

export async function createProjectsPage({ source }) {
  await injectProjects(source);
  const blocks = parseSource(source);
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
      interaction: { radiusSquared: 0, energy: 0 },
      effectCells: [],
      startedAt: 0,
      reduceMotion
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
    renderCell(cell, state) {
      return sampleWordField(cell.x, cell.y, state);
    },
    overlay(state, input, buffer, context) {
      const layout = getLayoutSettings(state);
      const runs = buildProjectRuns(state, context);
      const animatedRuns = buildAnimatedRuns(runs, state, context, layout);

      stampRuns(buffer, state.cols, state.rows, animatedRuns);

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