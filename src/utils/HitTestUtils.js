const PADDING = 10;
const HIT_DISTANCE = 10; // px from path for line/arrow hit

// ── Path-distance helpers ────────────────────────────────────────

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

// Mirrors the control-point logic in Renderer.js so hit-testing matches the drawn curve.
function arrowControlPoints(el) {
  const { x, y, x2, y2 } = el;
  let startHorizontal = true;
  if (el.startBinding && (el.startBinding.key === 'top' || el.startBinding.key === 'bottom')) {
    startHorizontal = false;
  }
  let endHorizontal = !startHorizontal;
  if (el.endBinding) {
    endHorizontal = el.endBinding.key === 'left' || el.endBinding.key === 'right';
  } else if (!el.startBinding) {
    const adx = Math.abs(x2 - x), ady = Math.abs(y2 - y);
    startHorizontal = adx >= ady;
    endHorizontal = startHorizontal;
  } else {
    const adx = Math.abs(x2 - x), ady = Math.abs(y2 - y);
    endHorizontal = adx >= ady;
  }
  const cx1 = startHorizontal ? (x + x2) / 2 : x;
  const cy1 = startHorizontal ? y : (y + y2) / 2;
  const cx2 = endHorizontal ? (x + x2) / 2 : x2;
  const cy2 = endHorizontal ? y2 : (y + y2) / 2;
  return { cx1, cy1, cx2, cy2 };
}

function distToArrow(px, py, el) {
  const { x, y, x2, y2 } = el;
  const { cx1, cy1, cx2, cy2 } = arrowControlPoints(el);
  let minDist = Infinity;
  const STEPS = 24;
  let prevX = x, prevY = y;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const bx = cubicBezier(t, x, cx1, cx2, x2);
    const by = cubicBezier(t, y, cy1, cy2, y2);
    const d = distToSegment(px, py, prevX, prevY, bx, by);
    if (d < minDist) minDist = d;
    prevX = bx; prevY = by;
  }
  return minDist;
}

// ── Public API ───────────────────────────────────────────────────

// Returns the first element (topmost) whose bounds contain pos, or null
export function getElementAt(elements, pos, excludeId = null, types = null) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (elements[i].id === excludeId) continue;
    if (types && !types.includes(elements[i].type)) continue;
    if (hitTest(pos, elements[i])) return elements[i];
  }
  return null;
}

// Returns true if pos falls within the hit area of element
export function hitTest(pos, element) {
  switch (element.type) {
    case 'frame':
    case 'rectangle':
    case 'ellipse': {
      const w = element.width || 0;
      const h = element.height || 0;
      return pos.x >= Math.min(element.x, element.x + w) - PADDING &&
             pos.x <= Math.max(element.x, element.x + w) + PADDING &&
             pos.y >= Math.min(element.y, element.y + h) - PADDING &&
             pos.y <= Math.max(element.y, element.y + h) + PADDING;
    }
    case 'text': {
      const w = element.width  || 20;
      const h = element.height || 20;
      const left = element.textAlign === 'center' ? element.x - w / 2 : element.x;
      return pos.x >= left - PADDING &&
             pos.x <= left + w + PADDING &&
             pos.y >= element.y - h / 2 - PADDING &&
             pos.y <= element.y + h / 2 + PADDING;
    }
    case 'line':
      return distToSegment(pos.x, pos.y, element.x, element.y, element.x2, element.y2) <= HIT_DISTANCE;
    case 'arrow':
      return distToArrow(pos.x, pos.y, element) <= HIT_DISTANCE;
    case 'freehand': {
      // Quick bounding-box pre-check before per-segment test
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      element.points.forEach(p => {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
      if (pos.x < minX - PADDING || pos.x > maxX + PADDING ||
          pos.y < minY - PADDING || pos.y > maxY + PADDING) return false;
      // Per-segment distance check
      for (let i = 1; i < element.points.length; i++) {
        const [ax, ay] = element.points[i - 1];
        const [bx, by] = element.points[i];
        if (distToSegment(pos.x, pos.y, ax, ay, bx, by) <= HIT_DISTANCE) return true;
      }
      return false;
    }
  }
  return false;
}

// Returns { minX, maxX, minY, maxY } bounding box for any element type
export function getElementBounds(element) {
  let minX = element.x, maxX = element.x, minY = element.y, maxY = element.y;

  switch (element.type) {
    case 'frame':
    case 'rectangle':
    case 'ellipse': {
      const w = element.width || 0, h = element.height || 0;
      minX = Math.min(element.x, element.x + w); maxX = Math.max(element.x, element.x + w);
      minY = Math.min(element.y, element.y + h); maxY = Math.max(element.y, element.y + h);
      break;
    }
    case 'text': {
      const w = element.width || 20, h = element.height || 20;
      const left = element.textAlign === 'center' ? element.x - w / 2 : element.x;
      minX = left; maxX = left + w;
      minY = element.y - h / 2; maxY = element.y + h / 2;
      break;
    }
    case 'line':
    case 'arrow':
      minX = Math.min(element.x, element.x2); maxX = Math.max(element.x, element.x2);
      minY = Math.min(element.y, element.y2); maxY = Math.max(element.y, element.y2);
      break;
    case 'freehand':
      minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
      element.points.forEach(p => {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
      break;
  }
  return { minX, maxX, minY, maxY };
}

// True if pos is at least 15px inside the element edges (used to suppress connection points)
export function isPointDeepInsideElement(pos, element) {
  const b = getElementBounds(element);
  const inner = 15;
  if (b.maxX - b.minX <= inner * 2 || b.maxY - b.minY <= inner * 2) return false;
  return pos.x >= b.minX + inner && pos.x <= b.maxX - inner &&
         pos.y >= b.minY + inner && pos.y <= b.maxY - inner;
}
