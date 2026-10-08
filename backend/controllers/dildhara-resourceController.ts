import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/apiError";

import {
  editMyResource,
  getMyResource,
  getMyResources,
  provideResource,
  removeMyResource,
} from "../services/dildhara-resourceService";

function getResourceId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required.");
  }

  return req.user;
}

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

export async function listMyResources(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);

    const resources = await getMyResources(user.sub);

    res.json({
      resources,
    });
  } catch (error) {
    next(error);
  }
}

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

    res.json({
      resource,
    });
  } catch (error) {
    next(error);
  }
}

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

    res.json({
      message: "Resource updated successfully.",
      resource,
    });
  } catch (error) {
    next(error);
  }
}

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

    res.json({
      message: "Resource removed successfully.",
    });
  } catch (error) {
    next(error);
  }
}