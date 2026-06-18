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
  accent: "rgba(225,225,225,0.78)"
};