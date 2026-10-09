import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApiError } from "../utils/apiError";

import {
  editMyResource,
  getMyResource,
  getMyResources,
  getResourceInventory,
  provideResource,
  removeMyResource,
} from "../services/dildhara-resourceService";

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  return req.user;
}

function getResourceId(
  value: string | string[] | undefined
): string {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

/**
 * GET central resource inventory.
 * Coordinator access only.
 */
export async function listResourceInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resources = await getResourceInventory(user.role);

    res.status(200).json({ resources });
  } catch (error) {
    next(error);
  }
}

/**
 * POST provide a resource.
 */
export async function createResource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resource = await provideResource(
      user.sub,
      user.role,
      req.body
    );

    res.status(201).json({
      message: "Resource provided successfully.",
      resource,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET resources belonging to the logged-in provider.
 */
export async function listMyResources(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resources = await getMyResources(user.sub);

    res.status(200).json({ resources });
  } catch (error) {
    next(error);
  }
}

/**
 * GET one resource belonging to the logged-in provider.
 */
export async function getResource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resource = await getMyResource(
      user.sub,
      getResourceId(req.params.id)
    );

    res.status(200).json({ resource });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH/PUT update a provider's resource.
 */
export async function updateResource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resource = await editMyResource(
      user.sub,
      user.role,
      getResourceId(req.params.id),
      req.body
    );

    res.status(200).json({
      message: "Resource updated successfully.",
      resource,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE a provider's available resource.
 */
export async function deleteResource(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    await removeMyResource(
      user.sub,
      getResourceId(req.params.id)
    );

    res.status(200).json({
      message: "Resource removed successfully.",
    });
  } catch (error) {
    next(error);
  }
}