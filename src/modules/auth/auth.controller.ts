import { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { sendSuccess } from "../../common/utils/api-response";
import { changePasswordSchema, loginSchema, signupSchema } from "./auth.schemas";
import { changePassword, login, signup } from "./auth.service";
import { findUserById, getUserMetaByUserId } from "../user/user.repository";

export async function signupController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = signupSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        console.log("[auth.signup] Parsed signup payload", {
            email: parsed.data.email,
            plan_id: parsed.data.plan_id ?? null,
            has_plan_id: parsed.data.plan_id !== undefined,
        });

        const result = await signup(parsed.data);
        sendSuccess(res, "Signup successful", result, 201);
    } catch (error) {
        next(error);
    }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = loginSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await login(parsed.data);
        sendSuccess(res, "Login successful", result, 200);
    } catch (error) {
        next(error);
    }
}

export async function changePasswordController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = changePasswordSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        await changePassword(userId, parsed.data);
        sendSuccess(res, "Password changed successfully", null, 200);
    } catch (error) {
        next(error);
    }
}

export async function getMeController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const user = await findUserById(userId);

        if (!user) {
            throw new AppError("User not found", 404);
        }

        const userMeta = await getUserMetaByUserId(user.id);

        sendSuccess(res, "Authenticated user retrieved", {
            id: user.id,
            name: user.name,
            email: user.email,
            plan_id: user.plan_id,
            is_admin: user.is_admin,
            user_meta: userMeta,
            created_at: user.created_at,
            updated_at: user.updated_at,
        });
    } catch (error) {
        next(error);
    }
}
