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
    authToken?: string;
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;

    for (const cookie of cookieHeader.split(";")) {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) continue;

        const cookieName = cookie.slice(0, separatorIndex).trim();
        if (cookieName !== name) continue;

        return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    }

    return null;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response | void {
    const authHeader = req.headers.authorization;
    const cookieToken = getCookieValue(req.headers.cookie, "bgp_auth_token");

    if ((!authHeader || !authHeader.startsWith("Bearer ")) && !cookieToken) {
        return sendError(res, "Authorization token is missing", 401);
    }

    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    if (!token) {
        return sendError(res, "Authorization token is missing", 401);
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);

        if (typeof decoded === "string") {
            return sendError(res, "Invalid authorization token", 401);
        }

        const payload = decoded as JwtPayload & { sub?: string | number; email?: string; is_admin?: boolean };
        const userId = Number(payload.sub);

        if (!Number.isInteger(userId) || userId <= 0) {
            return sendError(res, "Invalid user ID in token", 401);
        }

        req.authUser = {
            userId,
            email: payload.email,
            isAdmin: payload.is_admin === true,
        };
        req.authToken = token;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return sendError(res, "JWT expired", 401);
        }
        return sendError(res, "Invalid authorization token", 401);
    }
}

export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);

            if (typeof decoded !== "string") {
                const payload = decoded as JwtPayload & { sub?: string | number; email?: string; is_admin?: boolean };
                const userId = Number(payload.sub);

                if (Number.isInteger(userId) && userId > 0) {
                    req.authUser = {
                        userId,
                        email: payload.email,
                        isAdmin: payload.is_admin === true,
                    };
                }
            }
        } catch {
            // Ignore invalid/expired token for optional auth
        }
    }

    next();
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): Response | void {
    if (!req.authUser?.isAdmin) {
        return sendError(res, "Admin access is required", 403);
    }

    next();
}
