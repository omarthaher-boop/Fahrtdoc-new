/**
 * Douglas-Peucker path decimation for GPS traces.
 *
 * Reduces a dense array of lat/lon points to at most `maxPoints` while
 * preserving the overall route shape (curves, turns, detours).
 *
 * The perpendicular distance is computed in a flat-earth approximation
 * (degrees), which is accurate enough for individual trip segments.
 */

interface Point {
  lat: number;
  lon: number;
}

function perpendicularDistanceSq(p: Point, a: Point, b: Point): number {
  const dx = b.lat - a.lat;
  const dy = b.lon - a.lon;

  if (dx === 0 && dy === 0) {
    const ex = p.lat - a.lat;
    const ey = p.lon - a.lon;
    return ex * ex + ey * ey;
  }

  const t = ((p.lat - a.lat) * dx + (p.lon - a.lon) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  const nearLat = a.lat + tClamped * dx;
  const nearLon = a.lon + tClamped * dy;
  const ex = p.lat - nearLat;
  const ey = p.lon - nearLon;
  return ex * ex + ey * ey;
}

function douglasPeucker(points: Point[], start: number, end: number, epsilonSq: number, kept: boolean[]): void {
  if (end <= start + 1) return;

  let maxDistSq = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const dSq = perpendicularDistanceSq(points[i], points[start], points[end]);
    if (dSq > maxDistSq) {
      maxDistSq = dSq;
      maxIdx = i;
    }
  }

  if (maxDistSq > epsilonSq) {
    kept[maxIdx] = true;
    douglasPeucker(points, start, maxIdx, epsilonSq, kept);
    douglasPeucker(points, maxIdx, end, epsilonSq, kept);
  }
}

/**
 * Decimate a GPS path so it has at most `maxPoints` points.
 *
 * - Returns the original array unchanged if it is already within the limit.
 * - Always keeps the first and last point so the route endpoints are exact.
 * - Uses Douglas-Peucker to preserve shape; falls back to uniform stride if
 *   the algorithm still yields more than `maxPoints` after the first pass.
 */
export function decimatePath(points: Point[], maxPoints = 200): Point[] {
  if (points.length <= maxPoints) return points;

  const n = points.length;
  const kept = new Array<boolean>(n).fill(false);
  kept[0] = true;
  kept[n - 1] = true;

  let epsilonSq = 1e-10;
  let result: Point[] = [];

  for (let attempt = 0; attempt < 30; attempt++) {
    const attemptKept = kept.slice();
    douglasPeucker(points, 0, n - 1, epsilonSq, attemptKept);
    result = points.filter((_, i) => attemptKept[i]);

    if (result.length <= maxPoints) break;

    epsilonSq *= 4;
  }

  if (result.length > maxPoints) {
    const stride = Math.ceil(n / maxPoints);
    const strideKept = new Array<boolean>(n).fill(false);
    for (let i = 0; i < n; i += stride) strideKept[i] = true;
    strideKept[n - 1] = true;
    result = points.filter((_, i) => strideKept[i]);
  }

  return result;
}
