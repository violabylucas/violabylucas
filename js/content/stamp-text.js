export function writeRun(buffer, cols, rows, run) {
  const { x, y, text, href = "", target = "", weight = "400" } = run;
  if (y < 0 || y >= rows) return;

  const linkOpen = href
    ? `<a href="${href}"${target ? ` target="${target}" rel="noopener noreferrer"` : ""}>`
    : "";

  for (let index = 0; index < text.length; index += 1) {
    const col = x + index;
    if (col < 0 || col >= cols) continue;

    const cell = buffer[col + y * cols];
    cell.char = text[index];
    cell.baseChar = text[index];
    cell.text = text[index] !== " ";
    cell.href = href;
    cell.target = target;
    cell.weight = weight || cell.weight;
    cell.isInteractive = Boolean(href);

    if (index === 0 && linkOpen) cell.l = linkOpen;
    if (index === text.length - 1 && href) cell.u = "</a>";
  }
}

export function stampRuns(buffer, cols, rows, runs) {
  for (const run of runs) writeRun(buffer, cols, rows, run);
}