import { db } from "../../config/db";
import { PublicUser, User, UserMetaRow } from "./user.types";

const USERS_TABLE = "users";
const USER_META_TABLE = "user_meta";

export async function findUserByEmail(email: string): Promise<User | undefined> {
    return db<User>(USERS_TABLE).where({ email }).first();
}

export async function findUserById(id: number): Promise<User | undefined> {
    return db<User>(USERS_TABLE).where({ id }).first();
}

export async function createUser(data: {
    name: string;
    email: string;
    password: string;
    plan_id: number | null;
}): Promise<PublicUser> {
    console.log("[user.repository] Creating user", {
        email: data.email,
        plan_id: data.plan_id,
    });

    const [createdUser] = await db<User>(USERS_TABLE)
        .insert(data)
        .returning(["id", "name", "email", "plan_id", "is_admin", "created_at", "updated_at"]);

    console.log("[user.repository] User insert returned", {
        user_id: createdUser?.id,
        plan_id: createdUser?.plan_id,
    });

    return createdUser as PublicUser;
}

export async function insertUserMeta(userId: number, userMeta: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(userMeta);

    if (!entries.length) {
        return;
    }

    const rows = entries.map(([meta_key, value]) => ({
        user_id: userId,
        meta_key,
        meta_value: typeof value === "string" ? value : JSON.stringify(value),
    }));

    await db(USER_META_TABLE).insert(rows);
}

export async function getUserMetaByUserId(userId: number): Promise<Record<string, unknown>> {
    const rows = await db<UserMetaRow>(USER_META_TABLE).where({ user_id: userId });

    const result: Record<string, unknown> = {};

    for (const row of rows) {
        if (!row.meta_key) {
            continue;
        }

        if (row.meta_value === null) {
            result[row.meta_key] = null;
            continue;
        }

        try {
            result[row.meta_key] = JSON.parse(row.meta_value);
        } catch {
            result[row.meta_key] = row.meta_value;
        }
    }

    return result;
}

export async function updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db<User>(USERS_TABLE)
        .where({ id: userId })
        .update({
            password: hashedPassword,
            updated_at: db.fn.now(),
        });
}

export async function updateUserPlanId(userId: number, planId: number | null): Promise<void> {
    console.log("[user.repository] Updating users.plan_id", {
        user_id: userId,
        plan_id: planId,
    });

    const updatedRows = await db<User>(USERS_TABLE)
        .where({ id: userId })
        .update({
            plan_id: planId,
            updated_at: db.fn.now(),
        })
        .returning(["id", "plan_id"]);

    console.log("[user.repository] users.plan_id update result", {
        updated_count: updatedRows.length,
        rows: updatedRows,
    });
}

export async function updateUserName(userId: number, name: string): Promise<void> {
    await db<User>(USERS_TABLE)
        .where({ id: userId })
        .update({
            name,
            updated_at: db.fn.now(),
        });
}

export async function updateUserCheckoutDetails(
    userId: number,
    data: {
        phone: string | null;
        address: string | null;
        city: string | null;
        postal_code: string | null;
        country: string | null;
        plan_id?: number | null;

    },
): Promise<void> {
    await db<User>(USERS_TABLE)
        .where({ id: userId })
        .update({
            ...data,
            updated_at: db.fn.now(),
        });
}

export async function upsertUserMetaKey(userId: number, metaKey: string, metaValue: string): Promise<void> {
    const existing = await db<UserMetaRow>(USER_META_TABLE)
        .where({ user_id: userId, meta_key: metaKey })
        .first();

    if (existing) {
        await db<UserMetaRow>(USER_META_TABLE)
            .where({ user_id: userId, meta_key: metaKey })
            .update({
                meta_value: metaValue,
            });
    } else {
        await db(USER_META_TABLE).insert({
            user_id: userId,
            meta_key: metaKey,
            meta_value: metaValue,
        });
    }
}
