export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function createCell(defaults = {}) {
  return {
    char: " ",
    color: defaults.color ?? "",
    background: defaults.background ?? "",
    weight: defaults.weight ?? "",
    l: "",
    u: "",
    baseChar: "",
    href: "",
    target: "",
    text: false
  };
}

export function resetCell(cell, defaults = {}) {
  cell.char = " ";
  cell.color = defaults.color ?? "";
  cell.background = defaults.background ?? "";
  cell.weight = defaults.weight ?? "";
  cell.l = "";
  cell.u = "";
  cell.baseChar = "";
  cell.href = "";
  cell.target = "";
  cell.text = false;
  return cell;
}

export function ensureArrayLength(array, length, factory) {
  while (array.length < length) array.push(factory(array.length));
  if (array.length > length) array.length = length;
  return array;
}