import { db } from "../../config/db";
import { Class, CreateClassPayload, UpdateClassPayload } from "./classes.types";

const CLASSES_TABLE = "classes";
const CLASS_COLUMNS = [
    "id",
    "name",
    "url",
    "class_date",
    "end_time",
    "end_date",
    "timezone",
    "is_active",
    "plan_ids",
    "created_at",
    "updated_at",
] as const;

export async function getClasses(planId?: number): Promise<Class[]> {
    const query = db<Class>(CLASSES_TABLE)
        .select([...CLASS_COLUMNS])
        .orderBy("class_date", "asc")
        .orderBy("id", "asc");

    if (planId !== undefined) {
        query.where({ is_active: true }).whereRaw("? = ANY(plan_ids)", [planId]);
    }

    return query;
}

export async function getClassById(id: number): Promise<Class | undefined> {
    return db<Class>(CLASSES_TABLE).select([...CLASS_COLUMNS]).where({ id }).first();
}

export async function createClass(payload: CreateClassPayload): Promise<Class> {
    const [createdClass] = await db<Class>(CLASSES_TABLE)
        .insert({
            ...payload,
            is_active: payload.is_active ?? true,
        })
        .returning([...CLASS_COLUMNS]);

    return createdClass as Class;
}

export async function updateClass(id: number, payload: UpdateClassPayload): Promise<Class | undefined> {
    const updates: Record<string, unknown> = {
        updated_at: db.fn.now(),
    };

    if (payload.url !== undefined) updates.url = payload.url;
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.class_date !== undefined) updates.class_date = payload.class_date;
    if (payload.end_time !== undefined) updates.end_time = payload.end_time;
    if (payload.end_date !== undefined) updates.end_date = payload.end_date;
    if (payload.timezone !== undefined) updates.timezone = payload.timezone;
    if (payload.is_active !== undefined) updates.is_active = payload.is_active;
    if (payload.plan_ids !== undefined) updates.plan_ids = payload.plan_ids;

    const [updatedClass] = await db<Class>(CLASSES_TABLE)
        .where({ id })
        .update(updates)
        .returning([...CLASS_COLUMNS]);

    return updatedClass as Class | undefined;
}

export async function deleteClass(id: number): Promise<boolean> {
    const deletedRows = await db<Class>(CLASSES_TABLE).where({ id }).delete();
    return deletedRows > 0;
}
