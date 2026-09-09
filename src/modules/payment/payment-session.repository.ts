import { db } from "../../config/db";

const TABLE = "payment_sessions";

export interface PaymentSession {
    id: number;
    user_id: number;
    session_token: string;
    plan_id: number | null;
    plan_name: string;
    amount: string | number;
    currency: string;
    billing_type: string;
    billing_frequency: string;
    status: string;
    payment_url: string | null;
    catalyst_order_id: string | null;
    catalyst_order_number: string | null;
    catalyst_subscription_id: string | null;
    catalyst_transaction_id: string | null;
    iban_last4: string | null;
    webhook_payload: Record<string, unknown> | null;
    subscription_id: number | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreatePaymentSessionData {
    user_id: number;
    session_token: string;
    plan_id: number | null;
    plan_name: string;
    amount: number;
    currency: string;
    billing_type: string;
    billing_frequency: string;
    payment_url: string | null;
    subscription_id?: number | null;
}

export async function insertPaymentSession(data: CreatePaymentSessionData): Promise<PaymentSession> {
    const [row] = await db<PaymentSession>(TABLE).insert(data).returning("*");
    return row as PaymentSession;
}

export async function findPaymentSessionByToken(sessionToken: string): Promise<PaymentSession | undefined> {
    return db<PaymentSession>(TABLE).where({ session_token: sessionToken }).first();
}

export async function findPaymentSessionByTokenAndUser(
    sessionToken: string,
    userId: number,
): Promise<PaymentSession | undefined> {
    return db<PaymentSession>(TABLE).where({ session_token: sessionToken, user_id: userId }).first();
}

export async function findPaymentSessionByCatalystSubscriptionId(
    catalystSubscriptionId: string,
): Promise<PaymentSession | undefined> {
    return db<PaymentSession>(TABLE)
        .where({ catalyst_subscription_id: catalystSubscriptionId })
        .orderBy("created_at", "desc")
        .first();
}

export async function findPaymentSessionByCatalystTransactionId(
    catalystTransactionId: string,
): Promise<PaymentSession | undefined> {
    return db<PaymentSession>(TABLE)
        .where({ catalyst_transaction_id: catalystTransactionId })
        .orderBy("created_at", "desc")
        .first();
}

export async function updatePaymentSessionStatus(
    sessionToken: string,
    updates: Partial<Pick<PaymentSession, "status" | "catalyst_order_id" | "catalyst_order_number" | "catalyst_subscription_id" | "catalyst_transaction_id" | "iban_last4" | "webhook_payload" | "subscription_id">>,
): Promise<void> {
    await db<PaymentSession>(TABLE)
        .where({ session_token: sessionToken })
        .update({ ...updates, updated_at: new Date() });
}
