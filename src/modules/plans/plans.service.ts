import { AppError } from "../../common/errors/app-error";
import {
    createPlan as createPlanRow,
    getPlanById,
    getPlans,
    updatePlan as updatePlanRow,
} from "./plans.repository";
import { CreatePlanPayload, Plan, UpdatePlanPayload } from "./plans.types";

export async function fetchPlans(): Promise<Plan[]> {
    return getPlans();
}

export async function createNewPlan(payload: CreatePlanPayload): Promise<Plan> {
    return createPlanRow(payload);
}

export async function editPlan(id: number, payload: UpdatePlanPayload): Promise<Plan> {
    const existingPlan = await getPlanById(id);

    if (!existingPlan) {
        throw new AppError("Plan not found", 404);
    }

    const updatedPlan = await updatePlanRow(id, payload);

    if (!updatedPlan) {
        throw new AppError("Plan not found", 404);
    }

    return updatedPlan;
}
