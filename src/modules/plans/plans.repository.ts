import { db } from "../../config/db";
import { CreatePlanPayload, Plan, UpdatePlanPayload } from "./plans.types";

const PLANS_TABLE = "plans";

const PLAN_COLUMNS = ["id", "name", "price", "currency", "is_active", "description", "features"] as const;

export async function getPlans(): Promise<Plan[]> {
    return db<Plan>(PLANS_TABLE)
        .select([...PLAN_COLUMNS])
        .orderBy("price", "asc")
        .orderBy("id", "asc");
}

export async function getPlanById(id: number): Promise<Plan | undefined> {
    return db<Plan>(PLANS_TABLE)
        .select([...PLAN_COLUMNS])
        .where({ id })
        .first();
}

export async function createPlan(payload: CreatePlanPayload): Promise<Plan> {
    const [plan] = await db(PLANS_TABLE)
        .insert({
            name: payload.name,
            price: payload.price,
            currency: payload.currency ?? "EUR",
            is_active: payload.is_active ?? true,
            description: payload.description ?? null,
            features: JSON.stringify(payload.features ?? []),
        })
        .returning([...PLAN_COLUMNS]);

    return plan as Plan;
}

export async function updatePlan(id: number, payload: UpdatePlanPayload): Promise<Plan | undefined> {
    const updates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
        updates.name = payload.name;
    }

    if (payload.price !== undefined) {
        updates.price = payload.price;
    }

    if (payload.currency !== undefined) {
        updates.currency = payload.currency;
    }

    if (payload.is_active !== undefined) {
        updates.is_active = payload.is_active;
    }

    if (payload.description !== undefined) {
        updates.description = payload.description;
    }

    if (payload.features !== undefined) {
        updates.features = JSON.stringify(payload.features);
    }

    const [plan] = await db(PLANS_TABLE)
        .where({ id })
        .update(updates)
        .returning([...PLAN_COLUMNS]);

    return plan as Plan | undefined;
}
