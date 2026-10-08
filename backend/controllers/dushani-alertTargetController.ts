import type { Request, Response } from "express";

import { ApiError } from "../utils/apiError";
import { updateAlertTarget } from "../repositories/dushani-warningRepository";

/**
 * PUT /api/alert-target - the mobile app tells SafePlus how to reach this
 * citizen and where they last were, which is what makes an audience real.
 */
export async function saveMyAlertTarget(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const deviceToken =
    typeof body.deviceToken === "string" ? body.deviceToken.trim() : "";
  const latitude = readCoordinate(body.latitude, "latitude", -90, 90);
  const longitude = readCoordinate(body.longitude, "longitude", -180, 180);

  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ApiError(400, "Send both a latitude and a longitude.", {
      latitude: "Both or neither.",
      longitude: "Both or neither.",
    });
  }

  if (!deviceToken && latitude === undefined) {
    throw new ApiError(400, "Nothing to store.", {
      deviceToken: "Provide a push token or a location.",
    });
  }

  if (deviceToken.length > 512) {
    throw new ApiError(400, "That push token is too long.", {
      deviceToken: "Maximum 512 characters.",
    });
  }

  await updateAlertTarget(req.user!.sub, {
    ...(deviceToken ? { deviceToken } : {}),
    ...(latitude !== undefined ? { latitude, longitude } : {}),
  });

  res.json({ message: "Alert target saved. You will be counted in your district." });
}

function readCoordinate(
  value: unknown,
  field: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, `Check the ${field} you sent.`, {
      [field]: `Must be between ${min} and ${max}.`,
    });
  }

  return parsed;
}
