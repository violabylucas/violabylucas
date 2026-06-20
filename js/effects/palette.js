export const GLYPHS = " .,·-•─~+:;=*π’“”┐┌┘└┼├┤┴┬│╗╔╝╚╬╠╣╩╦║░▒▓█▄▀▌▐■!?&#$@aàbcdefghijklmnoòpqrstuüvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%()".split("");
export const GLYPH_INDEX = GLYPHS.reduce((map, char, index) => {
  map[char] = index;
  return map;
}, {});

export const FIELD_A = " .·•-+=:;*ABC0123!*".split("");
export const FIELD_B = " ·-•~+:*abcXYZ*".split("");

export const COLORS = {
  base: "rgba(255,255,255,0.46)",
  dim: "rgba(255,255,255,0.34)",
  link: "rgba(255,255,255,0.95)",
  linkIdle: "rgba(255,255,255,0.92)",
  textActive: "rgba(255,255,255,0.78)",
  textIdle: "rgba(255,255,255,0.50)",
  selectedActive: "rgba(196,182,255,0.74)",
  selectedIdle: "rgba(172,156,255,0.42)"
};