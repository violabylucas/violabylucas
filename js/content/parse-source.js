function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseInline(node, tokens = []) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = normalizeText(child.textContent || "");
      if (text) tokens.push({ type: "text", text });
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    if (child.tagName === "BR") {
      tokens.push({ type: "break" });
      continue;
    }

    if (child.tagName === "A") {
      const text = normalizeText(child.textContent || "");
      if (text) {
        tokens.push({
          type: "link",
          text,
          href: child.getAttribute("href") || "#",
          target: child.getAttribute("target") || ""
        });
      }
      continue;
    }

    parseInline(child, tokens);
  }

  return tokens;
}

export function parseSource(root) {
  const blocks = [];
  for (const child of root.children) {
    const tokens = parseInline(child, []);
    if (!tokens.length) continue;
    blocks.push({
      tag: child.tagName,
      tokens,
      dataset: { ...child.dataset }
    });
  }
  return blocks;
}