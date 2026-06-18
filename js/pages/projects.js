import { layoutContent } from "../content/layout-source.js";
import { parseSource } from "../content/parse-source.js";
import { stampRuns } from "../content/stamp-text.js";
import { applyGlyphCycle } from "../effects/glyph-cycler.js";
import { ensureInteractionStore, updateInteractionField, disturbTextCell } from "../effects/interaction-field.js";
import { COLORS } from "../effects/palette.js";
import { sampleWordField } from "../effects/word-field.js";

async function injectProjects(source) {
  const mount = source.querySelector("[data-projects-root]");
  if (!mount) return;

  const response = await fetch("./data/projects.json");
  const data = await response.json();
  mount.innerHTML = "";

  data.projects.forEach((project) => {
    const div = document.createElement("div");
    div.innerHTML = `<a href="${project.href}">${project.title}</a> — ${project.year} — ${project.summary}`;
    mount.appendChild(div);
  });
}

export async function createProjectsPage({ source }) {
  await injectProjects(source);
  const blocks = parseSource(source);

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
      effectCells: []
    },
    setup(state, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);
    },
    updateGlobal(state, input, buffer, context) {
      ensureInteractionStore(context, state.cols * state.rows);
      updateInteractionField(state, input, context);
    },
    renderCell(cell, state) {
      return sampleWordField(cell.x, cell.y, state);
    },
    overlay(state, input, buffer, context) {
      const runs = layoutContent(context.blocks, state.cols, state.rows, {
        mode: "stack",
        maxWidth: 72
      });

      stampRuns(buffer, state.cols, state.rows, runs);

      for (const run of runs) {
        for (let offset = 0; offset < run.text.length; offset += 1) {
          const x = run.x + offset;
          const y = run.y;
          if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) continue;
          const index = x + y * state.cols;
          disturbTextCell(context.effectCells[index], x, y, state, input, context.interaction);
        }
      }

      applyGlyphCycle(buffer, context);
    }
  };
}