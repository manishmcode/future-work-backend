import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../../config/env";
import { verifyWebhookSignature } from "./catalyst.service";
import {
    findPaymentSessionByCatalystSubscriptionId,
    findPaymentSessionByCatalystTransactionId,
    findPaymentSessionByToken,
    updatePaymentSessionStatus,
} from "./payment-session.repository";
import {
    activateSubscriptionById,
    createSubscription,
    findSubscriptionByCatalystSubscriptionId,
    findSubscriptionByCatalystTransactionId,
    findSubscriptionByPaymentReference,
    updateSubscriptionPaymentStatusById,
    updateSubscriptionStatusAndPaymentStatusById,
} from "../subscription/subscription.repository";
import { createUser, findUserByEmail, updateUserPlanId } from "../user/user.repository";
import { getPlans } from "../plans/plans.repository";

const ORDER_WEBHOOK_BILLING_FREQUENCY = "MONTHLY";

const ORDER_AMOUNT_PLAN_MAP: Record<number, { name: string; fallbackPlanId: number }> = {
    29: { name: "Basic", fallbackPlanId: 1 },
    59: { name: "Standard", fallbackPlanId: 3 },
    99: { name: "Premium", fallbackPlanId: 2 },
};

function generateWebhookUserPassword(): string {
    return crypto.randomBytes(12).toString("base64url");
}

function getSessionTokenFromPayload(payload: Record<string, unknown>): string | null {
    return (
        (payload.session_token as string | undefined) ??
        ((payload.session as Record<string, unknown> | undefined)?.token as string | undefined) ??
        null
    );
}

function getTenantReferenceSessionToken(payload: Record<string, unknown>): string | null {
    const txBlock = payload.transaction as Record<string, unknown> | undefined;
    const tenantRef =
        (txBlock?.tenant_reference_id as string | undefined) ??
        (payload.tenant_reference_id as string | undefined);

    if (!tenantRef || !tenantRef.startsWith("future-work-")) {
        return null;
    }

    // format: future-work-<userId>-<sessionToken>
    const parts = tenantRef.split("-");
    if (parts.length < 3) {
        return null;
    }

    return parts.slice(2).join("-") || null;
}

function getStringValue(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = payload[key];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function getNumberValue(payload: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
        const value = payload[key];

        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim()) {
            const parsed = Number(value.trim());

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return null;
}

function getOrderCustomer(payload: Record<string, unknown>): Record<string, unknown> {
    const customer = payload.customer as Record<string, unknown> | undefined;
    const billing = payload.billing as Record<string, unknown> | undefined;
    const order = payload.order as Record<string, unknown> | undefined;
    const orderCustomer = order?.customer as Record<string, unknown> | undefined;

    return {
        ...payload,
        ...(billing ?? {}),
        ...(customer ?? {}),
        ...(orderCustomer ?? {}),
    };
}

async function createUserFromOrderWebhook(payload: Record<string, unknown>): Promise<void> {
    const customer = getOrderCustomer(payload);
    const email = getStringValue(customer, ["Email", "email", "customer_email"]);
    const name =
        getStringValue(customer, ["Name", "name", "customer_name", "full_name"]) ??
        email?.split("@")[0] ??
        null;

    if (!name || !email) {
        console.warn("[webhook] order webhook missing Name/name or Email/email, skipping user create", {
            has_name: Boolean(name),
            has_email: Boolean(email),
        });
        return;
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    let userId = existingUser?.id ?? null;

    if (existingUser) {
        console.log("[webhook] User already exists for order webhook email, skipping create", {
            user_id: existingUser.id,
            email: normalizedEmail,
        });
    } else {
        const randomPassword = generateWebhookUserPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const createdUser = await createUser({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            plan_id: null,
        });
        userId = createdUser.id;

        console.log("[webhook] Created user from order webhook", {
            user_id: createdUser.id,
            email: createdUser.email,
        });
    }

    if (userId === null) {
        console.warn("[webhook] order webhook user id unavailable, skipping subscription create", {
            email: normalizedEmail,
        });
        return;
    }

    await createSubscriptionFromOrderWebhook(userId, normalizedEmail, customer);
}

async function getOrderWebhookPlan(amount: number): Promise<{ planId: number; planName: string } | null> {
    const planConfig = ORDER_AMOUNT_PLAN_MAP[amount];

    if (!planConfig) {
        return null;
    }

    const plans = await getPlans();
    const matchedPlan = plans.find((plan) => plan.name === planConfig.name || Number(plan.price) === amount);

    return {
        planId: matchedPlan?.id ?? planConfig.fallbackPlanId,
        planName: planConfig.name,
    };
}

function getOrderWebhookPaymentReference(payload: Record<string, unknown>, email: string, amount: number): string {
    const reference = getStringValue(payload, [
        "order_id",
        "OrderId",
        "order_number",
        "OrderNumber",
        "payment_reference",
        "PaymentReference",
    ]);

    return reference ?? `order-webhook-${email}-${amount}`;
}

async function createSubscriptionFromOrderWebhook(
    userId: number,
    email: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const amount = getNumberValue(payload, ["Amount", "amount", "price", "Price"]);

    if (amount === null) {
        console.warn("[webhook] order webhook missing Amount/amount, skipping subscription create", {
            user_id: userId,
            email,
        });
        return;
    }

    const plan = await getOrderWebhookPlan(amount);

    if (!plan) {
        console.warn("[webhook] order webhook amount does not match a known plan, skipping subscription create", {
            user_id: userId,
            email,
            amount,
        });
        return;
    }

    const paymentReference = getOrderWebhookPaymentReference(payload, email, amount);
    const existingSubscription = await findSubscriptionByPaymentReference(userId, paymentReference);

    if (existingSubscription) {
        await updateUserPlanId(userId, plan.planId);
        console.log("[webhook] Subscription already exists for order webhook, skipping create", {
            user_id: userId,
            subscription_id: existingSubscription.id,
            payment_reference: paymentReference,
        });
        return;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);

    const currency = getStringValue(payload, ["Currency", "currency"]) ?? null;

    const created = await createSubscription({
        user_id: userId,
        plan_name: plan.planName,
        price: amount,
        status: "pending_activation",
        payment_status: "active",
        payment_reference: paymentReference,
        starts_at: startsAt,
        ends_at: endsAt,
        currency,
        billing_frequency: ORDER_WEBHOOK_BILLING_FREQUENCY,
    });

    await updateUserPlanId(userId, plan.planId);

    console.log("[webhook] Created subscription from order webhook", {
        user_id: userId,
        subscription_id: created.id,
        plan_id: plan.planId,
        plan_name: plan.planName,
        amount,
        currency,
    });
}

function getRawBodyAndPayload(req: Request): { rawBody: Buffer; payload: Record<string, unknown> } | null {
    const body = req.body as unknown;

    if (Buffer.isBuffer(body)) {
        if (body.length === 0) {
            return null;
        }

        const payload = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
        return { rawBody: body, payload };
    }

    if (typeof body === "string") {
        if (!body.trim()) {
            return null;
        }

        const payload = JSON.parse(body) as Record<string, unknown>;
        return { rawBody: Buffer.from(body, "utf8"), payload };
    }

    if (body && typeof body === "object") {
        const payload = body as Record<string, unknown>;
        return { rawBody: Buffer.from(JSON.stringify(payload), "utf8"), payload };
    }

    return null;
}

async function ensureSubscriptionFromPaymentSession(
    sessionToken: string,
    payload: Record<string, unknown>,
    shouldActivate: boolean,
): Promise<void> {
    const paymentSession = await findPaymentSessionByToken(sessionToken);

    if (!paymentSession) {
        console.warn(`[webhook] No payment_session found for token ${sessionToken}`);
        return;
    }

    const subBlock = payload.subscription as Record<string, unknown> | undefined;
    const txBlock = payload.transaction as Record<string, unknown> | undefined;
    const pmBlock = payload.payment_method as Record<string, unknown> | undefined;
    const orderBlock = payload.order as Record<string, unknown> | undefined;

    const catalystSubscriptionId = (subBlock?.id as string) ?? paymentSession.catalyst_subscription_id;
    const catalystTransactionId = (txBlock?.id as string) ?? paymentSession.catalyst_transaction_id;
    const ibanLast4 = (pmBlock?.iban_last4 as string) ?? paymentSession.iban_last4;
    const catalystOrderId = (orderBlock?.id as string) ?? (payload.order_id as string) ?? paymentSession.catalyst_order_id;
    const catalystOrderNumber =
        (orderBlock?.order_number as string) ?? (payload.order_number as string) ?? paymentSession.catalyst_order_number;

    let subscriptionId = paymentSession.subscription_id;

    if (subscriptionId === null) {
        const existing = await findSubscriptionByPaymentReference(paymentSession.user_id, sessionToken);

        if (existing) {
            subscriptionId = existing.id;
            if (shouldActivate && existing.status !== "active") {
                await activateSubscriptionById(existing.id);
            }
        } else {
            const startsAt = new Date();
            const endsAt = new Date(startsAt);
            endsAt.setMonth(endsAt.getMonth() + 1);

            const created = await createSubscription({
                user_id: paymentSession.user_id,
                plan_name: paymentSession.plan_name,
                price: Number(paymentSession.amount),
                status: shouldActivate ? "active" : "pending_activation",
                payment_status: shouldActivate ? "active" : "pending",
                payment_reference: sessionToken,
                starts_at: startsAt,
                ends_at: endsAt,
                currency: paymentSession.currency,
                billing_frequency: paymentSession.billing_frequency,
                catalyst_session_token: sessionToken,
                catalyst_subscription_id: catalystSubscriptionId,
                catalyst_transaction_id: catalystTransactionId,
                iban_last4: ibanLast4,
            });

            subscriptionId = created.id;
        }
    }

    await updatePaymentSessionStatus(sessionToken, {
        status: "COMPLETED",
        catalyst_order_id: catalystOrderId,
        catalyst_order_number: catalystOrderNumber,
        catalyst_subscription_id: catalystSubscriptionId,
        catalyst_transaction_id: catalystTransactionId,
        iban_last4: ibanLast4,
        webhook_payload: payload,
        subscription_id: subscriptionId,
    });

    if (shouldActivate && paymentSession.plan_id !== null) {
        console.log("[webhook] Saving plan_id to user from activated payment session", {
            user_id: paymentSession.user_id,
            plan_id: paymentSession.plan_id,
            session_token: paymentSession.session_token,
        });
        await updateUserPlanId(paymentSession.user_id, paymentSession.plan_id);
    } else if (shouldActivate) {
        console.log("[webhook] Activated payment session has no plan_id, users.plan_id not updated", {
            user_id: paymentSession.user_id,
            session_token: paymentSession.session_token,
        });
    }

    console.log(`[webhook] Updated payment_sessions for session ${sessionToken} to COMPLETED`);
}

async function processPaymentSessionCompleted(payload: Record<string, unknown>): Promise<void> {
    const sessionToken = getSessionTokenFromPayload(payload);

    if (!sessionToken) {
        console.warn("[webhook] payment_session.completed without session_token – skipping");
        return;
    }

    await ensureSubscriptionFromPaymentSession(sessionToken, payload, false);
}

async function processSubscriptionStatusChanged(payload: Record<string, unknown>): Promise<void> {
    const subBlock = payload.subscription as Record<string, unknown> | undefined;
    const catalystSubscriptionId =
        (subBlock?.id as string | undefined) ??
        (payload.catalyst_subscription_id as string | undefined) ??
        (payload.subscription_id as string | undefined) ??
        null;

    const rawStatus =
        (subBlock?.status as string | undefined) ??
        (payload.status as string | undefined) ??
        "";

    const status = rawStatus.toUpperCase();

    if (!catalystSubscriptionId) {
        return;
    }

    if (status !== "ACTIVE" && status !== "COMPLETED" && status !== "FAILED") {
        return;
    }

    const knownSubscription = await findSubscriptionByCatalystSubscriptionId(catalystSubscriptionId);

    if (knownSubscription) {
        if (status === "FAILED") {
            await updateSubscriptionStatusAndPaymentStatusById(knownSubscription.id, "failed", "failed");
            console.log(
                `[webhook] Updated subscriptions.id=${knownSubscription.id} to status=failed payment_status=failed via catalyst_subscription_id=${catalystSubscriptionId}`,
            );
        } else {
            await activateSubscriptionById(knownSubscription.id);
            console.log(
                `[webhook] Updated subscriptions.id=${knownSubscription.id} to status=active payment_status=active via catalyst_subscription_id=${catalystSubscriptionId}`,
            );
        }
    }

    const paymentSession = await findPaymentSessionByCatalystSubscriptionId(catalystSubscriptionId);

    if (paymentSession) {
        if (status === "FAILED") {
            await updatePaymentSessionStatus(paymentSession.session_token, {
                status: "FAILED",
                webhook_payload: payload,
            });
            console.log(
                `[webhook] Updated payment_sessions for session ${paymentSession.session_token} to FAILED via catalyst_subscription_id=${catalystSubscriptionId}`,
            );
        } else {
            await ensureSubscriptionFromPaymentSession(paymentSession.session_token, payload, true);
        }
    }
}

async function processTransactionStatusChanged(payload: Record<string, unknown>): Promise<void> {
    const txBlock = payload.transaction as Record<string, unknown> | undefined;
    const txStatus =
        (txBlock?.status as string | undefined) ??
        (payload.status as string | undefined) ??
        "";
    const normalizedTxStatus = txStatus.toLowerCase();

    const txId =
        (txBlock?.id as string | undefined) ??
        (payload.catalyst_transaction_id as string | undefined) ??
        (payload.transaction_id as string | undefined) ??
        null;

    if (txId) {
        const byTx = await findPaymentSessionByCatalystTransactionId(txId);
        if (byTx) {
            if (normalizedTxStatus === "approved") {
                await updatePaymentSessionStatus(byTx.session_token, {
                    status: "APPROVED",
                    catalyst_transaction_id: txId,
                    webhook_payload: payload,
                });
                console.log(
                    `[webhook] Updated payment_sessions for session ${byTx.session_token} to APPROVED via catalyst_transaction_id=${txId}`,
                );

                const linkedSubscription =
                    byTx.subscription_id !== null
                        ? await findSubscriptionByPaymentReference(byTx.user_id, byTx.session_token)
                        : await findSubscriptionByCatalystTransactionId(txId);

                if (linkedSubscription) {
                    await updateSubscriptionPaymentStatusById(linkedSubscription.id, "approved");
                    console.log(
                        `[webhook] Updated subscriptions.id=${linkedSubscription.id} payment_status=approved via catalyst_transaction_id=${txId}`,
                    );
                }

                await ensureSubscriptionFromPaymentSession(byTx.session_token, payload, true);
            } else if (normalizedTxStatus === "declined" || normalizedTxStatus === "failed") {
                await updatePaymentSessionStatus(byTx.session_token, {
                    status: "FAILED",
                    catalyst_transaction_id: txId,
                    webhook_payload: payload,
                });
                console.log(
                    `[webhook] Updated payment_sessions for session ${byTx.session_token} to FAILED via catalyst_transaction_id=${txId}`,
                );

                const linkedSubscription =
                    byTx.subscription_id !== null
                        ? await findSubscriptionByPaymentReference(byTx.user_id, byTx.session_token)
                        : await findSubscriptionByCatalystTransactionId(txId);

                if (linkedSubscription) {
                    await updateSubscriptionStatusAndPaymentStatusById(linkedSubscription.id, "failed", "failed");
                    console.log(
                        `[webhook] Updated subscriptions.id=${linkedSubscription.id} to status=failed payment_status=failed via catalyst_transaction_id=${txId}`,
                    );
                }
            }
            return;
        }
    }

    if (normalizedTxStatus !== "approved") {
        return;
    }

    const fromTenantRef = getTenantReferenceSessionToken(payload);
    if (fromTenantRef) {
        await ensureSubscriptionFromPaymentSession(fromTenantRef, payload, true);
    }
}

async function processWebhookEvent(eventType: string, payload: Record<string, unknown>, routePath: string): Promise<void> {
    if (
        eventType === "order.created" ||
        eventType === "order_created" ||
        eventType === "commerce.order.created" ||
        routePath.endsWith("/order-created")
    ) {
        await createUserFromOrderWebhook(payload);
        return;
    }

    if (
        eventType === "order.status_changed" ||
        eventType === "order_status_changed" ||
        eventType === "commerce.order.status_changed" ||
        routePath.endsWith("/order-status-change")
    ) {
        await createUserFromOrderWebhook(payload);
        return;
    }

    if (eventType === "payment_session.completed") {
        await processPaymentSessionCompleted(payload);
        return;
    }

    if (eventType === "subscription.status_changed") {
        await processSubscriptionStatusChanged(payload);
        return;
    }

    if (eventType === "transaction.status_changed") {
        await processTransactionStatusChanged(payload);
        return;
    }
}

export async function catalystWebhookController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        console.log("[webhook] Incoming Catalyst webhook request");

        let parsedBody: { rawBody: Buffer; payload: Record<string, unknown> } | null;
        try {
            parsedBody = getRawBodyAndPayload(req);
        } catch {
            console.warn("[webhook] Failed to parse JSON body");
            res.status(400).json({ success: false, message: "Invalid JSON body" });
            return;
        }

        if (!parsedBody) {
            console.warn("[webhook] Empty or invalid body received", {
                body_type: typeof req.body,
                is_buffer: Buffer.isBuffer(req.body),
            });
            res.status(400).json({ success: false, message: "Empty or invalid body" });
            return;
        }

        const { rawBody, payload } = parsedBody;

        const signature =
            (req.headers["x-catalystpay-signature"] as string | undefined) ??
            (req.headers["X-CatalystPay-Signature"] as string | undefined);
        const eventType = (req.headers["x-catalystpay-event"] as string) ?? (req.headers["X-CatalystPay-Event"] as string) ?? "unknown";
        console.log(`[webhook] Event header: ${eventType}`);

        if (env.CATALYST_WEBHOOK_SECRET) {
            if (!signature) {
                console.warn("[webhook] Missing signature header");
                res.status(401).json({ success: false, message: "Missing signature" });
                return;
            }
            if (!verifyWebhookSignature(rawBody, signature, env.CATALYST_WEBHOOK_SECRET)) {
                console.warn("[webhook] Invalid signature received");
                res.status(401).json({
                    success: false, message: "Invalid signature"
                });
                return;
            }
        }

        console.log("[webhook] Payload received:", JSON.stringify(payload, null, 2));

        console.log("[webhook] Acknowledging webhook with 200 response");
        res.status(200).json({ received: true });

        setImmediate(() => {
            processWebhookEvent(eventType, payload, req.originalUrl).catch((err: unknown) => {
                console.error("[webhook] async processing error:", err);
            });
        });
    } catch (error) {
        next(error);
    }
}

