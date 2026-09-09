import { z } from "zod";

export const createPlanSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
    price: z.number().nonnegative("Price must be zero or greater"),
    currency: z.string().trim().length(3, "Currency must be a 3-letter ISO code").transform((value) => value.toUpperCase()).optional(),
    is_active: z.boolean().optional(),
    description: z.string().nullable().optional(),
    features: z.array(z.object({
        name: z.string().trim().min(1, "Feature name is required"),
        is_included: z.boolean(),
    })).optional(),
});

export const updatePlanSchema = createPlanSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
);

export const planIdParamSchema = z.object({
    id: z.coerce.number().int("Plan id must be an integer").positive("Plan id must be positive"),
});
