export interface Subscription {
    id: number;
    user_id: number;
    plan_id: number | null;
    plan_name: string;
    price: string | number;
    status: string;
    payment_status: string;
    payment_reference: string;
    starts_at: Date;
    ends_at: Date | null;
    cancelled_at: Date | null;
    currency: string | null;
    billing_frequency: string | null;
    catalyst_session_token: string | null;
    catalyst_subscription_id: string | null;
    catalyst_transaction_id: string | null;
    iban_last4: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface AssignPlanResponse {
    user_id: number;
    plan: {
        id: number;
        name: string;
        price: number;
    };
    subscription_id: number;
    payment_session_id: number;
    starts_at: Date;
    ends_at: Date | null;
    reused_existing_subscription: boolean;
}

export interface CreatePaymentSessionPayload {
    plan_id?: number | undefined;
    plan_name: string;
    amount: number;
    first_name: string;
    last_name: string;
    email: string;
    country: string;
    address?: string | undefined;
    city?: string | undefined;
    postal_code?: string | undefined;
    phone?: string | undefined;
    payment_reference?: string | undefined;
}

export interface RetryPaymentSessionPayload {
    payment_reference: string;
    first_name: string;
    last_name: string;
}

export interface SubmitPaymentPayload {
    session_token: string;
    iban: string;
    iban_holder_name: string;
}

export interface VerifyPaymentPayload {
    session_token: string;
    verification_id?: string | undefined;
}

export interface ValidateIbanPayload {
    session_token?: string | undefined;
    iban: string;
}

export interface UnsubscribePayload {
    first_name?: string | undefined;
    last_name?: string | undefined;
    email: string;
    iban_last_5?: string | undefined;
    message?: string | undefined;
    is_unsubscribe?: boolean | undefined;
    options?: unknown | undefined;
}

export interface UnsubscribeResponse {
    email: string;
    cancelled_count: number;
    status: string;
}

export interface SubscriptionResponse {
    id: number;
    user_id: number;
    plan_name: string;
    price: number;
    status: string;
    payment_status: string;
    payment_reference: string;
    starts_at: Date;
    ends_at: Date | null;
    cancelled_at: Date | null;
    currency: string | null;
    billing_frequency: string | null;
    iban_last4: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface PaymentSessionInitResponse {
    sessionToken: string;
}

export interface PaymentStatusResponse {
    sessionToken: string;
    status: string;
    subscriptionActive: boolean;
    amount: string | null;
    currency: string | null;
}

export interface SubmitPaymentResponse {
    sessionToken: string;
    status: string;
    retryAllowed: boolean;
    verificationUrl: string | null;
    message: string | null;
    subscriptionActive: boolean;
}

export interface ValidateIbanResponse {
    valid: boolean;
    bankName: string | null;
    bic: string | null;
    message: string | null;
}

