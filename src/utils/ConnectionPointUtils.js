// Returns { top, bottom, left, right, center } anchor points for connectable elements, or null
export function getConnectionPoints(el) {
  if (el.type === 'rectangle' || el.type === 'ellipse') {
    const w = el.width, h = el.height;
    return {
      top:    { x: el.x + w / 2, y: el.y },
      bottom: { x: el.x + w / 2, y: el.y + h },
      left:   { x: el.x,         y: el.y + h / 2 },
      right:  { x: el.x + w,     y: el.y + h / 2 },
      center: { x: el.x + w / 2, y: el.y + h / 2 }
    };
  }
  if (el.type === 'text') {
    const w = el.width || 100, h = el.height || 50;
    const cx = el.textAlign === 'center' ? el.x : el.x + w / 2;
    const left = el.textAlign === 'center' ? el.x - w / 2 : el.x;
    const right = left + w;
    return {
      top:    { x: cx,    y: el.y - h / 2 },
      bottom: { x: cx,    y: el.y + h / 2 },
      left:   { x: left,  y: el.y },
      right:  { x: right, y: el.y },
      center: { x: cx,    y: el.y }
    };
  }
  return null;
}

// Returns { key, point } for the anchor on el closest to pos (prefers edge points over center)
export function getClosestConnectionPoint(pos, el) {
  const points = getConnectionPoints(el);
  if (!points) return null;

  let closest = null, minDist = Infinity;
  for (const [key, point] of Object.entries(points)) {
    const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
    if (dist < minDist) { minDist = dist; closest = { key, point }; }
  }

  // Prefer edge anchors unless cursor is very close to center
  if (closest.key === 'center' && minDist > 30) {
    minDist = Infinity;
    for (const [key, point] of Object.entries(points)) {
      if (key === 'center') continue;
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist < minDist) { minDist = dist; closest = { key, point }; }
    }
  }

  return closest;
}
