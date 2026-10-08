import type { Coordinate } from "../types/warning";

/**
 * Ray casting against every ring of a district, so the portal can reject a
 * click that falls in the sea or in a neighbouring district before it is ever
 * sent to the server.
 */
export function pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];

    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

export function pointInDistrict(
  point: Coordinate,
  rings: Coordinate[][]
): boolean {
  return rings.some((ring) => pointInRing(point, ring));
}

/**
 * Plain-English area of a closed shape, in km2, matching the server maths.
 */
export function polygonAreaSqKm(points: Coordinate[]): number {
  if (points.length < 3) {
    return 0;
  }

  const closed =
    points[0].lat === points[points.length - 1].lat &&
    points[0].lng === points[points.length - 1].lng
      ? points
      : [...points, points[0]];
  const meanLat =
    closed.reduce((total, point) => total + point.lat, 0) / closed.length;
  const lngScale = Math.cos((meanLat * Math.PI) / 180) * 111.32;

  let sum = 0;

  for (let i = 0; i < closed.length - 1; i++) {
    const current = closed[i];
    const next = closed[i + 1];

    sum +=
      current.lng * lngScale * (next.lat * 110.574) -
      next.lng * lngScale * (current.lat * 110.574);
  }

  return Number((Math.abs(sum) / 2).toFixed(2));
}

export function formatArea(areaSqKm: number): string {
  return areaSqKm >= 1 ? `${areaSqKm.toFixed(1)} km²` : `${Math.round(areaSqKm * 100)} ha`;
}
