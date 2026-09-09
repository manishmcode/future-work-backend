import { db } from "../../config/db";

const TABLE = "contact_us";

export async function insertContactUs(data: {
    email: string;
    message?: string | null;
    options?: Record<string, unknown> | null;
}) {
    const [row] = await db(TABLE)
        .insert({
            email: data.email,
            message: data.message ?? null,
            options: data.options ?? null,
        })
        .returning(["id", "email", "message", "options", "created_at", "updated_at"]);

    return row;
}
