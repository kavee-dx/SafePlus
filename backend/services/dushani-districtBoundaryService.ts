import fs from "fs";
import path from "path";

import type { Coordinate, DistrictBoundary } from "../models/disasterWarning";

interface RawRing {
  district: string;
  iso: string;
  areaSqKm: number;
  rings: [number, number][][];
}

interface RawAsset {
  source: string;
  districts: RawRing[];
}

export interface BoundaryAnalysis {
  isValid: boolean;
  error?: string;
  areaSqKm: number;
  overlapRatio: number;
  fullyInsideDistrict: boolean;
}

const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LNG = 111.32;
const MIN_AREA_SQ_KM = 0.05;
const MAX_AREA_SQ_KM = 9000;
const OVERLAP_THRESHOLD = 0.95;
const SAMPLE_GRID = 24;

/**
 * Authoritative source for Sri Lanka's 25 administrative districts.
 * District selection, map rendering and server-side validation all read this
 * single asset, so a form value can never disagree with the drawn boundary.
 */
export class DistrictBoundaryService {
  private ringsByDistrict = new Map<string, Coordinate[][]>();
  private indexByDistrict = new Map<string, DistrictBoundary>();
  private districtsByName = new Set<string>();

  constructor(assetPath = path.join(process.cwd(), "assets", "district-boundaries.json")) {
    this.load(assetPath);
  }

  private load(assetPath: string): void {
    const raw = JSON.parse(fs.readFileSync(assetPath, "utf-8")) as RawAsset;

    for (const entry of raw.districts) {
      const rings = entry.rings.map((ring) => toCoordinates(ring));
      const all = rings.flat();
      const lats = all.map((point) => point.lat);
      const lngs = all.map((point) => point.lng);
      const name = normalizeDistrictName(entry.district);

      this.ringsByDistrict.set(name, rings);
      this.districtsByName.add(name);
      this.indexByDistrict.set(name, {
        district: name,
        iso: entry.iso,
        areaSqKm: entry.areaSqKm,
        centroid: {
          lat: mean(lats),
          lng: mean(lngs),
        },
        bounds: {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
        },
      });
    }
  }

  listDistricts(): DistrictBoundary[] {
    return [...this.indexByDistrict.values()].sort((a, b) =>
      a.district.localeCompare(b.district)
    );
  }

  hasDistrict(district: string): boolean {
    return this.districtsByName.has(normalizeDistrictName(district));
  }

  getBoundary(district: string): DistrictBoundary | undefined {
    return this.indexByDistrict.get(normalizeDistrictName(district));
  }

  getRings(district: string): Coordinate[][] | undefined {
    return this.ringsByDistrict.get(normalizeDistrictName(district));
  }

  /**
   * Ray casting against every ring of the district, so enclaves and the
   * multipolygon islands are handled correctly.
   */
  isPointInDistrict(district: string, point: Coordinate): boolean {
    const rings = this.getRings(district);

    if (!rings) {
      return false;
    }

    return rings.some((ring) => pointInRing(ring, point));
  }

  /**
   * Resolves the district a raw GPS fix falls in. Used to keep a citizen's
   * self-reported district and their live location honest with each other.
   */
  resolveDistrict(point: Coordinate): string | undefined {
    for (const [district, rings] of this.ringsByDistrict) {
      const bounds = this.indexByDistrict.get(district)?.bounds;

      if (bounds && !withinBounds(bounds, point)) {
        continue;
      }

      if (rings.some((ring) => pointInRing(ring, point))) {
        return district;
      }
    }

    return undefined;
  }

  /**
   * E2 of the use case: an operator-drawn polygon that is degenerate or that
   * leaks outside the selected district is rejected before dispatch.
   */
  analyzeBoundary(district: string, polygon: Coordinate[]): BoundaryAnalysis {
    const invalid = (error: string): BoundaryAnalysis => ({
      isValid: false,
      error,
      areaSqKm: 0,
      overlapRatio: 0,
      fullyInsideDistrict: false,
    });

    const boundary = this.getBoundary(district);

    if (!boundary) {
      return invalid(`"${district}" is not one of Sri Lanka's 25 districts.`);
    }

    if (polygon.length < 4) {
      return invalid("A target boundary needs at least 3 corners.");
    }

    if (polygon.some((point) => !isRealCoordinate(point))) {
      return invalid("Boundary coordinates must be real values inside Sri Lanka.");
    }

    const ring = closeRing(polygon);
    const areaSqKm = Number(polygonAreaSqKm(ring).toFixed(2));

    if (areaSqKm < MIN_AREA_SQ_KM) {
      return invalid("The drawn area is too small to target. Draw a larger boundary.");
    }

    if (areaSqKm > MAX_AREA_SQ_KM) {
      return invalid(`The drawn area (${areaSqKm} km²) is larger than a district.`);
    }

    const overlapRatio = overlapWithDistrict(ring, this.getRings(district) ?? []);
    const fullyInsideDistrict = overlapRatio >= OVERLAP_THRESHOLD;

    if (!fullyInsideDistrict) {
      return {
        isValid: false,
        error: `The drawn boundary only falls ${(overlapRatio * 100).toFixed(
          0
        )}% inside ${district} District. Keep the whole area inside the selected district.`,
        areaSqKm,
        overlapRatio,
        fullyInsideDistrict,
      };
    }

    return { isValid: true, areaSqKm, overlapRatio, fullyInsideDistrict };
  }

  /**
   * Membership test for a polygon the officer drew themselves.
   */
  containsPoint(ring: Coordinate[], point: Coordinate): boolean {
    if (ring.length < 4) {
      return false;
    }

    return pointInRing(closeRing(ring), point);
  }

  /**
   * The boundary the portal draws when an officer only picks a district.
   */
  districtPolygon(district: string): Coordinate[] | undefined {
    const rings = this.getRings(district);

    if (!rings) {
      return undefined;
    }

    return [...rings].sort((a, b) => ringAreaSqKm(b) - ringAreaSqKm(a))[0];
  }
}

function normalizeDistrictName(district: string): string {
  return district.trim().replace(/\s+district$/i, "");
}

function toCoordinates(ring: [number, number][]): Coordinate[] {
  return closeRing(ring.map(([lng, lat]) => ({ lat, lng })));
}

function closeRing(ring: Coordinate[]): Coordinate[] {
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first.lat === last.lat && first.lng === last.lng) {
    return ring;
  }

  return [...ring, first];
}

function pointInRing(ring: Coordinate[], point: Coordinate): boolean {
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

function withinBounds(
  bounds: DistrictBoundary["bounds"],
  point: Coordinate
): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lng >= bounds.minLng &&
    point.lng <= bounds.maxLng
  );
}

function polygonAreaSqKm(ring: Coordinate[]): number {
  if (ring.length < 4) {
    return 0;
  }

  const meanLat = mean(ring.map((point) => point.lat));
  const lngScale = Math.cos((meanLat * Math.PI) / 180) * KM_PER_DEGREE_LNG;
  let sum = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const current = ring[i];
    const next = ring[i + 1];
    sum +=
      current.lng * lngScale * (next.lat * KM_PER_DEGREE_LAT) -
      next.lng * lngScale * (current.lat * KM_PER_DEGREE_LAT);
  }

  return Math.abs(sum) / 2;
}

function ringAreaSqKm(ring: Coordinate[]): number {
  return polygonAreaSqKm(ring);
}

/**
 * Grid-samples the drawn polygon's bounding box to estimate how much of it
 * sits inside the selected district, without needing a geometry library.
 */
function overlapWithDistrict(ring: Coordinate[], districtRings: Coordinate[][]): number {
  const lats = ring.map((point) => point.lat);
  const lngs = ring.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  let insidePolygon = 0;
  let insideBoth = 0;

  for (let row = 0; row <= SAMPLE_GRID; row++) {
    for (let col = 0; col <= SAMPLE_GRID; col++) {
      const point = {
        lat: minLat + ((maxLat - minLat) * row) / SAMPLE_GRID,
        lng: minLng + ((maxLng - minLng) * col) / SAMPLE_GRID,
      };

      if (!pointInRing(ring, point)) {
        continue;
      }

      insidePolygon += 1;

      if (districtRings.some((districtRing) => pointInRing(districtRing, point))) {
        insideBoth += 1;
      }
    }
  }

  if (insidePolygon === 0) {
    return 0;
  }

  return Number((insideBoth / insidePolygon).toFixed(4));
}

function isRealCoordinate(point: Coordinate): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

let districtBoundaryService: DistrictBoundaryService | null = null;

export function getDistrictBoundaryService(): DistrictBoundaryService {
  if (!districtBoundaryService) {
    districtBoundaryService = new DistrictBoundaryService();
  }

  return districtBoundaryService;
}
