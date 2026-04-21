const PADDING = 10;

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
      return pos.x >= element.x - PADDING &&
             pos.x <= element.x + w + PADDING &&
             pos.y >= element.y - h / 2 - PADDING &&
             pos.y <= element.y + h / 2 + PADDING;
    }
    case 'line':
    case 'arrow':
      return pos.x >= Math.min(element.x, element.x2) - PADDING &&
             pos.x <= Math.max(element.x, element.x2) + PADDING &&
             pos.y >= Math.min(element.y, element.y2) - PADDING &&
             pos.y <= Math.max(element.y, element.y2) + PADDING;
    case 'freehand': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      element.points.forEach(p => {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
      return pos.x >= minX - PADDING && pos.x <= maxX + PADDING &&
             pos.y >= minY - PADDING && pos.y <= maxY + PADDING;
    }
  }
  return false;
}

// Returns { minX, maxX, minY, maxY } bounding box for any element type
export function getElementBounds(element) {
  let minX = element.x, maxX = element.x, minY = element.y, maxY = element.y;

  switch (element.type) {
    case 'rectangle':
    case 'ellipse': {
      const w = element.width || 0, h = element.height || 0;
      minX = Math.min(element.x, element.x + w); maxX = Math.max(element.x, element.x + w);
      minY = Math.min(element.y, element.y + h); maxY = Math.max(element.y, element.y + h);
      break;
    }
    case 'text': {
      const w = element.width || 20, h = element.height || 20;
      maxX = element.x + w;
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
