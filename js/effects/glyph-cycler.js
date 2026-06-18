import { GLYPHS, GLYPH_INDEX, COLORS } from "./palette.js";

export function applyGlyphCycle(buffer, context) {
  const states = context.effectCells || [];

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

    cell.color = state.fade > 0.12 ? COLORS.link : COLORS.accent;
  }
}