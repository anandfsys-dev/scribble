// Ramer-Douglas-Peucker squared distance from point p to segment p1→p2
export function getSqSegDist(p, p1, p2) {
  let x = p1[0], y = p1[1], dx = p2[0] - x, dy = p2[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = p2[0]; y = p2[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}

// Total arc length of a polyline
export function calculatePathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

// Ramer-Douglas-Peucker polyline simplification
export function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;

  const step = (pts, first, last) => {
    let maxSqDist = 0, index = 0;
    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
    }
    if (maxSqDist > sqTolerance) {
      return step(pts, first, index).slice(0, -1).concat(step(pts, index, last));
    }
    return [pts[first], pts[last]];
  };

  return step(points, 0, points.length - 1);
}
