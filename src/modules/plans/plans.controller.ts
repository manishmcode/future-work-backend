import { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/api-response";
import { createPlanSchema, planIdParamSchema, updatePlanSchema } from "./plans.schemas";
import { createNewPlan, editPlan, fetchPlans } from "./plans.service";

export async function getPlansController(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await fetchPlans();
        sendSuccess(res, "Plans retrieved successfully", result);
    } catch (error) {
        next(error);
    }
}

export async function createPlanController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = createPlanSchema.safeParse(req.body);

        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await createNewPlan(parsed.data);
        sendSuccess(res, "Plan created successfully", result, 201);
    } catch (error) {
        next(error);
    }
}

export async function updatePlanController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsedParams = planIdParamSchema.safeParse(req.params);

        if (!parsedParams.success) {
            throw new AppError(parsedParams.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const parsedBody = updatePlanSchema.safeParse(req.body);

        if (!parsedBody.success) {
            throw new AppError(parsedBody.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const result = await editPlan(parsedParams.data.id, parsedBody.data);
        sendSuccess(res, "Plan updated successfully", result);
    } catch (error) {
        next(error);
    }
}
