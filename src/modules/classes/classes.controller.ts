import { NextFunction, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { sendSuccess } from "../../common/utils/api-response";
import { classIdParamSchema, createClassSchema, updateClassSchema } from "./classes.schemas";
import {
    createClassJoinToken,
    createNewClass,
    editClass,
    fetchClasses,
    removeClass,
    resolveClassJoinToken,
} from "./classes.service";

function parseClassId(params: unknown): number {
    const parsed = classIdParamSchema.safeParse(params);
    if (!parsed.success) throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
    return parsed.data.id;
}

export async function getClassesController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const authUser = req.authUser;
        if (!authUser) throw new AppError("Unauthorized", 401);

        const result = await fetchClasses(authUser.userId, authUser.isAdmin);
        sendSuccess(res, "Classes retrieved successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function createClassJoinController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const authUser = req.authUser;
        if (!authUser) throw new AppError("Unauthorized", 401);

        const id = parseClassId(req.params);
        const result = await createClassJoinToken(authUser.userId, id);
        res.setHeader("Cache-Control", "no-store");
        sendSuccess(res, "Class join access granted", {
            join_path: `/classes/${id}/join/${encodeURIComponent(result.token)}`,
            expires_in: result.expiresIn,
        });
    } catch (error) {
        next(error);
    }
}

export async function redirectClassJoinController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseClassId(req.params);
        const token = req.params.token;
        if (typeof token !== "string" || token.length === 0) throw new AppError("Invalid class join link", 401);

        const classUrl = await resolveClassJoinToken(id, token);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.redirect(302, classUrl);
    } catch (error) {
        next(error);
    }
}

export async function createClassController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = createClassSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);

        const result = await createNewClass(parsed.data);
        sendSuccess(res, "Class created successfully", result, 201);
    } catch (error) {
        next(error);
    }
}

export async function updateClassController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseClassId(req.params);
        const parsed = updateClassSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);

        const result = await editClass(id, parsed.data);
        sendSuccess(res, "Class updated successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function deleteClassController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        await removeClass(parseClassId(req.params));
        sendSuccess(res, "Class deleted successfully", null);
    } catch (error) {
        next(error);
    }
}
