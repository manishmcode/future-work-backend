import { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { sendSuccess } from "../../common/utils/api-response";
import {
    assignPlanSchema,
    createPaymentSessionSchema,
    retryPaymentSessionSchema,
    validateIbanSchema,
    submitPaymentSchema,
    unsubscribeSchema,
    verifyPaymentSchema,
} from "./subscription.schemas";
import {
    assignPlanToUser,
    validateIbanForSession,
    submitPaymentForSession,
    verifyPaymentForSession,
    initiateCatalystPayment,
    initiateRetryPayment,
    getPaymentSessionStatus,
    getMyCurrentPlan,
    getMySubscriptionHistory,
    unsubscribePlan,
} from "./subscription.service";

export async function assignPlanController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = assignPlanSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await assignPlanToUser(userId, parsed.data.plan_id);
        sendSuccess(res, "Plan assigned successfully", result);
    } catch (error) {
        console.error("[subscription.assignPlan] Request failed", error);
        next(error);
    }
}

export async function retryPaymentSessionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) throw new AppError("Unauthorized", 401);
        const parsed = retryPaymentSessionSchema.safeParse(req.body);
        if (!parsed.success) throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        const result = await initiateRetryPayment(userId, parsed.data);
        sendSuccess(res, "Payment retry session created", result, 201);
    } catch (error) {
        next(error);
    }
}

export async function createPaymentSessionController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = createPaymentSessionSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        console.log("[subscription.createPaymentSession] Parsed payload", {
            user_id: userId,
            plan_id: parsed.data.plan_id ?? null,
            has_plan_id: parsed.data.plan_id !== undefined,
            plan_name: parsed.data.plan_name,
            amount: parsed.data.amount,
        });

        const result = await initiateCatalystPayment(userId, parsed.data);
        sendSuccess(res, "Payment session created", result, 201);
    } catch (error) {
        next(error);
    }
}

export async function submitPaymentController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = submitPaymentSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await submitPaymentForSession(userId, parsed.data);
        console.log(result, "[subscription.submitPayment] Payment submission result");
        sendSuccess(res, "Payment submitted", result);
    } catch (error) {
        next(error);
    }
}

export async function validateIbanController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const parsed = validateIbanSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const authReq = req as AuthRequest;
        const result = await validateIbanForSession(authReq.authUser?.userId ?? null, parsed.data);
        sendSuccess(res, "IBAN validation completed", result);
    } catch (error) {
        next(error);
    }
}

export async function verifyPaymentController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = verifyPaymentSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await verifyPaymentForSession(userId, parsed.data);
        sendSuccess(res, "Payment verification processed", result);
    } catch (error) {
        next(error);
    }
}

export async function getPaymentStatusController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const sessionToken = Array.isArray(req.params.sessionToken)
            ? req.params.sessionToken[0]
            : req.params.sessionToken;

        if (!sessionToken || !sessionToken.startsWith("ps_")) {
            throw new AppError("Invalid session token", 400);
        }

        const result = await getPaymentSessionStatus(userId, sessionToken);
        sendSuccess(res, "Payment status retrieved", result);
    } catch (error) {
        next(error);
    }
}

export async function getMyCurrentPlanController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const result = await getMyCurrentPlan(userId);
        sendSuccess(res, "Current plan fetched successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function getMySubscriptionHistoryController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const result = await getMySubscriptionHistory(userId);
        sendSuccess(res, "Subscription history fetched successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function unsubscribeController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const parsed = unsubscribeSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await unsubscribePlan(parsed.data as any);
        const msg = result.status === "contact_saved" ? "Contact request saved" : "Subscription cancelled successfully";
        sendSuccess(res, msg, result);
    } catch (error) {
        next(error);
    }
}

