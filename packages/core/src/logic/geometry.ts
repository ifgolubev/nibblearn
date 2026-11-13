export interface PercentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Point and rect in percentages of the image. */
export function pointInRect(px: number, py: number, rect: PercentRect, tolerance = 0): boolean {
  return (
    px >= rect.x - tolerance &&
    px <= rect.x + rect.width + tolerance &&
    py >= rect.y - tolerance &&
    py <= rect.y + rect.height + tolerance
  );
}

/** Convert a client coordinate into percentages relative to an element's bounding box. */
export function toPercent(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
) {
  if (box.width === 0 || box.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - box.left) / box.width) * 100,
    y: ((clientY - box.top) / box.height) * 100,
  };
}
