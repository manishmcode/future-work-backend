import { AppError } from "../../common/errors/app-error";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env";
import { getPlanById } from "../plans/plans.repository";
import { findUserById } from "../user/user.repository";
import {
    createClass as createClassRow,
    deleteClass as deleteClassRow,
    getClassById,
    getClasses,
    updateClass as updateClassRow,
} from "./classes.repository";
import { Class, CreateClassPayload, LearnerClass, UpdateClassPayload } from "./classes.types";

const JOIN_TOKEN_TTL_SECONDS = 60;

async function ensurePlansExist(planIds: number[]): Promise<void> {
    const uniquePlanIds = [...new Set(planIds)];
    const plans = await Promise.all(uniquePlanIds.map((planId) => getPlanById(planId)));
    if (plans.some((plan) => !plan)) throw new AppError("One or more plans were not found", 404);
}

function validateEndTime(payload: UpdateClassPayload, existing?: Class): void {
    const classDate = payload.class_date ?? existing?.class_date;
    const endDate = payload.end_date ?? existing?.end_date;
    if (!classDate || !endDate) return;

    if (endDate.getTime() <= classDate.getTime()) {
        throw new AppError("End time must be after the live class start time", 422);
    }
}

function validateTimezone(timezone: string): void {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
        throw new AppError("Timezone must be a valid IANA timezone", 422);
    }
}

export async function fetchClasses(userId: number, isAdmin: boolean): Promise<Array<Class | LearnerClass>> {
    if (isAdmin) return getClasses();

    const user = await findUserById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (user.plan_id === null) return [];

    const classes = await getClasses(user.plan_id);
    return classes.map(({ url: _url, ...classSession }) => classSession);
}

async function getJoinableClass(userId: number, classId: number): Promise<Class> {
    const [user, classSession] = await Promise.all([
        findUserById(userId),
        getClassById(classId),
    ]);

    if (!user) throw new AppError("User not found", 404);
    if (!classSession || !classSession.is_active) throw new AppError("Live class not found", 404);
    if (user.plan_id === null || !classSession.plan_ids.includes(user.plan_id)) {
        throw new AppError("Your subscription plan does not include this live class", 403);
    }

    const now = Date.now();
    if (now < classSession.class_date.getTime()) {
        throw new AppError("This live class has not started yet", 403);
    }
    if (now > classSession.end_date.getTime()) {
        throw new AppError("This live class has ended", 410);
    }

    return classSession;
}

export async function createClassJoinToken(userId: number, classId: number): Promise<{ token: string; expiresIn: number }> {
    await getJoinableClass(userId, classId);
    const token = jwt.sign(
        { sub: userId, class_id: classId, purpose: "class_join" },
        env.JWT_SECRET,
        { expiresIn: JOIN_TOKEN_TTL_SECONDS },
    );
    return { token, expiresIn: JOIN_TOKEN_TTL_SECONDS };
}

export async function resolveClassJoinToken(classId: number, token: string): Promise<string> {
    let decoded: string | JwtPayload;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        throw new AppError("This class join link has expired", 401);
    }

    if (
        typeof decoded === "string"
        || decoded.purpose !== "class_join"
        || Number(decoded.class_id) !== classId
        || !Number.isInteger(Number(decoded.sub))
    ) {
        throw new AppError("Invalid class join link", 401);
    }

    const classSession = await getJoinableClass(Number(decoded.sub), classId);
    return classSession.url;
}

export async function createNewClass(payload: CreateClassPayload): Promise<Class> {
    await ensurePlansExist(payload.plan_ids);
    validateTimezone(payload.timezone);
    validateEndTime(payload);
    return createClassRow(payload);
}

export async function editClass(id: number, payload: UpdateClassPayload): Promise<Class> {
    const existing = await getClassById(id);
    if (!existing) throw new AppError("Class not found", 404);

    if (payload.plan_ids !== undefined) await ensurePlansExist(payload.plan_ids);
    if (payload.timezone !== undefined) validateTimezone(payload.timezone);
    validateEndTime(payload, existing);
    const updatedClass = await updateClassRow(id, payload);
    if (!updatedClass) throw new AppError("Class not found", 404);
    return updatedClass;
}

export async function removeClass(id: number): Promise<void> {
    const deleted = await deleteClassRow(id);
    if (!deleted) throw new AppError("Class not found", 404);
}
