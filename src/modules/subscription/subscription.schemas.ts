import { z } from "zod";

export const assignPlanSchema = z.object({
    plan_id: z.number().int("plan_id must be an integer").positive("plan_id must be positive"),
});

const ibanField = z
    .string()
    .trim()
    .min(15, "IBAN is too short")
    .max(34, "IBAN is too long")
    .regex(/^[A-Za-z0-9\s]+$/, "IBAN can only contain letters and numbers");

export const createPaymentSessionSchema = z.object({
    plan_id: z.number().int("plan_id must be an integer").positive("plan_id must be positive").optional(),
    plan_name: z.string().min(2, "plan_name must be at least 2 characters"),
    amount: z.number().positive("amount must be greater than 0"),
    first_name: z.string().trim().min(1, "first_name is required").max(120, "first_name is too long"),
    last_name: z.string().trim().min(1, "last_name is required").max(120, "last_name is too long"),
    email: z.email("Provide a valid email"),
    country: z.string().trim().regex(/^[A-Z]{2}$/, "country must be a valid ISO 3166-1 alpha-2 code"),
    address: z.string().trim().max(255, "address is too long").optional(),
    city: z.string().trim().max(120, "city is too long").optional(),
    postal_code: z.string().trim().max(40, "postal_code is too long").optional(),
    phone: z.string().trim().max(40, "phone is too long").optional(),
    payment_reference: z.string().trim().min(1).optional(),
});

export const retryPaymentSessionSchema = z.object({
    payment_reference: z.string().trim().min(1, "payment_reference is required"),
    first_name: z.string().trim().min(1, "first_name is required").max(120),
    last_name: z.string().trim().min(1, "last_name is required").max(120),
});

export const submitPaymentSchema = z.object({
    session_token: z.string().startsWith("ps_", "session_token must be a valid payment session token"),
    iban: ibanField,
    iban_holder_name: z
        .string()
        .trim()
        .min(2, "iban_holder_name must be at least 2 characters")
        .max(120, "iban_holder_name is too long"),
});

export const verifyPaymentSchema = z.object({
    session_token: z.string().startsWith("ps_", "session_token must be a valid payment session token"),
    verification_id: z.string().trim().min(1).max(255).optional(),
});

export const validateIbanSchema = z.object({
    session_token: z.string().startsWith("ps_", "session_token must be a valid payment session token").optional(),
    iban: ibanField,
});

export const unsubscribeSchema = z.object({
    first_name: z.string().min(2, "first_name must be at least 2 characters").optional(),
    last_name: z.string().min(2, "last_name must be at least 2 characters").optional(),
    email: z.email("Provide a valid email"),
    iban_last_5: z.string().regex(/^\d{5}$/, "iban_last_5 must be exactly 5 digits").optional(),
    message: z.string().optional(),
    is_unsubscribe: z.boolean().optional().default(true),
    options: z.any().optional(),
});
