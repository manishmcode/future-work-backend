import { Response } from "express";
import { ApiResponse } from "../types/api.types";

export function sendSuccess<T>(res: Response, message: string, data?: T, statusCode = 200): Response {
    const payload: ApiResponse<T> = {
        success: true,
        message,
        data,
    };

    return res.status(statusCode).json(payload);
}

export function sendError(res: Response, message: string, statusCode = 400): Response {
    const payload: ApiResponse<null> = {
        success: false,
        message,
    };

    return res.status(statusCode).json(payload);
}
