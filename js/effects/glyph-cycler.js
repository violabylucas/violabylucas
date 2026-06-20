import { GLYPHS, GLYPH_INDEX, COLORS } from "./palette.js";

const GLITCH_TINTS = [
  "rgba(255, 255, 255, 0.88)",
  "hsla(103, 36%, 90%, 0.82)",
  "rgba(237, 222, 231, 0.78)",
  "rgba(240, 238, 233, 0.76)",
  "rgba(235, 58, 255, 0.72)"
];

function pickGlitchTint(index, pointer) {
  const seed = (index * 17 + pointer * 13) % GLITCH_TINTS.length;
  return GLITCH_TINTS[seed];
}

export function applyGlyphCycle(buffer, context) {
  const states = context.effectCells || [];
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (let index = 0; index < buffer.length; index += 1) {
    const cell = buffer[index];
    if (!cell.text || !cell.baseChar) continue;

    const state = states[index];
    if (!state) continue;

    if (state.anim === 1) {
      const targetIndex = GLYPH_INDEX[cell.baseChar] ?? GLYPH_INDEX[" "] ?? 0;

      if (state.glyphPointer !== targetIndex) {
        cell.char = GLYPHS[((state.glyphPointer % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];
        state.glyphPointer = (state.glyphPointer + 1) % GLYPHS.length;
      } else {
        state.anim = 0;
        cell.char = cell.baseChar;
      }
    } else {
      cell.char = cell.baseChar;
    }

    const isInteractive = Boolean(cell.isInteractive || cell.href);

    if (cell.tone === "selected") {
      cell.color = state.fade > 0.12 ? COLORS.selectedActive : COLORS.selectedIdle;
      continue;
    }

    if (!reduceMotion && (state.anim === 1 || state.fade > 0.65)) {
      cell.color = pickGlitchTint(index, state.glyphPointer);
      continue;
    }

    if (isInteractive) {
      cell.color = state.fade > 0.12 ? COLORS.link : COLORS.linkIdle;
    } else {
      cell.color = state.fade > 0.12 ? COLORS.textActive : COLORS.textIdle;
    }
  }
}