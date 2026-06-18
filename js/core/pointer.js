export function createPointer(element) {
  const state = {
    x: 0,
    y: 0,
    pressed: false,
    previousX: 0,
    previousY: 0,
    previousPressed: false
  };

  const updateFromEvent = (event) => {
    const rect = element.getBoundingClientRect();
    state.x = event.clientX - rect.left;
    state.y = event.clientY - rect.top;
  };

  element.addEventListener("pointermove", (event) => {
    updateFromEvent(event);
  });

  element.addEventListener("pointerdown", (event) => {
    updateFromEvent(event);
    state.pressed = true;
  });

  element.addEventListener("pointerup", () => {
    state.pressed = false;
  });

  element.addEventListener("pointercancel", () => {
    state.pressed = false;
  });

  element.addEventListener("pointerleave", () => {
    state.pressed = false;
  });

  return {
    raw: state,
    sample(metrics) {
      const current = {
        x: state.x / metrics.charWidth,
        y: state.y / metrics.lineHeight,
        pressed: state.pressed,
        q: {
          x: state.previousX / metrics.charWidth,
          y: state.previousY / metrics.lineHeight,
          pressed: state.previousPressed
        }
      };

      state.previousX = state.x;
      state.previousY = state.y;
      state.previousPressed = state.pressed;
      return current;
    }
  };
}