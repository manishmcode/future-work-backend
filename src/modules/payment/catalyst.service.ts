import crypto from "crypto";
import { env } from "../../config/env";
import { AppError } from "../../common/errors/app-error";
import {
    findPaymentSessionByToken,
    insertPaymentSession,
} from "./payment-session.repository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalystLead {
    first_name: string;
    last_name: string;
    email: string;
    country: string;
    address?: string | undefined;
    city?: string | undefined;
    postal_code?: string | undefined;
    phone?: string | undefined;
}

export interface CreateSessionOptions {
    userId: number;
    planId?: number | null | undefined;
    planName: string;
    amount: number;
    currency?: string;
    billingFrequency?: string;
    lead: CatalystLead;
    subscriptionId?: number | null;
}

export interface CatalystSessionResult {
    sessionToken: string;
    paymentUrl: string;
    status: string;
}

export interface CatalystSessionStatus {
    sessionToken: string;
    status: string;
    amount: string | null;
    currency: string | null;
}

export interface CatalystPayResult {
    sessionToken: string;
    status: string;
    retryAllowed: boolean;
    verificationUrl: string | null;
    errorMessage: string | null;
    transactionId: string | null;
    subscriptionId: string | null;
    ibanLast4: string | null;
}

export interface CatalystIbanValidationResult {
    valid: boolean;
    bankName: string | null;
    bic: string | null;
    error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
    if (!env.CATALYST_API_KEY) {
        throw new AppError("Payment gateway is not configured (CATALYST_API_KEY missing)", 503);
    }
    return env.CATALYST_API_KEY;
}

function getGatewayId(): string {
    if (!env.CATALYST_GATEWAY_ID) {
        throw new AppError("Payment gateway is not configured (CATALYST_GATEWAY_ID missing)", 503);
    }
    return env.CATALYST_GATEWAY_ID;
}

function apiHeaders(): Record<string, string> {
    return {
        "Authorization": `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
    };
}

function sessionHeaders(): Record<string, string> {
    return {
        "Content-Type": "application/json",
    };
}

function normalizePayResult(sessionToken: string, json: Record<string, unknown>): CatalystPayResult {
    const transaction = json.transaction as Record<string, unknown> | undefined;
    const subscription = json.subscription as Record<string, unknown> | undefined;
    const paymentMethod = json.payment_method as Record<string, unknown> | undefined;

    return {
        sessionToken,
        status: String(transaction?.status ?? json.status ?? "failed").toLowerCase(),
        retryAllowed: Boolean(json.retry_allowed),
        verificationUrl: (json.verification_url as string) ?? null,
        errorMessage: (json.error as string) ?? ((json.error_details as Record<string, unknown> | undefined)?.message as string) ?? null,
        transactionId: (transaction?.id as string) ?? null,
        subscriptionId: (subscription?.id as string) ?? null,
        ibanLast4: (paymentMethod?.iban_last4 as string) ?? null,
    };
}

// Deep-sort object keys for HMAC canonical form
function sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep);
    }
    if (value !== null && typeof value === "object") {
        return Object.keys(value as object)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }
    return value;
}

// ---------------------------------------------------------------------------
// Signature verification (used by webhook controller)
// ---------------------------------------------------------------------------

function normalizeWebhookSignature(signature: string): string {
    return signature.trim().replace(/^sha256=/i, "");
}

function signaturesMatch(expected: string, received: string): boolean {
    const normalized = normalizeWebhookSignature(received);

    if (!/^[a-f0-9]+$/i.test(normalized) || expected.length !== normalized.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(normalized, "hex"));
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const rawExpected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    if (signaturesMatch(rawExpected, signature)) {
        return true;
    }

    try {
        const payload = JSON.parse(rawBody.toString("utf8")) as unknown;
        const canonical = JSON.stringify(sortKeysDeep(payload));
        const canonicalExpected = crypto
            .createHmac("sha256", secret)
            .update(canonical, "utf8")
            .digest("hex");

        return signaturesMatch(canonicalExpected, signature);
    } catch (err) {
        throw new AppError(err instanceof Error ? err.message : "Unknown error", 400);
    }
}

// ---------------------------------------------------------------------------
// Create a payment session
// ---------------------------------------------------------------------------

export async function createCatalystSession(opts: CreateSessionOptions): Promise<CatalystSessionResult> {
    const baseUrl = env.CATALYST_BASE_URL;
    const currency = opts.currency ?? env.CATALYST_CURRENCY;
    const billingFrequency = opts.billingFrequency ?? "MONTHLY";

    const body: Record<string, unknown> = {
        amount: opts.amount.toFixed(2),
        currency,
        billing_type: "RECURRING",
        billing_frequency: billingFrequency,
        lead: opts.lead,
    };

    if (env.CATALYST_CAMPAIGN_ID) {
        body.campaign_id = env.CATALYST_CAMPAIGN_ID;
    } else {
        body.gateway_id = getGatewayId();
    }

    if (env.CATALYST_WEBHOOK_PROFILE_ID) {
        body.webhook_profile_id = env.CATALYST_WEBHOOK_PROFILE_ID;
    }

    console.log("[payment.catalyst] Creating payment session request", {
        base_url: baseUrl,
        user_id: opts.userId,
        plan_id: opts.planId ?? null,
        plan_name: opts.planName,
        amount: opts.amount,
        currency,
        billing_frequency: billingFrequency,
        country: opts.lead.country,
        city: opts.lead.city ?? null,
        address: opts.lead.address ?? null,
        postal_code: opts.lead.postal_code ?? null,
        phone: opts.lead.phone ?? null,
        lead: opts.lead,
        body,
    });

    const response = await fetch(`${baseUrl}/payment-sessions/`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(body),
    });

    let json: Record<string, unknown>;
    try {
        json = (await response.json()) as Record<string, unknown>;
    } catch {
        throw new AppError("Invalid response from payment gateway", 502);
    }

    if (!response.ok) {
        const detail = (json.detail as string) ?? (json.message as string) ?? "Payment gateway error";
        throw new AppError(detail, 502);
    }

    const sessionToken = json.session_token as string;
    const paymentUrl = (json.payment_url as string) ?? "";
    const status = (json.status as string) ?? "PENDING";

    if (!sessionToken) {
        throw new AppError("Payment gateway returned an incomplete response", 502);
    }

    console.log("[payment.catalyst] Inserting payment session", {
        user_id: opts.userId,
        session_token: sessionToken,
        plan_id: opts.planId ?? null,
        plan_name: opts.planName,
        amount: opts.amount,
    });

    const insertedSession = await insertPaymentSession({
        user_id: opts.userId,
        session_token: sessionToken,
        plan_id: opts.planId ?? null,
        plan_name: opts.planName,
        amount: opts.amount,
        currency,
        billing_type: "RECURRING",
        billing_frequency: billingFrequency,
        payment_url: paymentUrl,
        subscription_id: opts.subscriptionId ?? null,
    });

    console.log("[payment.catalyst] Payment session inserted", {
        payment_session_id: insertedSession.id,
        user_id: insertedSession.user_id,
        plan_id: insertedSession.plan_id,
        session_token: insertedSession.session_token,
    });

    return { sessionToken, paymentUrl, status };
}

export async function submitCatalystPayment(
    sessionToken: string,
    payload: {
        iban: string;
        ibanHolderName: string;
        tenantReferenceId: string;
    },
): Promise<CatalystPayResult> {
    const baseUrl = env.CATALYST_BASE_URL;

    const paymentBody = {
        iban: payload.iban,
        iban_holder_name: payload.ibanHolderName,
        tenant_reference_id: payload.tenantReferenceId,
    };

    console.log("[payment.catalyst] Submitting payment request", {
        base_url: baseUrl,
        session_token: sessionToken,
        iban_last4: payload.iban.slice(-4),
        iban_holder_name: payload.ibanHolderName,
        tenant_reference_id: payload.tenantReferenceId,
        body: paymentBody,
    });

    const response = await fetch(`${baseUrl}/payment-sessions/${sessionToken}/pay/`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify(paymentBody),
    });

    let json: Record<string, unknown>;
    let rawResponse: string | undefined;
    try {
        rawResponse = await response.text();
        json = JSON.parse(rawResponse) as Record<string, unknown>;
    } catch {
        console.error("[payment.catalyst] Payment submission invalid response", {
            status: response.status,
            status_text: response.statusText,
            session_token: sessionToken,
            raw_response: rawResponse,
        });
        throw new AppError("Invalid response from payment gateway", 502);
    }

    console.log("[payment.catalyst] Payment submission response", {
        status: response.status,
        status_text: response.statusText,
        ok: response.ok,
        session_token: sessionToken,
        response: json,
    });

    if (!response.ok) {
        const detail = (json.detail as string) ?? (json.message as string) ?? "Payment submission failed";
        throw new AppError(detail, response.status >= 400 && response.status < 500 ? 422 : 502);
    }

    return normalizePayResult(sessionToken, json);
}

export async function verifyCatalystPayment(
    sessionToken: string,
    verificationId?: string,
): Promise<CatalystPayResult> {
    const baseUrl = env.CATALYST_BASE_URL;

    const body: Record<string, unknown> = {};
    if (verificationId) {
        body.verification_id = verificationId;
    }

    const response = await fetch(`${baseUrl}/payment-sessions/${sessionToken}/verify/`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify(body),
    });

    let json: Record<string, unknown>;
    try {
        json = (await response.json()) as Record<string, unknown>;
    } catch {
        throw new AppError("Invalid response from payment gateway", 502);
    }

    if (!response.ok) {
        const detail = (json.detail as string) ?? (json.message as string) ?? "Payment verification failed";
        throw new AppError(detail, response.status >= 400 && response.status < 500 ? 422 : 502);
    }

    return normalizePayResult(sessionToken, json);
}

export async function validateCatalystIban(iban: string): Promise<CatalystIbanValidationResult> {
    const baseUrl = env.CATALYST_BASE_URL;

    const response = await fetch(`${baseUrl}/iban-validate/`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ iban }),
    });

    let json: Record<string, unknown>;
    try {
        json = (await response.json()) as Record<string, unknown>;
    } catch {
        throw new AppError("Invalid response from payment gateway", 502);
    }

    if (!response.ok) {
        const detail = (json.detail as string) ?? (json.message as string) ?? "IBAN validation failed";
        throw new AppError(detail, response.status >= 400 && response.status < 500 ? 422 : 502);
    }

    return {
        valid: Boolean(json.valid),
        bankName: (json.bank_name as string) ?? null,
        bic: (json.bic as string) ?? null,
        error: (json.error as string) ?? null,
    };
}

// ---------------------------------------------------------------------------
// Retrieve session status from CatalystPay
// ---------------------------------------------------------------------------

export async function getCatalystSessionStatus(sessionToken: string): Promise<CatalystSessionStatus> {
    const baseUrl = env.CATALYST_BASE_URL;

    const response = await fetch(`${baseUrl}/payment-sessions/${sessionToken}/`, {
        method: "GET",
        headers: apiHeaders(),
    });

    let json: Record<string, unknown>;
    try {
        json = (await response.json()) as Record<string, unknown>;
    } catch {
        throw new AppError("Invalid response from payment gateway", 502);
    }

    if (!response.ok) {
        // Fall back to our locally stored status rather than crashing
        const local = await findPaymentSessionByToken(sessionToken);
        return {
            sessionToken,
            status: local?.status ?? "UNKNOWN",
            amount: local ? String(local.amount) : null,
            currency: local?.currency ?? null,
        };
    }

    return {
        sessionToken,
        status: (json.status as string) ?? "UNKNOWN",
        amount: json.amount ? String(json.amount) : null,
        currency: (json.currency as string) ?? null,
    };
}






