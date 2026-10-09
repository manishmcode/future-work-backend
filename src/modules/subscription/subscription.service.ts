import { AppError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { sendEmail } from "../../common/utils/mailer";
import { findUserByEmail } from "../user/user.repository";
import { findUserById, updateUserCheckoutDetails, updateUserPlanId } from "../user/user.repository";
import { getPlanById } from "../plans/plans.repository";
import {
    createCatalystSession,
    getCatalystSessionStatus,
    submitCatalystPayment,
    validateCatalystIban,
    verifyCatalystPayment,
} from "../payment/catalyst.service";
import {
    findPaymentSessionByTokenAndUser,
    PaymentSession,
    updatePaymentSessionStatus,
} from "../payment/payment-session.repository";
import {
    assignPlanRecords,
    cancelActiveSubscriptionsByUserId,
    createSubscription,
    findSubscriptionByPaymentReference,
    findSubscriptionById,
    getLatestSubscriptionByUserId,
    listSubscriptionsByUserId,
    updateSubscriptionPaymentStatusById,
    updateSubscriptionStatusAndPaymentStatusById,
    updateSubscriptionWithCatalystData,
} from "./subscription.repository";
import { insertContactUs } from "./contact.repository";
import {
    AssignPlanResponse,
    CreatePaymentSessionPayload,
    PaymentSessionInitResponse,
    PaymentStatusResponse,
    SubmitPaymentPayload,
    SubmitPaymentResponse,
    Subscription,
    SubscriptionResponse,
    UnsubscribePayload,
    UnsubscribeResponse,
    ValidateIbanPayload,
    ValidateIbanResponse,
    VerifyPaymentPayload,
    RetryPaymentSessionPayload,
} from "./subscription.types";

export async function assignPlanToUser(userId: number, planId: number): Promise<AssignPlanResponse> {
    console.log("[subscription.assignPlan] Assigning plan", {
        user_id: userId,
        plan_id: planId,
    });

    const [user, plan] = await Promise.all([
        findUserById(userId),
        getPlanById(planId),
    ]);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    if (!plan) {
        throw new AppError("Plan not found", 404);
    }

    if (!plan.is_active) {
        throw new AppError("Plan is not active", 422);
    }

    const result = await assignPlanRecords(user, plan);
    console.log("[subscription.assignPlan] Plan assigned successfully", result);
    return result;
}

function formatSelectedOptions(options: unknown, excludedKeys: string[] = []): string[] {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        return [];
    }

    const excludedKeySet = new Set(excludedKeys.map((key) => key.toLowerCase()));

    return Object.entries(options)
        .filter(([key]) => !excludedKeySet.has(key.toLowerCase()))
        .filter(([, value]) => {
            if (typeof value === "boolean") {
                return value;
            }

            if (Array.isArray(value)) {
                return value.length > 0;
            }

            return value !== null && value !== undefined && value !== "";
        })
        .map(([key, value]) => {
            if (typeof value === "boolean") {
                return key;
            }

            if (Array.isArray(value)) {
                return `${key}: ${value.join(", ")}`;
            }

            return `${key}: ${String(value)}`;
        });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getStringOption(options: unknown, keys: string[]): string | null {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        return null;
    }

    const record = options as Record<string, unknown>;

    for (const key of keys) {
        const value = record[key];

        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

function mapSubscriptionRow(row: Subscription): SubscriptionResponse {
    return {
        id: row.id,
        user_id: row.user_id,
        plan_name: row.plan_name,
        price: Number(row.price),
        status: row.status,
        payment_status: row.payment_status,
        payment_reference: row.payment_reference,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        cancelled_at: row.cancelled_at,
        currency: row.currency ?? null,
        billing_frequency: row.billing_frequency ?? null,
        iban_last4: row.iban_last4 ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function sanitizeIban(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
}

function sanitizeOptionalValue(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function toStoredStatus(status: string): string {
    return status.toUpperCase();
}

function isSuccessfulPaymentStatus(status: string): boolean {
    return ["APPROVED", "COMPLETED", "ACTIVE", "PENDING_ASYNC"].includes(toStoredStatus(status));
}

function mapPayResultToApi(result: {
    sessionToken: string;
    status: string;
    retryAllowed: boolean;
    verificationUrl: string | null;
    errorMessage: string | null;
}, subscriptionActive: boolean): SubmitPaymentResponse {
    const status = toStoredStatus(result.status);

    return {
        sessionToken: result.sessionToken,
        status,
        retryAllowed: result.retryAllowed,
        verificationUrl: result.verificationUrl,
        message: subscriptionActive || isSuccessfulPaymentStatus(status) ? null : result.errorMessage,
        subscriptionActive,
    };
}

async function ensureSubscriptionForCompletedSession(
    session: PaymentSession,
    data?: {
        catalystSubscriptionId?: string | null;
        catalystTransactionId?: string | null;
        ibanLast4?: string | null;
        paymentStatus?: string | null;
    },
): Promise<boolean> {
    console.log("[subscription.paymentComplete] Ensuring subscription for completed session", {
        user_id: session.user_id,
        session_token: session.session_token,
        payment_session_plan_id: session.plan_id,
        existing_subscription_id: session.subscription_id,
    });

    if (session.plan_id !== null) {
        console.log("[subscription.paymentComplete] Saving plan_id to user", {
            user_id: session.user_id,
            plan_id: session.plan_id,
        });
        await updateUserPlanId(session.user_id, session.plan_id);
    } else {
        console.log("[subscription.paymentComplete] Skipping users.plan_id update because payment session has no plan_id", {
            user_id: session.user_id,
            session_token: session.session_token,
        });
    }

    if (session.subscription_id !== null) {
        const existingByRef = await findSubscriptionById(session.user_id, session.subscription_id);

        if (!existingByRef) {
            return false;
        }

        await updateSubscriptionWithCatalystData(existingByRef.id, {
            catalyst_subscription_id: data?.catalystSubscriptionId ?? session.catalyst_subscription_id,
            catalyst_transaction_id: data?.catalystTransactionId ?? session.catalyst_transaction_id,
            iban_last4: data?.ibanLast4 ?? session.iban_last4,
            currency: session.currency,
            billing_frequency: session.billing_frequency,
        });

        // A retry belongs to this existing failed payment/subscription. Do not
        // insert a replacement subscription or change its payment reference.
        await updateSubscriptionStatusAndPaymentStatusById(existingByRef.id, "pending_activation", "active");
        return true;
    }

    const existing = await findSubscriptionByPaymentReference(session.user_id, session.session_token);

    if (existing) {
        await updateSubscriptionWithCatalystData(existing.id, {
            catalyst_subscription_id: data?.catalystSubscriptionId ?? session.catalyst_subscription_id,
            catalyst_transaction_id: data?.catalystTransactionId ?? session.catalyst_transaction_id,
            iban_last4: data?.ibanLast4 ?? session.iban_last4,
            currency: session.currency,
            billing_frequency: session.billing_frequency,
        });

        if (existing.payment_status !== "active") {
            await updateSubscriptionPaymentStatusById(existing.id, "active");
        }

        await updatePaymentSessionStatus(session.session_token, {
            status: data?.paymentStatus ?? "COMPLETED",
            subscription_id: existing.id,
            catalyst_subscription_id: data?.catalystSubscriptionId ?? session.catalyst_subscription_id,
            catalyst_transaction_id: data?.catalystTransactionId ?? session.catalyst_transaction_id,
            iban_last4: data?.ibanLast4 ?? session.iban_last4,
        });
        return existing.status === "active";
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + 1);

    const created = await createSubscription({
        user_id: session.user_id,
        plan_name: session.plan_name,
        price: Number(session.amount),
        status: "pending_activation",
        payment_status: "active",
        payment_reference: session.session_token,
        starts_at: startsAt,
        ends_at: endsAt,
        currency: session.currency,
        billing_frequency: session.billing_frequency,
        catalyst_session_token: session.session_token,
        catalyst_subscription_id: data?.catalystSubscriptionId ?? session.catalyst_subscription_id,
        catalyst_transaction_id: data?.catalystTransactionId ?? session.catalyst_transaction_id,
        iban_last4: data?.ibanLast4 ?? session.iban_last4,
    });

    await updatePaymentSessionStatus(session.session_token, {
        status: data?.paymentStatus ?? "COMPLETED",
        subscription_id: created.id,
        catalyst_subscription_id: data?.catalystSubscriptionId ?? session.catalyst_subscription_id,
        catalyst_transaction_id: data?.catalystTransactionId ?? session.catalyst_transaction_id,
        iban_last4: data?.ibanLast4 ?? session.iban_last4,
    });

    return true;
}

export async function initiateCatalystPayment(
    userId: number,
    payload: CreatePaymentSessionPayload,
): Promise<PaymentSessionInitResponse> {
    console.log("[subscription.createPaymentSession] Service started", {
        user_id: userId,
        plan_id: payload.plan_id ?? null,
        plan_name: payload.plan_name,
        amount: payload.amount,
    });

    const user = await findUserById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    let retrySubscription: Subscription | undefined;
    if (payload.payment_reference) {
        retrySubscription = await findSubscriptionByPaymentReference(userId, payload.payment_reference);
        if (!retrySubscription) throw new AppError("Failed payment not found", 404);
        if (!["failed", "declined", "cancelled"].includes(retrySubscription.payment_status.toLowerCase())) {
            throw new AppError("This payment is not eligible for retry", 422);
        }
    }

    if (payload.plan_id !== undefined) {
        const plan = await getPlanById(payload.plan_id);

        console.log("[subscription.createPaymentSession] Plan lookup result", {
            requested_plan_id: payload.plan_id,
            found: Boolean(plan),
        });

        if (!plan) {
            throw new AppError("Plan not found", 404);
        }
    }

    await updateUserCheckoutDetails(userId, {
        phone: sanitizeOptionalValue(payload.phone),
        address: sanitizeOptionalValue(payload.address),
        city: sanitizeOptionalValue(payload.city),
        postal_code: sanitizeOptionalValue(payload.postal_code),
        country: sanitizeOptionalValue(payload.country),
    });

    const result = await createCatalystSession({
        userId,
        planId: retrySubscription?.plan_id ?? payload.plan_id ?? null,
        planName: retrySubscription?.plan_name ?? payload.plan_name,
        amount: retrySubscription ? Number(retrySubscription.price) : payload.amount,
        subscriptionId: retrySubscription?.id ?? null,
        lead: {
            first_name: payload.first_name.trim(),
            last_name: payload.last_name.trim(),
            email: payload.email.trim(),
            country: payload.country.trim().toUpperCase(),
            address: sanitizeOptionalValue(payload.address) ?? undefined,
            city: sanitizeOptionalValue(payload.city) ?? undefined,
            postal_code: sanitizeOptionalValue(payload.postal_code) ?? undefined,
            phone: sanitizeOptionalValue(payload.phone) ?? undefined,
        },
    });

    return {
        sessionToken: result.sessionToken,
    };
}

export async function initiateRetryPayment(
    userId: number,
    payload: RetryPaymentSessionPayload,
): Promise<PaymentSessionInitResponse> {
    const subscription = await findSubscriptionByPaymentReference(userId, payload.payment_reference);
    if (!subscription) throw new AppError("Failed payment not found", 404);
    if (!["failed", "declined", "cancelled"].includes(subscription.payment_status.toLowerCase())) {
        throw new AppError("This payment is not eligible for retry", 422);
    }

    const user = await findUserById(userId);
    if (!user) throw new AppError("User not found", 404);
    const country = user.country?.trim().toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country)) {
        throw new AppError("A valid billing country is required before retrying payment", 422);
    }

    const result = await createCatalystSession({
        userId,
        planId: subscription.plan_id,
        planName: subscription.plan_name,
        amount: Number(subscription.price),
        subscriptionId: subscription.id,
        lead: {
            first_name: payload.first_name.trim(),
            last_name: payload.last_name.trim(),
            email: user.email,
            country,
            address: user.address ?? undefined,
            city: user.city ?? undefined,
            postal_code: user.postal_code ?? undefined,
            phone: user.phone ?? undefined,
        },
    });
    return { sessionToken: result.sessionToken };
}

export async function submitPaymentForSession(
    userId: number,
    payload: SubmitPaymentPayload,
): Promise<SubmitPaymentResponse> {
    const localSession = await findPaymentSessionByTokenAndUser(payload.session_token, userId);

    if (!localSession) {
        throw new AppError("Payment session not found", 404);
    }

    const linkedSubscription = localSession.subscription_id !== null
        ? await findSubscriptionById(userId, localSession.subscription_id)
        : undefined;

    // Retry sessions are deliberately linked to their original failed payment.
    // Only skip the gateway when that original payment is already active.
    if (linkedSubscription?.payment_status.toLowerCase() === "active") {
        return {
            sessionToken: payload.session_token,
            status: "COMPLETED",
            retryAllowed: false,
            verificationUrl: null,
            message: null,
            subscriptionActive: true,
        };
    }

    const iban = sanitizeIban(payload.iban);

    const result = await submitCatalystPayment(payload.session_token, {
        iban,
        ibanHolderName: payload.iban_holder_name.trim(),
        tenantReferenceId: `bussiness-growth-${userId}-${payload.session_token}`,
    });
    console.log(result, "[subscription.submitPayment] Catalyst payment submission result");

    await updatePaymentSessionStatus(payload.session_token, {
        status: toStoredStatus(result.status),
        catalyst_subscription_id: result.subscriptionId,
        catalyst_transaction_id: result.transactionId,
        iban_last4: result.ibanLast4 ?? iban.slice(-4),
    });

    let subscriptionActive = false;

    if (isSuccessfulPaymentStatus(result.status)) {
        subscriptionActive = await ensureSubscriptionForCompletedSession(localSession, {
            catalystSubscriptionId: result.subscriptionId,
            catalystTransactionId: result.transactionId,
            ibanLast4: result.ibanLast4 ?? iban.slice(-4),
            paymentStatus: toStoredStatus(result.status),
        });
    }

    return mapPayResultToApi(result, subscriptionActive);
}

export async function validateIbanForSession(
    userId: number | null,
    payload: ValidateIbanPayload,
): Promise<ValidateIbanResponse> {
    if (userId !== null && payload.session_token) {
        const localSession = await findPaymentSessionByTokenAndUser(payload.session_token, userId);

        if (!localSession) {
            throw new AppError("Payment session not found", 404);
        }
    }

    const iban = sanitizeIban(payload.iban);
    const result = await validateCatalystIban(iban);

    return {
        valid: result.valid,
        bankName: result.bankName,
        bic: result.bic,
        message: result.error,
    };
}

export async function verifyPaymentForSession(
    userId: number,
    payload: VerifyPaymentPayload,
): Promise<SubmitPaymentResponse> {
    const localSession = await findPaymentSessionByTokenAndUser(payload.session_token, userId);

    if (!localSession) {
        throw new AppError("Payment session not found", 404);
    }

    const linkedSubscription = localSession.subscription_id !== null
        ? await findSubscriptionById(userId, localSession.subscription_id)
        : undefined;

    if (linkedSubscription?.payment_status.toLowerCase() === "active") {
        return {
            sessionToken: payload.session_token,
            status: "COMPLETED",
            retryAllowed: false,
            verificationUrl: null,
            message: null,
            subscriptionActive: true,
        };
    }

    const result = await verifyCatalystPayment(payload.session_token, payload.verification_id);

    await updatePaymentSessionStatus(payload.session_token, {
        status: toStoredStatus(result.status),
        catalyst_subscription_id: result.subscriptionId,
        catalyst_transaction_id: result.transactionId,
        iban_last4: result.ibanLast4 ?? localSession.iban_last4,
    });

    let subscriptionActive = false;

    if (isSuccessfulPaymentStatus(result.status)) {
        subscriptionActive = await ensureSubscriptionForCompletedSession(localSession, {
            catalystSubscriptionId: result.subscriptionId,
            catalystTransactionId: result.transactionId,
            ibanLast4: result.ibanLast4 ?? localSession.iban_last4,
            paymentStatus: toStoredStatus(result.status),
        });
    }

    return mapPayResultToApi(result, subscriptionActive);
}

export async function getPaymentSessionStatus(
    userId: number,
    sessionToken: string,
): Promise<PaymentStatusResponse> {
    const localSession = await findPaymentSessionByTokenAndUser(sessionToken, userId);

    if (!localSession) {
        throw new AppError("Payment session not found", 404);
    }

    if (localSession.status === "COMPLETED" && localSession.subscription_id !== null) {
        const existing = await findSubscriptionByPaymentReference(localSession.user_id, localSession.session_token);
        const active = existing?.status === "active";
        return {
            sessionToken,
            status: "COMPLETED",
            subscriptionActive: active,
            amount: String(localSession.amount),
            currency: localSession.currency,
        };
    }

    const live = await getCatalystSessionStatus(sessionToken);

    let subscriptionActive = localSession.subscription_id !== null;

    if (!subscriptionActive && isSuccessfulPaymentStatus(live.status)) {
        subscriptionActive = await ensureSubscriptionForCompletedSession(localSession, {
            paymentStatus: toStoredStatus(live.status),
        });
    }

    return {
        sessionToken,
        status: toStoredStatus(live.status),
        subscriptionActive,
        amount: live.amount ?? String(localSession.amount),
        currency: live.currency ?? localSession.currency,
    };
}

export async function getMyCurrentPlan(userId: number): Promise<SubscriptionResponse> {
    const subscription = await getLatestSubscriptionByUserId(userId);

    if (!subscription) {
        throw new AppError("No subscription found for this user", 404);
    }

    return mapSubscriptionRow(subscription);
}

export async function getMySubscriptionHistory(userId: number): Promise<SubscriptionResponse[]> {
    const rows = await listSubscriptionsByUserId(userId);
    return rows.map(mapSubscriptionRow);
}

export async function unsubscribePlan(payload: UnsubscribePayload): Promise<UnsubscribeResponse> {
    const user = await findUserByEmail(payload.email);
    const reasonOptionKeys = ["reason", "selected_reason", "selectedReason", "unsubscribe_reason", "unsubscribeReason"];
    const reason = getStringOption(payload.options, reasonOptionKeys);
    const selectedOptions = formatSelectedOptions(payload.options, reasonOptionKeys);
    const message = typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message.trim()
        : null;
    const supportEmail = env.SUPPORT_EMAIL ?? "support@bussiness-growthacademy.net";

    // Merge frontend-provided options with metadata
    const mergedOptions = {
        ...(payload.options ?? {}),
        first_name: payload.first_name,
        last_name: payload.last_name,
        is_unsubscribe: payload.is_unsubscribe ?? true,
        iban_last_5: payload.iban_last_5,
    };

    await insertContactUs({
        email: payload.email,
        message: payload.message ?? null,
        options: mergedOptions,
    });

    const shouldUnsubscribe = payload.is_unsubscribe === undefined ? true : Boolean(payload.is_unsubscribe);
    const cancelledCount = shouldUnsubscribe && user ? await cancelActiveSubscriptionsByUserId(user.id) : 0;

    const customerFields = [
        { label: "First name", value: payload.first_name },
        { label: "Last name", value: payload.last_name },
        { label: "Email address", value: payload.email },
        { label: "IBAN last 5 digits", value: payload.iban_last_5 },
        { label: "Reason", value: reason },
        { label: "Message", value: message },
    ].filter((field) => typeof field.value === "string" && field.value.trim().length > 0) as Array<{
        label: string;
        value: string;
    }>;

    const textLines = [
        "A new unsubscribe request has been submitted.",
        "",
        "Customer details:",
        ...customerFields.map((field) => `${field.label}: ${field.value.trim()}`),
    ];

    if (selectedOptions.length > 0) {
        textLines.push("", "Additional selected options:", ...selectedOptions);
    }

    textLines.push("", "Please review this request and take any follow-up action if needed.");

    const customerFieldsHtml = customerFields
        .map((field) => `<p><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value.trim())}</p>`)
        .join("");

    const selectedOptionsHtml = selectedOptions.length > 0
        ? `
                    <p><strong>Additional selected options:</strong></p>
                    <ul>
                        ${selectedOptions.map((option) => `<li>${escapeHtml(option)}</li>`).join("")}
                    </ul>
                `
        : "";

    try {
        await sendEmail({
            to: supportEmail,
            subject: "Unsubscribe Request Received",
            text: textLines.join("\n"),
            html: `
                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                    <p>A new unsubscribe request has been submitted.</p>
                    <p><strong>Customer details</strong></p>
                    ${customerFieldsHtml}
                    ${selectedOptionsHtml}
                    <p>Please review this request and take any follow-up action if needed.</p>
                </div>
            `,
        });

        console.log("[unsubscribe] Support email sent successfully", {
            to: supportEmail,
            email: payload.email,
        });
    } catch (error) {
        console.error("[unsubscribe] Failed to send support email", {
            to: supportEmail,
            email: payload.email,
            error,
        });
    }

    return {
        email: payload.email,
        cancelled_count: cancelledCount,
        status: shouldUnsubscribe
            ? cancelledCount > 0 ? "cancelled" : "request_received"
            : "contact_saved",
    };
}



