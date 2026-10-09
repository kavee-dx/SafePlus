import { describe, expect, it } from "vitest";

import { formatArea, pointInDistrict, pointInRing, polygonAreaSqKm } from "./dushani-geo";
import type { Coordinate } from "../types/warning";

const square = (edge: number): Coordinate[] => [
  { lat: 0, lng: 0 },
  { lat: 0, lng: edge },
  { lat: edge, lng: edge },
  { lat: edge, lng: 0 },
];

describe("pointInRing", () => {
  it("keeps a click inside the shape", () => {
    expect(pointInRing({ lat: 5, lng: 5 }, square(10))).toBe(true);
  });

  it("rejects a click outside on every side", () => {
    const ring = square(10);

    expect(pointInRing({ lat: 15, lng: 5 }, ring)).toBe(false);
    expect(pointInRing({ lat: -1, lng: 5 }, ring)).toBe(false);
    expect(pointInRing({ lat: 5, lng: 20 }, ring)).toBe(false);
    expect(pointInRing({ lat: 5, lng: -3 }, ring)).toBe(false);
  });

  it("rejects a click in the sea next to an empty ring", () => {
    expect(pointInRing({ lat: 6.9, lng: 79.8 }, [])).toBe(false);
  });
});

describe("pointInDistrict", () => {
  it("accepts a point that falls in any one of a district's rings", () => {
    const islands = [square(10), [
      { lat: 20, lng: 20 },
      { lat: 20, lng: 25 },
      { lat: 25, lng: 25 },
      { lat: 25, lng: 20 },
    ]];

    expect(pointInDistrict({ lat: 22, lng: 22 }, islands)).toBe(true);
    expect(pointInDistrict({ lat: 15, lng: 15 }, islands)).toBe(false);
  });

  it("rejects a point when the district has no boundary loaded", () => {
    expect(pointInDistrict({ lat: 6.9, lng: 79.8 }, [])).toBe(false);
  });
});

describe("polygonAreaSqKm", () => {
  it("returns nothing for a shape that cannot enclose an area", () => {
    expect(polygonAreaSqKm([])).toBe(0);
    expect(polygonAreaSqKm(square(1).slice(0, 2))).toBe(0);
  });

  it("measures a one degree square at the equator as roughly twelve thousand square kilometres", () => {
    expect(polygonAreaSqKm(square(1))).toBeGreaterThan(12_000);
    expect(polygonAreaSqKm(square(1))).toBeLessThan(12_500);
  });

  it("gives the same area whether or not the ring repeats its first corner", () => {
    const open = square(2);
    const closed = [...open, open[0]];

    expect(polygonAreaSqKm(closed)).toBe(polygonAreaSqKm(open));
  });

  it("multiplies the area by four when the sides are doubled", () => {
    const unit = polygonAreaSqKm(square(1));
    const doubled = polygonAreaSqKm(square(2));

    expect(doubled).toBeGreaterThan(unit * 3.9);
    expect(doubled).toBeLessThan(unit * 4.1);
  });
});

describe("formatArea", () => {
  it("switches to hectares below a square kilometre so a small zone is not shown as 0.0 km²", () => {
    expect(formatArea(1)).toBe("1.0 km²");
    expect(formatArea(0.75)).toBe("75 ha");
    expect(formatArea(0.04)).toBe("4 ha");
    expect(formatArea(12.34)).toBe("12.3 km²");
  });
});
