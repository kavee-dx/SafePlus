import type { Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import { getDistrictBoundaryService } from "../services/dushani-districtBoundaryService";
import type { Coordinate } from "../models/disasterWarning";

const boundaryService = getDistrictBoundaryService();

/**
 * GET /api/geo/districts - the canonical district list the portal dropdown uses
 */
export async function listDistricts(
  _req: Request,
  res: Response
): Promise<void> {
  res.json({
    source: "geoBoundaries gbOpen LKA ADM2 (OSM, ODbL 1.0)",
    districts: boundaryService.listDistricts(),
  });
}

/**
 * GET /api/geo/districts/:district/boundary - the ring the map draws
 */
export async function getDistrictBoundary(
  req: Request,
  res: Response
): Promise<void> {
  const district = singleParam(req.params.district);
  const boundary = boundaryService.getBoundary(district);

  if (!boundary) {
    throw new ApiError(404, `Unknown district: ${district}`);
  }

  res.json({
    boundary,
    rings: boundaryService.getRings(district),
  });
}

/**
 * POST /api/geo/resolve - which district does this point fall in?
 */
export async function resolveDistrict(req: Request, res: Response): Promise<void> {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, "lat and lng must be numbers.");
  }

  res.json({ district: boundaryService.resolveDistrict({ lat, lng }) ?? null });
}

/**
 * POST /api/geo/validate-boundary - E2 pre-flight check for a drawn polygon
 */
export async function validateBoundary(
  req: Request,
  res: Response
): Promise<void> {
  const district = String(req.body?.district ?? "");
  const polygon = req.body?.polygon as unknown;

  if (!Array.isArray(polygon)) {
    throw new ApiError(400, "polygon must be an array of { lat, lng } points.");
  }

  const analysis = boundaryService.analyzeBoundary(
    district,
    polygon as Coordinate[]
  );

  res.json(analysis);
}

function singleParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}
