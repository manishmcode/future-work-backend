import { z } from "zod";

export const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.email("Provide a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    plan_id: z.number().int("plan_id must be an integer").positive("plan_id must be positive").optional(),
    user_meta: z.record(z.string(), z.unknown()).optional(),
});

export const loginSchema = z.object({
    email: z.email("Provide a valid email"),
    password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
    old_password: z.string().min(1, "old_password is required"),
    new_password: z.string().min(6, "new_password must be at least 6 characters"),
});
