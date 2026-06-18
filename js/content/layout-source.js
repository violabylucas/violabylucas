function tokenLength(token) {
  return token.text.length;
}

function tokensToWrappedLines(tokens, maxWidth) {
  const lines = [];
  let current = [];
  let width = 0;

  const pushCurrent = () => {
    if (current.length) lines.push(current);
    current = [];
    width = 0;
  };

  for (const token of tokens) {
    if (token.type === "break") {
      pushCurrent();
      continue;
    }

    const length = tokenLength(token);
    const needsSpace = width > 0 ? 1 : 0;

    if (width > 0 && width + needsSpace + length > maxWidth) {
      pushCurrent();
    }

    if (width > 0) {
      current.push({ type: "space", text: " " });
      width += 1;
    }

    current.push(token);
    width += length;
  }

  pushCurrent();
  return lines;
}

function flattenLine(line) {
  let cursor = 0;
  const segments = [];
  for (const token of line) {
    segments.push({ ...token, offset: cursor });
    cursor += token.text.length;
  }
  return { width: cursor, segments };
}

export function layoutContent(blocks, cols, rows, options = {}) {
  const mode = options.mode || "stack";

  if (mode === "center-row") {
    const links = blocks
      .map((block) => block.tokens.find((token) => token.type === "link" || token.type === "text"))
      .filter(Boolean);

    const gap = cols < 60 ? 4 : 6;
    const totalWidth = links.reduce((sum, token) => sum + token.text.length, 0) + gap * Math.max(0, links.length - 1);
    let x = Math.floor((cols - totalWidth) / 2);
    const y = Math.floor(rows / 2);
    const runs = [];

    for (const token of links) {
      runs.push({
        x,
        y,
        text: token.text,
        href: token.href || "",
        target: token.target || ""
      });
      x += token.text.length + gap;
    }

    return runs;
  }

  const maxWidth = Math.max(18, Math.min(options.maxWidth || 62, cols - 8));
  const blockLines = blocks.map((block) => ({
    tag: block.tag,
    lines: tokensToWrappedLines(block.tokens, maxWidth).map(flattenLine)
  }));

  const totalLines = blockLines.reduce((sum, block, index) => {
    const gap = index === blockLines.length - 1 ? 0 : block.tag === "H1" ? 2 : 1;
    return sum + block.lines.length + gap;
  }, 0);

  let y = Math.max(2, Math.floor((rows - totalLines) / 2));
  const xBase = Math.floor((cols - maxWidth) / 2);
  const runs = [];

  for (const block of blockLines) {
    for (const line of block.lines) {
      const center = block.tag === "H1";
      const x = center ? Math.floor((cols - line.width) / 2) : xBase;
      for (const segment of line.segments) {
        if (segment.type === "space") continue;
        runs.push({
          x: x + segment.offset,
          y,
          text: segment.text,
          href: segment.href || "",
          target: segment.target || "",
          weight: block.tag === "H1" ? "700" : "400"
        });
      }
      y += 1;
    }
    y += block.tag === "H1" ? 2 : 1;
  }

  return runs;
}