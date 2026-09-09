import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";
import { sendError } from "../utils/api-response";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): Response {
    if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode);
    }

    if (err instanceof ZodError) {
        const message = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
        return sendError(res, message || "Validation failed", 422);
    }

    console.error(err);
    return sendError(res, "Internal server error", 500);
}
