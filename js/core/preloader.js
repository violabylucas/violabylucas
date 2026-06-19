function getMarkWidth(mark) {
  return Math.max(...mark.split("\n").map((row) => row.length));
}

function pickResponsiveMark(marks, cols, padding = 4) {
  for (const mark of marks) {
    const width = getMarkWidth(mark);
    if (width <= cols - padding * 2) return mark;
  }
  return marks[marks.length - 1];
}

export async function runAsciiPreloader({
  element,
  marks,
  duration = 1400,
  hold = 180,
  fade = 480,
  unrevealedChar = "."
}) {
  if (!element || !Array.isArray(marks) || !marks.length) return;

  const styles = getComputedStyle(element);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${styles.fontSize} ${styles.fontFamily}`;

  const charWidth = context.measureText("xxxxxxxxxx").width / 10;
  const lineHeight = parseFloat(styles.lineHeight);

  const cols = Math.floor(window.innerWidth / charWidth);
  const screenRows = Math.floor(window.innerHeight / lineHeight);

  const mark = pickResponsiveMark(marks, cols, 4);
  const rows = mark.replace(/\r/g, "").split("\n");
  const markWidth = Math.max(...rows.map((row) => row.length));
  const markHeight = rows.length;

  const startX = Math.floor((cols - markWidth) / 2);
  const startY = Math.floor((screenRows - markHeight) / 2);

  const startTime = performance.now();

  function buildFrame(progress) {
    const revealCol = Math.floor((markWidth - 1) * progress);
    const frame = new Array(screenRows).fill("").map(() => " ".repeat(cols));

    for (let y = 0; y < markHeight; y += 1) {
      const sourceRow = rows[y].padEnd(markWidth, " ");
      const screenRowIndex = startY + y;
      if (screenRowIndex < 0 || screenRowIndex >= screenRows) continue;

      const chars = frame[screenRowIndex].split("");

      for (let x = 0; x < markWidth; x += 1) {
        const targetCol = startX + x;
        if (targetCol < 0 || targetCol >= cols) continue;

        const char = sourceRow[x];
        if (char === " ") continue;

        chars[targetCol] = x <= revealCol ? char : unrevealedChar;
      }

      frame[screenRowIndex] = chars.join("");
    }

    element.textContent = frame.join("\n");
  }

  await new Promise((resolve) => {
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      buildFrame(progress);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });

  await new Promise((resolve) => setTimeout(resolve, hold));
  element.classList.add("is-hidden");
  await new Promise((resolve) => setTimeout(resolve, fade));
  element.remove();
}