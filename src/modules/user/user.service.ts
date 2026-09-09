import { db } from "../../config/db";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { Subscription } from "../subscription/subscription.types";
import { findUserById, getUserMetaByUserId, updateUserName, upsertUserMetaKey } from "./user.repository";
import { UpdateProfilePayload } from "./user.types";

interface PaymentData {
    payment_id: string;
    date: Date;
    status: string;
    price: number;
}

interface UserDashboardResponse {
    firstname: string;
    lastname: string;
    email: string;
    plan_id: number | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    user_meta: Record<string, unknown>;
    payments: PaymentData[];
    subscriptions: Subscription[];
}

export async function getUserDashboard(userId: number): Promise<UserDashboardResponse> {
    const user = await findUserById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const subscriptions = await db<Subscription>("subscriptions")
        .where({ user_id: userId })
        .orderBy("created_at", "desc");

    const userMeta = await getUserMetaByUserId(userId);

    const payments: PaymentData[] = subscriptions.map((sub) => ({
        payment_id: sub.payment_reference,
        date: sub.created_at,
        status: sub.payment_status,
        price: Number(sub.price),
    }));

    // Split name into firstname/lastname (simple split by space)
    const nameParts = user.name.trim().split(" ");
    const firstname = nameParts[0] || "";
    const lastname = nameParts.slice(1).join(" ") || "";

    return {
        firstname,
        lastname,
        email: user.email,
        plan_id: user.plan_id,
        phone: user.phone,
        address: user.address,
        city: user.city,
        postal_code: user.postal_code,
        country: user.country,
        user_meta: userMeta,
        payments,
        subscriptions: subscriptions.map((sub) => ({
            ...sub,
            price: Number(sub.price),
        })),
    };
}

export async function updateUserProfile(userId: number, payload: UpdateProfilePayload): Promise<void> {
    const user = await findUserById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const fullName = `${payload.firstname} ${payload.lastname}`.trim();
    await updateUserName(userId, fullName);

    await upsertUserMetaKey(userId, "display_name", payload.display_name);
}
