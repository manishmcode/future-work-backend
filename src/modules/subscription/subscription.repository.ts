import { randomUUID } from "node:crypto";
import { db } from "../../config/db";
import { Plan } from "../plans/plans.types";
import { User } from "../user/user.types";
import { AssignPlanResponse, Subscription } from "./subscription.types";

const SUBSCRIPTIONS_TABLE = "subscriptions";

export interface CreateSubscriptionData {
    user_id: number;
    plan_id?: number | null;
    plan_name: string;
    price: number;
    status: string;
    payment_status: string;
    payment_reference: string;
    starts_at: Date;
    ends_at: Date;
    currency?: string | null;
    billing_frequency?: string | null;
    catalyst_session_token?: string | null;
    catalyst_subscription_id?: string | null;
    catalyst_transaction_id?: string | null;
    iban_last4?: string | null;
}

export async function assignPlanRecords(user: User, plan: Plan): Promise<AssignPlanResponse> {
    return db.transaction(async (trx) => {
        const now = new Date();
        const endsAt = new Date(now);
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);

        await trx("users").where({ id: user.id }).update({
            plan_id: plan.id,
            updated_at: now,
        });

        for (const [metaKey, metaValue] of [
            ["plan_id", String(plan.id)],
            ["subscription_status", "active"],
        ] as const) {
            const existingMeta = await trx("user_meta")
                .select("umeta_id")
                .where({ user_id: user.id, meta_key: metaKey })
                .first<{ umeta_id: number }>();

            if (existingMeta) {
                await trx("user_meta")
                    .where({ umeta_id: existingMeta.umeta_id })
                    .update({ meta_value: metaValue });
            } else {
                await trx("user_meta").insert({
                    user_id: user.id,
                    meta_key: metaKey,
                    meta_value: metaValue,
                });
            }
        }

        let subscription = await trx<Subscription>(SUBSCRIPTIONS_TABLE)
            .where({ user_id: user.id, plan_id: plan.id, status: "active" })
            .where("ends_at", ">", now)
            .orderBy("created_at", "desc")
            .first();
        const reusedExistingSubscription = Boolean(subscription);

        if (!subscription) {
            await trx<Subscription>(SUBSCRIPTIONS_TABLE)
                .where({ user_id: user.id, status: "active" })
                .update({
                    status: "cancelled",
                    payment_status: "cancelled",
                    cancelled_at: now,
                    ends_at: now,
                    updated_at: now,
                });

            [subscription] = await trx<Subscription>(SUBSCRIPTIONS_TABLE)
                .insert({
                    user_id: user.id,
                    plan_id: plan.id,
                    plan_name: plan.name,
                    price: Number(plan.price),
                    status: "active",
                    payment_status: "active",
                    payment_reference: `manual_${user.id}_${randomUUID()}`,
                    starts_at: now,
                    ends_at: endsAt,
                    currency: "EUR",
                    billing_frequency: "MONTHLY",
                })
                .returning("*");
        }

        if (!subscription) {
            throw new Error("Unable to create subscription");
        }

        let paymentSession: { id: number } | undefined = await trx("payment_sessions")
            .select("id")
            .where({
                user_id: user.id,
                plan_id: plan.id,
                subscription_id: subscription.id,
                status: "COMPLETED",
            })
            .first<{ id: number }>();

        if (!paymentSession) {
            const insertedPaymentSessions = await trx("payment_sessions")
                .insert({
                    user_id: user.id,
                    session_token: `ps_manual_${randomUUID()}`,
                    plan_id: plan.id,
                    plan_name: plan.name,
                    amount: Number(plan.price),
                    currency: "EUR",
                    billing_type: "RECURRING",
                    billing_frequency: "MONTHLY",
                    status: "COMPLETED",
                    payment_url: null,
                    subscription_id: subscription.id,
                })
                .returning("id");
            paymentSession = insertedPaymentSessions[0] as { id: number } | undefined;
        }

        if (!paymentSession) {
            throw new Error("Unable to create payment session");
        }

        return {
            user_id: user.id,
            plan: {
                id: plan.id,
                name: plan.name,
                price: Number(plan.price),
            },
            subscription_id: subscription.id,
            payment_session_id: paymentSession.id,
            starts_at: subscription.starts_at,
            ends_at: subscription.ends_at,
            reused_existing_subscription: reusedExistingSubscription,
        };
    });
}

export async function createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    const [created] = await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .insert(data)
        .returning("*");

    return created as Subscription;
}

export async function findSubscriptionByPaymentReference(
    userId: number,
    paymentReference: string,
): Promise<Subscription | undefined> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ user_id: userId, payment_reference: paymentReference })
        .orderBy("created_at", "desc")
        .first();
}

export async function findSubscriptionById(userId: number, subscriptionId: number): Promise<Subscription | undefined> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE).where({ id: subscriptionId, user_id: userId }).first();
}

export async function findSubscriptionByCatalystSubscriptionId(
    catalystSubscriptionId: string,
): Promise<Subscription | undefined> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ catalyst_subscription_id: catalystSubscriptionId })
        .orderBy("created_at", "desc")
        .first();
}

export async function findSubscriptionByCatalystTransactionId(
    catalystTransactionId: string,
): Promise<Subscription | undefined> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ catalyst_transaction_id: catalystTransactionId })
        .orderBy("created_at", "desc")
        .first();
}

export async function activateSubscriptionById(id: number): Promise<void> {
    const now = new Date();

    await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ id })
        .update({
            status: "active",
            payment_status: "active",
            updated_at: now,
        });
}

export async function updateSubscriptionPaymentStatusById(id: number, paymentStatus: string): Promise<void> {
    await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ id })
        .update({
            payment_status: paymentStatus,
            updated_at: new Date(),
        });
}

export async function updateSubscriptionStatusById(id: number, status: string): Promise<void> {
    await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ id })
        .update({
            status,
            updated_at: new Date(),
        });
}

export async function updateSubscriptionStatusAndPaymentStatusById(
    id: number,
    status: string,
    paymentStatus: string,
): Promise<void> {
    await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ id })
        .update({
            status,
            payment_status: paymentStatus,
            updated_at: new Date(),
        });
}

export async function updateSubscriptionWithCatalystData(
    id: number,
    updates: Partial<Pick<Subscription, "catalyst_subscription_id" | "catalyst_transaction_id" | "iban_last4" | "currency" | "billing_frequency">>,
): Promise<void> {
    await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ id })
        .update({ ...updates, updated_at: new Date() });
}

export async function getLatestSubscriptionByUserId(userId: number): Promise<Subscription | undefined> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ user_id: userId })
        .orderBy("created_at", "desc")
        .first();
}

export async function listSubscriptionsByUserId(userId: number): Promise<Subscription[]> {
    return db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ user_id: userId })
        .orderBy("created_at", "desc");
}

export async function cancelActiveSubscriptionsByUserId(userId: number): Promise<number> {
    const now = new Date();

    const updatedRows = await db<Subscription>(SUBSCRIPTIONS_TABLE)
        .where({ user_id: userId, status: "active" })
        .update({
            status: "cancelled",
            payment_status: "cancelled",
            cancelled_at: now,
            ends_at: now,
            updated_at: now,
        })
        .returning("id");

    return updatedRows.length;
}
