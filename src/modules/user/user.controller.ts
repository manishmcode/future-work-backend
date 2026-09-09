import { NextFunction, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { sendSuccess } from "../../common/utils/api-response";
import { updateProfileSchema } from "./user.schemas";
import { getUserDashboard, updateUserProfile } from "./user.service";

export async function getUserDashboardController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const result = await getUserDashboard(userId);
        sendSuccess(res, "User dashboard data retrieved successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function updateUserProfileController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = updateProfileSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        await updateUserProfile(userId, parsed.data);
        sendSuccess(res, "Profile updated successfully", null, 200);
    } catch (error) {
        next(error);
    }
}
