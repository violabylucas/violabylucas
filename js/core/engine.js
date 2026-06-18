import { measureTextGrid, measureGridBounds } from "./metrics.js";
import { createPointer } from "./pointer.js";
import { createPreRenderer } from "./renderer-pre.js";
import { createCell, resetCell, ensureArrayLength } from "./utils.js";

const DEFAULTS = {
  cols: 0,
  rows: 0,
  fps: 60,
  defaults: {
    background: "#000000",
    color: "rgba(255,255,255,0.55)",
    weight: "400"
  }
};

export function createEngine(options = {}) {
  const config = {
    ...DEFAULTS,
    ...options,
    defaults: {
      ...DEFAULTS.defaults,
      ...(options.defaults || {})
    }
  };

  const element = config.element;
  const renderer = createPreRenderer(element);
  const pointer = createPointer(element);
  const metrics = measureTextGrid(element);
  const buffer = [];
  const runtime = {
    frame: 0,
    startTime: 0,
    previousTick: 0,
    cols: 0,
    rows: 0,
    animationId: 0
  };

  function ensureBuffer(length) {
    ensureArrayLength(buffer, length, () => createCell(config.defaults));
  }

  function getState(timestamp) {
    const bounds = measureGridBounds(element, metrics, config.cols, config.rows);
    return Object.freeze({
      frame: runtime.frame,
      time: timestamp,
      cols: bounds.cols,
      rows: bounds.rows,
      width: bounds.width,
      height: bounds.height,
      m: metrics,
      defaults: config.defaults,
      runtime: Object.freeze({ fps: config.fps })
    });
  }

  function resetFrameBuffer() {
    for (const cell of buffer) resetCell(cell, config.defaults);
  }

  function tick(timestamp) {
    if (!runtime.startTime) runtime.startTime = timestamp;
    const minDelta = 1000 / config.fps;
    const delta = timestamp - runtime.previousTick;

    if (delta < minDelta) {
      runtime.animationId = requestAnimationFrame(tick);
      return;
    }

    runtime.previousTick = timestamp - (delta % minDelta);
    metrics.refresh();

    const state = getState(timestamp - runtime.startTime);
    const input = pointer.sample(metrics);
    const total = state.cols * state.rows;

    if (runtime.cols !== state.cols || runtime.rows !== state.rows) {
      runtime.cols = state.cols;
      runtime.rows = state.rows;
      ensureBuffer(total);
      if (typeof config.setup === "function") config.setup(state, buffer, config.context);
    } else {
      ensureBuffer(total);
    }

    resetFrameBuffer();

    if (typeof config.updateGlobal === "function") {
      config.updateGlobal(state, input, buffer, config.context);
    }

    if (typeof config.renderCell === "function") {
      for (let y = 0; y < state.rows; y += 1) {
        for (let x = 0; x < state.cols; x += 1) {
          const index = x + y * state.cols;
          const patch = config.renderCell({ x, y, index }, state, input, buffer, config.context);
          if (patch && typeof patch === "object") Object.assign(buffer[index], patch);
        }
      }
    }

    if (typeof config.overlay === "function") {
      config.overlay(state, input, buffer, config.context);
    }

    renderer.render(state, buffer);
    runtime.frame += 1;
    runtime.animationId = requestAnimationFrame(tick);
  }

  return {
    start() {
      document.fonts.ready.then(() => {
        runtime.animationId = requestAnimationFrame(tick);
      });
    },
    stop() {
      cancelAnimationFrame(runtime.animationId);
    }
  };
}