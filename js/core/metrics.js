export function measureTextGrid(element) {
  const styles = getComputedStyle(element);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = parseFloat(styles.fontSize);
  const lineHeight = parseFloat(styles.lineHeight);
  const fontFamily = styles.fontFamily;

  context.font = `${fontSize}px ${fontFamily}`;
  const charWidth = context.measureText("xxxxxxxxxx").width / 10;
  const aspect = charWidth / lineHeight;

  return {
    charWidth,
    lineHeight,
    fontFamily,
    fontSize,
    aspect,
    refresh() {
      const next = measureTextGrid(element);
      this.charWidth = next.charWidth;
      this.lineHeight = next.lineHeight;
      this.fontFamily = next.fontFamily;
      this.fontSize = next.fontSize;
      this.aspect = next.aspect;
    }
  };
}

export function measureGridBounds(element, metrics, explicitCols = 0, explicitRows = 0) {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    cols: explicitCols || Math.floor(rect.width / metrics.charWidth),
    rows: explicitRows || Math.floor(rect.height / metrics.lineHeight)
  };
}