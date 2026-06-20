import { layoutContent } from "../content/layout-source.js";
import { parseSource } from "../content/parse-source.js";
import { stampRuns } from "../content/stamp-text.js";
import { applyGlyphCycle } from "../effects/glyph-cycler.js";
import {
  ensureInteractionStore,
  updateInteractionField,
  disturbTextCell
} from "../effects/interaction-field.js";
import { COLORS } from "../effects/palette.js";
import { sampleWordField } from "../effects/word-field.js";

const PROJECTS_LAYOUT = {
  breakpointCols: 72,
  desktop: {
    textMaxWidth: 66,
    textOffsetCols: 0,
    textOffsetRows: 0,
    rowGap: 2,
    topPaddingRows: 5,
    rowStaggerMs: 36,
    scrambleDurationMs: 240,
    glitchStepMs: 42,
    baseScrambleIntensity: 0.82,
    minScrambleIntensity: 0.12,
    jitterChance: 0.18,
    jitterDurationMs: 150,
    dropChance: 0.07,
    hoverPreviewOpacity: 0.52,
    hoverPreviewMinWidthPx: 420,
    hoverPreviewMaxWidthPx: 1920,
    hoverPreviewMaxHeightVh: 0.82,
    hoverPreviewPaddingPx: 18,
    hoverPreviewObjectFit: "contain",
    hoverPreviewObjectPositionX: "50%",
    hoverPreviewObjectPositionY: "50%"
  },
  mobile: {
    textMaxWidth: 40,
    textOffsetCols: 0,
    textOffsetRows: -6,
    rowGap: 2,
    topPaddingRows: 3,
    tapThresholdPx: 12,
    rowStaggerMs: 46,
    scrambleDurationMs: 220,
    glitchStepMs: 48,
    baseScrambleIntensity: 0.78,
    minScrambleIntensity: 0.1,
    jitterChance: 0.14,
    jitterDurationMs: 130,
    dropChance: 0.05,
    detailGapCols: 2,
    detailThumbColsWide: 12,
    detailThumbColsNarrow: 10,
    detailThumbRows: 8,
    detailMinThumbRows: 5,
    detailSummaryMinWidth: 14,
    detailSummaryMaxLines: 10,
    detailMediaObjectFit: "contain",
    titleMaxLines: 2,
    stackDetailBelowCols: 34
  }
};

const GLITCH_GLYPHS = "@#%&*+=-_.:/\\|<>[]{}01█▓▒░";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signalNoise(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function pickGlyph(seed) {
  const index = Math.floor(signalNoise(seed) * GLITCH_GLYPHS.length);
  return GLITCH_GLYPHS[index] || GLITCH_GLYPHS[0];
}

function slugifyTitle(title = "") {
  return String(title)
    .replace(/^→\s*/, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function getBlockPlainText(block) {
  return (block?.tokens || [])
    .filter((token) => token.type !== "break")
    .map((token) => token.text)
    .join(" ");
}

function getBlockLink(block) {
  return (block?.tokens || []).find((token) => token.type === "link") || null;
}

function isMobileLayout(state) {
  return state.cols < PROJECTS_LAYOUT.breakpointCols;
}

function truncateText(text, maxLength) {
  const value = String(text ?? "");
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 1)}…`;
}

function wrapText(text, maxWidth, maxLines = Infinity) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || maxWidth <= 0) return [];

  const lines = [];
  let current = "";
  let overflowed = false;

  for (const word of words) {
    if (!current) {
      if (word.length <= maxWidth) {
        current = word;
      } else {
        lines.push(truncateText(word, maxWidth));
      }
    } else {
      const next = `${current} ${word}`;
      if (next.length <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = word.length <= maxWidth ? word : truncateText(word, maxWidth);
      }
    }

    if (lines.length >= maxLines) {
      overflowed = true;
      current = "";
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current) {
    overflowed = true;
  }

  if (overflowed && lines.length) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1], maxWidth);
  }

  return lines.slice(0, maxLines);
}

function buildAsciiFrame(width, height) {
  const safeWidth = Math.max(4, width);
  const safeHeight = Math.max(3, height);
  const rows = [];

  rows.push(`┌${"─".repeat(safeWidth - 2)}┐`);
  for (let row = 0; row < safeHeight - 2; row += 1) {
    rows.push(`│${" ".repeat(safeWidth - 2)}│`);
  }
  rows.push(`└${"─".repeat(safeWidth - 2)}┘`);

  return rows;
}

function parseAspectRatioValue(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

function getProjectAspectRatio(project, fallback = 16 / 9) {
  return parseAspectRatioValue(project?.thumbnailAspectRatio) || fallback;
}

function getThumbnailSrc(project) {
  if (project.thumbnail) return project.thumbnail;
  const slug = slugifyTitle(project.title || "");
  return slug ? `./data/thumbnails/${slug}.webp` : "";
}

function getMediaType(project, src) {
  if (project.mediaType) return project.mediaType;
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(src)) return "video";
  return "image";
}

function measureRunsBounds(runs) {
  if (!runs.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const run of runs) {
    if (!run.text || !run.text.length) continue;
    minX = Math.min(minX, run.x);
    minY = Math.min(minY, run.y);
    maxX = Math.max(maxX, run.x + run.text.length - 1);
    maxY = Math.max(maxY, run.y);
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

async function injectProjects(source) {
  const mount = source.querySelector("[data-projects-root]");
  if (!mount) return [];

  const response = await fetch("./data/projects.json");
  const data = await response.json();
  const projects = Array.isArray(data.projects) ? data.projects : [];

  mount.innerHTML = "";

  projects.forEach((project) => {
    const div = document.createElement("div");
    div.innerHTML = `<a href="${project.href}">${project.title}</a> — ${project.year} — ${project.summary}`;
    mount.appendChild(div);
  });

  return projects;
}

function buildDesktopProjectRuns(state, context) {
  const layout = PROJECTS_LAYOUT.desktop;
  const maxWidth = Math.min(state.cols - 4, layout.textMaxWidth);

  const runs = layoutContent(context.blocks, state.cols, state.rows, {
    mode: "stack",
    maxWidth
  }).map((run) => ({
    ...run,
    x: run.x + layout.textOffsetCols,
    y: run.y + layout.textOffsetRows
  }));

  context.desktopTextBounds = measureRunsBounds(runs);

  const projectTitles = context.projects.map((project) =>
    String(project.title || "").trim().toLowerCase()
  );

  const hotspotsByKey = new Map();

  for (const run of runs) {
    const text = String(run.text || "").trim().toLowerCase();
    if (!text) continue;

    const index = projectTitles.findIndex((title) => (
      title && (text.includes(title) || title.includes(text))
    ));

    if (index < 0) continue;

    const key = `${index}:${run.y}`;
    const existing = hotspotsByKey.get(key);

    if (existing) {
      existing.x1 = Math.min(existing.x1, run.x);
      existing.x2 = Math.max(existing.x2, run.x + run.text.length - 1);
    } else {
      hotspotsByKey.set(key, {
        index,
        x1: run.x,
        x2: run.x + run.text.length - 1,
        y: run.y
      });
    }
  }

  context.desktopHotspots = Array.from(hotspotsByKey.values());

  return runs;
}

function measureOpenProjectDetail(project, maxWidth, metrics) {
  const layout = PROJECTS_LAYOUT.mobile;
  const gapCols = layout.detailGapCols;
  const usableWidth = Math.max(0, maxWidth - gapCols);

  let thumbCols = Math.max(
    layout.detailThumbColsNarrow + 2,
    Math.ceil(usableWidth * 0.52)
  );

  let summaryWidth = maxWidth - thumbCols - gapCols;

  if (summaryWidth < layout.detailSummaryMinWidth) {
    summaryWidth = layout.detailSummaryMinWidth;
    thumbCols = Math.max(10, maxWidth - gapCols - summaryWidth);
  }

  const summaryLines = wrapText(
    project.summary || "",
    summaryWidth,
    layout.detailSummaryMaxLines
  );

  const aspectRatio = getProjectAspectRatio(project, 16 / 9);
  const innerCols = Math.max(1, thumbCols - 2);

  const charWidth = Math.max(1, metrics?.charWidth || 1);
  const lineHeight = Math.max(1, metrics?.lineHeight || 1);

  const innerWidthPx = innerCols * charWidth;
  const innerHeightPx = innerWidthPx / aspectRatio;
  const innerRows = Math.max(1, Math.round(innerHeightPx / lineHeight));
  const thumbRows = Math.max(layout.detailMinThumbRows, innerRows + 2);

  const frameLines = buildAsciiFrame(thumbCols, thumbRows);
  const detailRows = Math.max(summaryLines.length + 1, frameLines.length);

  return {
    gapCols,
    summaryWidth,
    summaryLines,
    thumbCols,
    thumbRows,
    frameLines,
    detailRows
  };
}

function buildMobileProjectRuns(state, context) {
  const layout = PROJECTS_LAYOUT.mobile;
  const maxWidth = Math.min(state.cols - 4, layout.textMaxWidth);

  const xBase = Math.max(
    2,
    Math.floor((state.cols - maxWidth) / 2) + layout.textOffsetCols
  );

  const collapsedTotalRows = 4 + context.projects.length * layout.rowGap;
  const startY = Math.max(
    layout.topPaddingRows,
    Math.floor((state.rows - collapsedTotalRows) / 2) + layout.textOffsetRows
  );

  const runs = [];
  const hotspots = [];
  context.inlineMediaBox = null;

  const titleText = getBlockPlainText(context.introBlocks[0]) || "projects";
  const backLink = getBlockLink(context.introBlocks[1]);

  runs.push({
    x: xBase,
    y: startY,
    text: titleText,
    href: "",
    target: "",
    weight: "400"
  });

  runs.push({
    x: xBase,
    y: startY + 2,
    text: backLink?.text || "back",
    href: backLink?.href || "./index.html",
    target: backLink?.target || "",
    weight: "400"
  });

  let yCursor = startY + 4;

  context.projects.forEach((project, index) => {
    const isOpen = context.openProjectIndex === index;
    const marker = isOpen ? "-" : "+";
    const yearText = String(project.year ?? "");
    const suffix = ` — ${yearText} — ${marker}`;
    const titleMaxWidth = Math.max(8, maxWidth - suffix.length);
    const titleTextValue = truncateText(String(project.title ?? ""), titleMaxWidth);
    const headerText = `${titleTextValue}${suffix}`;

    runs.push({
      x: xBase,
      y: yCursor,
      text: headerText,
      href: "",
      target: "",
      weight: "400",
      tone: isOpen ? "selected" : "",
      noDisturb: true
    });

    hotspots.push({
      index,
      x1: xBase,
      x2: xBase + headerText.length - 1,
      y: yCursor
    });

    yCursor += 1;

    if (isOpen) {
      const detail = measureOpenProjectDetail(project, maxWidth, state.m);
      const detailStartY = yCursor;
      const textX = xBase;
      const boxX = xBase + detail.summaryWidth + detail.gapCols;

      detail.summaryLines.forEach((line, row) => {
        runs.push({
          x: textX,
          y: detailStartY + row,
          text: line,
          href: "",
          target: "",
          weight: "400"
        });
      });

      detail.frameLines.forEach((line, row) => {
        runs.push({
          x: boxX,
          y: detailStartY + row,
          text: line,
          href: "",
          target: "",
          weight: "400"
        });
      });

      const textBottomY = detail.summaryLines.length
        ? detailStartY + detail.summaryLines.length - 1
        : detailStartY - 1;

      const buttonY = textBottomY + 1;
      const imageBottomY = detailStartY + detail.frameLines.length - 1;
      const contentBottomY = Math.max(buttonY, imageBottomY);

      runs.push({
        x: textX,
        y: buttonY,
        text: "see project",
        href: project.href || "#",
        target: "",
        weight: "700"
      });

      const thumbnailSrc = getThumbnailSrc(project);
      if (thumbnailSrc) {
        context.inlineMediaBox = {
          src: thumbnailSrc,
          mediaType: getMediaType(project, thumbnailSrc),
          alt: `${project.title || "project"} thumbnail`,
          x: boxX + 1,
          y: detailStartY + 1,
          cols: Math.max(1, detail.thumbCols - 2),
          rows: Math.max(1, detail.thumbRows - 2)
        };
      }

      yCursor = contentBottomY + 2;
    } else {
      yCursor += layout.rowGap - 1;
    }
  });

  context.mobileHotspots = hotspots;
  return runs;
}

function scrambleRunText(run, frame, progress, layout) {
  const intensity = clamp(
    layout.minScrambleIntensity + (1 - progress) * layout.baseScrambleIntensity,
    0,
    1
  );

  let result = "";

  for (let index = 0; index < run.text.length; index += 1) {
    const char = run.text[index];

    if (char === " ") {
      result += " ";
      continue;
    }

    const seed = run.x * 17 + run.y * 131 + index * 37 + frame * 53;
    const value = signalNoise(seed);

    if (value < intensity) {
      result += pickGlyph(seed + frame * 7);
      continue;
    }

    if (/[a-z]/i.test(char) && value < intensity + 0.08) {
      result += char.toUpperCase();
      continue;
    }

    result += char;
  }

  return result;
}

function buildAnimatedRuns(runs, state, context, layout) {
  if (context.reduceMotion || !runs.length) {
    return runs;
  }

  const elapsed = state.time - context.startedAt;
  const frame = Math.floor(elapsed / layout.glitchStepMs);
  const minY = Math.min(...runs.map((run) => run.y));

  return runs.flatMap((run) => {
    const rowIndex = run.y - minY;
    const rowStart = rowIndex * layout.rowStaggerMs;
    const rowElapsed = elapsed - rowStart;

    if (rowElapsed <= 0) {
      return [];
    }

    if (rowElapsed < layout.scrambleDurationMs) {
      const progress = clamp(rowElapsed / layout.scrambleDurationMs, 0, 1);
      const flickerSeed = run.x * 29 + run.y * 211 + frame * 17;

      const shouldDrop =
        signalNoise(flickerSeed) < layout.dropChance * (1 - progress);

      if (shouldDrop) {
        return [];
      }

      const jitterActive =
        rowElapsed < layout.jitterDurationMs &&
        signalNoise(flickerSeed + 11) < layout.jitterChance;

      const jitterX =
        jitterActive
          ? (signalNoise(flickerSeed + 23) < 0.5 ? -1 : 1)
          : 0;

      return [
        {
          ...run,
          x: run.x + jitterX,
          text: scrambleRunText(run, frame, progress, layout)
        }
      ];
    }

    return [run];
  });
}

function hideInlineMedia(context) {
  if (!context.inlineMediaMount) return;
  context.inlineMediaMount.hidden = true;
  context.inlineMediaMount.style.left = "0px";
  context.inlineMediaMount.style.top = "0px";
  context.inlineMediaMount.style.width = "0px";
  context.inlineMediaMount.style.height = "0px";
}

function ensureInlineMediaNode(context, mediaBox) {
  const mount = context.inlineMediaMount;
  if (!mount) return;

  const key = `${mediaBox.mediaType}|${mediaBox.src}`;
  if (context.inlineMediaKey === key && context.inlineMediaNode) return;

  mount.innerHTML = "";

  let node;
  if (mediaBox.mediaType === "video") {
    node = document.createElement("video");
    node.src = mediaBox.src;
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.playsInline = true;
  } else {
    node = document.createElement("img");
    node.src = mediaBox.src;
    node.alt = mediaBox.alt;
    node.loading = "lazy";
    node.decoding = "async";
  }

  node.className = "projects-inline-media__asset";
  node.style.objectFit = PROJECTS_LAYOUT.mobile.detailMediaObjectFit;
  node.style.objectPosition = "center center";
  mount.appendChild(node);

  context.inlineMediaKey = key;
  context.inlineMediaNode = node;
}

function syncInlineMedia(context, state) {
  const mount = context.inlineMediaMount;

  if (!mount || !context.isMobile || !context.inlineMediaBox || !context.screen) {
    hideInlineMedia(context);
    return;
  }

  const mediaBox = context.inlineMediaBox;
  ensureInlineMediaNode(context, mediaBox);

  const rect = context.screen.getBoundingClientRect();
  const left = rect.left + mediaBox.x * state.m.charWidth;
  const top = rect.top + mediaBox.y * state.m.lineHeight;
  const width = Math.max(1, mediaBox.cols * state.m.charWidth);
  const height = Math.max(1, mediaBox.rows * state.m.lineHeight);

  mount.hidden = false;
  mount.style.left = `${Math.round(left)}px`;
  mount.style.top = `${Math.round(top)}px`;
  mount.style.width = `${Math.round(width)}px`;
  mount.style.height = `${Math.round(height)}px`;
}

function hideHoverPreview(context) {
  if (!context.hoverPreviewMount) return;
  context.hoverPreviewMount.hidden = true;
  context.hoverPreviewMount.classList.remove("is-visible");
  context.hoverPreviewMount.style.left = "0px";
  context.hoverPreviewMount.style.top = "0px";
  context.hoverPreviewMount.style.width = "0px";
  context.hoverPreviewMount.style.height = "0px";
  context.hoverPreviewMount.style.opacity = "0";
}

function ensureHoverPreviewNode(context, project, src) {
  const mount = context.hoverPreviewMount;
  if (!mount) return;

  const mediaType = getMediaType(project, src);
  const key = `${mediaType}|${src}`;

  if (context.hoverPreviewKey === key && context.hoverPreviewNode) {
    return;
  }

  mount.innerHTML = "";

  let node;
  if (mediaType === "video") {
    node = document.createElement("video");
    node.src = src;
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.playsInline = true;
  } else {
    node = document.createElement("img");
    node.src = src;
    node.alt = `${project.title || "project"} preview`;
    node.loading = "lazy";
    node.decoding = "async";
  }

  node.className = "projects-hover-preview__asset";
  node.style.objectFit = PROJECTS_LAYOUT.desktop.hoverPreviewObjectFit;
  mount.appendChild(node);

  context.hoverPreviewKey = key;
  context.hoverPreviewNode = node;
}

function syncHoverPreview(context, state) {
  const mount = context.hoverPreviewMount;
  const layout = PROJECTS_LAYOUT.desktop;

  if (!mount || context.isMobile || !context.screen) {
    hideHoverPreview(context);
    return;
  }

  const hoveredIndex = context.hoveredProjectIndex;
  if (hoveredIndex < 0) {
    hideHoverPreview(context);
    return;
  }

  const project = context.projects?.[hoveredIndex];
  if (!project) {
    hideHoverPreview(context);
    return;
  }

  const src = getThumbnailSrc(project);
  if (!src) {
    hideHoverPreview(context);
    return;
  }

  ensureHoverPreviewNode(context, project, src);

  if (context.hoverPreviewNode) {
    context.hoverPreviewNode.style.objectPosition =
      `${layout.hoverPreviewObjectPositionX} ${layout.hoverPreviewObjectPositionY}`;
  }

  const aspectRatio = getProjectAspectRatio(project, 16 / 9);

  let width = Math.round(
    clamp(
      window.innerWidth * 0.82,
      layout.hoverPreviewMinWidthPx,
      layout.hoverPreviewMaxWidthPx
    )
  );
  let height = Math.round(width / aspectRatio);

  const maxHeight = Math.round(window.innerHeight * layout.hoverPreviewMaxHeightVh);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  const maxViewportWidth = Math.round(window.innerWidth * 0.92);
  if (width > maxViewportWidth) {
    width = maxViewportWidth;
    height = Math.round(width / aspectRatio);
  }

  const left = Math.round((window.innerWidth - width) / 2);
  const top = Math.round((window.innerHeight - height) / 2);

  mount.hidden = false;
  mount.classList.add("is-visible");
  mount.style.position = "fixed";
  mount.style.zIndex = "3";
  mount.style.pointerEvents = "none";
  mount.style.left = `${left}px`;
  mount.style.top = `${top}px`;
  mount.style.width = `${width}px`;
  mount.style.height = `${height}px`;
  mount.style.opacity = String(layout.hoverPreviewOpacity);
  mount.style.outline = "";
  mount.style.background = "";
}

function toggleMobileProject(context, index) {
  context.openProjectIndex = context.openProjectIndex === index ? -1 : index;
}

function bindMobileProjectInteractions(context) {
  if (context.boundMobileInteractions || !context.screen) return;
  context.boundMobileInteractions = true;

  const pointerDown = {
    active: false,
    x: 0,
    y: 0
  };

  context.screen.addEventListener("pointerdown", (event) => {
    if (!context.isMobile) return;

    const rect = context.screen.getBoundingClientRect();
    pointerDown.active = true;
    pointerDown.x = event.clientX - rect.left;
    pointerDown.y = event.clientY - rect.top;
  });

  context.screen.addEventListener("pointercancel", () => {
    pointerDown.active = false;
  });

  context.screen.addEventListener("pointerleave", () => {
    pointerDown.active = false;
  });

  context.screen.addEventListener("pointerup", (event) => {
    if (!context.isMobile || !pointerDown.active || !context.lastMetrics) return;

    const rect = context.screen.getBoundingClientRect();
    const upX = event.clientX - rect.left;
    const upY = event.clientY - rect.top;
    pointerDown.active = false;

    const dx = Math.abs(upX - pointerDown.x);
    const dy = Math.abs(upY - pointerDown.y);

    if (
      dx > PROJECTS_LAYOUT.mobile.tapThresholdPx ||
      dy > PROJECTS_LAYOUT.mobile.tapThresholdPx
    ) {
      return;
    }

    const x = upX / context.lastMetrics.charWidth;
    const y = upY / context.lastMetrics.lineHeight;

    const hit = (context.mobileHotspots || []).find((spot) => (
      x >= spot.x1 - 1.5 &&
      x <= spot.x2 + 1.5 &&
      y >= spot.y - 1 &&
      y <= spot.y + 1
    ));

    if (!hit) return;
    toggleMobileProject(context, hit.index);
  });
}

function bindDesktopHoverInteractions(context) {
  if (context.boundDesktopInteractions || !context.screen) return;
  context.boundDesktopInteractions = true;

  const updateHoveredFromPointer = (event) => {
    if (context.isMobile || !context.lastMetrics) {
      context.hoveredProjectIndex = -1;
      context.lastDesktopHit = null;
      return;
    }

    const rect = context.screen.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const x = localX / context.lastMetrics.charWidth;
    const y = localY / context.lastMetrics.lineHeight;

    const hit = (context.desktopHotspots || []).find((spot) => (
      x >= spot.x1 &&
      x <= spot.x2 &&
      y >= spot.y - 0.5 &&
      y <= spot.y + 0.5
    ));

    context.hoveredProjectIndex = hit ? hit.index : -1;
    context.lastDesktopHit = hit || null;
  };

  context.screen.addEventListener("pointermove", updateHoveredFromPointer);

  context.screen.addEventListener("pointerleave", () => {
    context.hoveredProjectIndex = -1;
    context.lastDesktopHit = null;
  });
}

export async function createProjectsPage({ source, screen }) {
  const projects = await injectProjects(source);
  const blocks = parseSource(source);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inlineMediaMount = document.getElementById("projects-inline-media");
  const hoverPreviewMount = document.getElementById("projects-hover-preview");

  const context = {
    blocks,
    introBlocks: blocks.slice(0, 2),
    projects,
    interaction: { radiusSquared: 0, energy: 0 },
    effectCells: [],
    startedAt: 0,
    reduceMotion,
    openProjectIndex: -1,
    hoveredProjectIndex: -1,
    lastDesktopHit: null,
    mobileHotspots: [],
    desktopHotspots: [],
    inlineMediaBox: null,
    inlineMediaMount,
    inlineMediaKey: "",
    inlineMediaNode: null,
    hoverPreviewMount,
    hoverPreviewKey: "",
    hoverPreviewNode: null,
    desktopTextBounds: null,
    screen,
    isMobile: false,
    lastMetrics: null,
    boundMobileInteractions: false,
    boundDesktopInteractions: false
  };

  bindMobileProjectInteractions(context);
  bindDesktopHoverInteractions(context);
  hideInlineMedia(context);
  hideHoverPreview(context);

  return {
    fps: 60,
    defaults: {
      background: "#000000",
      color: COLORS.base,
      weight: "400"
    },
    context,
    setup(state, buffer, runtimeContext) {
      ensureInteractionStore(runtimeContext, state.cols * state.rows);

      if (!runtimeContext.startedAt) {
        runtimeContext.startedAt = state.time;
      }
    },
    updateGlobal(state, input, buffer, runtimeContext) {
      ensureInteractionStore(runtimeContext, state.cols * state.rows);
      updateInteractionField(state, input, runtimeContext);
      runtimeContext.lastMetrics = state.m;

      const mobileNow = isMobileLayout(state);
      if (mobileNow !== runtimeContext.isMobile) {
        runtimeContext.isMobile = mobileNow;

        if (mobileNow) {
          runtimeContext.hoveredProjectIndex = -1;
          runtimeContext.lastDesktopHit = null;
          hideHoverPreview(runtimeContext);
        } else {
          runtimeContext.openProjectIndex = -1;
          hideInlineMedia(runtimeContext);
        }
      }
    },
    renderCell(cell, state) {
      return sampleWordField(cell.x, cell.y, state);
    },
    overlay(state, input, buffer, runtimeContext) {
      const mobile = isMobileLayout(state);
      const runs = mobile
        ? buildMobileProjectRuns(state, runtimeContext)
        : buildDesktopProjectRuns(state, runtimeContext);

      const animatedRuns = buildAnimatedRuns(
        runs,
        state,
        runtimeContext,
        mobile ? PROJECTS_LAYOUT.mobile : PROJECTS_LAYOUT.desktop
      );

      stampRuns(buffer, state.cols, state.rows, animatedRuns);

      for (const run of animatedRuns) {
        if (run.noDisturb) continue;

        for (let offset = 0; offset < run.text.length; offset += 1) {
          const x = run.x + offset;
          const y = run.y;

          if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) continue;

          const index = x + y * state.cols;
          disturbTextCell(
            runtimeContext.effectCells[index],
            x,
            y,
            state,
            input,
            runtimeContext.interaction,
            buffer[index]
          );
        }
      }

      applyGlyphCycle(buffer, runtimeContext);

      if (mobile) {
        syncInlineMedia(runtimeContext, state);
        hideHoverPreview(runtimeContext);
      } else {
        hideInlineMedia(runtimeContext);
        syncHoverPreview(runtimeContext, state);
      }
    }
  };
}