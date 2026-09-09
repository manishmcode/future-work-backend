import { Request, Response } from "express";
import { sendError } from "../utils/api-response";

export function notFoundMiddleware(_req: Request, res: Response): Response {
    return sendError(res, "Route not found", 404);
}
