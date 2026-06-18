import { clamp } from "../core/utils.js";
import { GLYPH_INDEX } from "./palette.js";

export function ensureInteractionStore(context, length) {
  if (!Array.isArray(context.effectCells)) context.effectCells = [];
  while (context.effectCells.length < length) {
    context.effectCells.push({ fade: 0, anim: 0, glyphPointer: GLYPH_INDEX[" "] || 0 });
  }
  if (context.effectCells.length > length) context.effectCells.length = length;
}

export function updateInteractionField(state, input, context) {
  if (!context.interaction) context.interaction = { radiusSquared: 0, energy: 0 };
  const interaction = context.interaction;
  const dx = input.x - input.q.x;
  const dy = input.y - input.q.y;
  const speed = Math.sqrt(dx * dx + dy * dy);

  interaction.radiusSquared *= 0.75;
  interaction.radiusSquared = Math.min(interaction.radiusSquared + 0.4 * speed, 20);
  interaction.energy = clamp(interaction.energy + (speed > 0.1 ? 0.008 : 0) - 0.003, 0, 1);
  interaction.speed = speed;
  interaction.cols = state.cols;
  interaction.rows = state.rows;
  return interaction;
}

export function disturbTextCell(cellState, x, y, state, input, interaction) {
  const dx = (x - input.x) * state.m.aspect;
  const dy = y - input.y;
  const distanceSquared = dx * dx + dy * dy;

  cellState.fade *= 0.95;

  if (distanceSquared < interaction.radiusSquared) {
    cellState.glyphPointer = (GLYPH_INDEX[" "] || 0) + Math.floor(interaction.radiusSquared - distanceSquared);
    cellState.anim = 1;
    cellState.fade = Math.max(cellState.fade, 1);
  }

  return distanceSquared;
}