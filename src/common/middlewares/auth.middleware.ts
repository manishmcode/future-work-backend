import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env";
import { sendError } from "../utils/api-response";

export interface AuthUser {
    userId: number;
    email?: string | undefined;
    isAdmin: boolean;
}

export interface AuthRequest extends Request {
    authUser?: AuthUser;
}

function parseAuthUser(authHeader?: string): AuthUser | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);

        if (typeof decoded === "string") {
            return null;
        }

        const payload = decoded as JwtPayload & { sub?: string | number; email?: string; is_admin?: boolean };
        const userId = Number(payload.sub);

        if (!Number.isInteger(userId) || userId <= 0) {
            return null;
        }

        return {
            userId,
            email: payload.email,
            isAdmin: payload.is_admin === true,
        };
    } catch {
        return null;
    }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response | void {
    if (!req.authUser?.isAdmin) {
        return sendError(res, "Admin access is required", 403);
    }

    next();
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response | void {
    const authUser = parseAuthUser(req.headers.authorization);

    if (!authUser) {
        return sendError(res, "Authorization token is missing", 401);
    }

    req.authUser = authUser;
    next();
}

export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
    const authUser = parseAuthUser(req.headers.authorization);

    if (authUser) {
        req.authUser = authUser;
    }

    next();
}
