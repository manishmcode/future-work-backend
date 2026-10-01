import { z } from "zod";

const recordedClassLinkSchema = z
    .string()
    .trim()
    .max(2000, "Recorded class link must be at most 2000 characters")
    .refine((value) => value.length === 0 || z.string().url().safeParse(value).success, {
        message: "Recorded class link must be a valid URL",
    })
    .transform((value) => (value.length === 0 ? null : value));

const classFieldsSchema = z.object({
    name: z.string().trim().min(1, "Class name is required").max(150, "Class name must be at most 150 characters"),
    url: z.string().url("URL must be a valid URL").max(2000, "URL must be at most 2000 characters"),
    recorded_class_link: recordedClassLinkSchema.optional(),
    class_date: z.coerce.date(),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "End time must be a valid time"),
    end_date: z.coerce.date(),
    timezone: z.string().trim().min(1, "Timezone is required").max(100, "Timezone must be at most 100 characters"),
    is_active: z.boolean().optional(),
    plan_ids: z.array(z.coerce.number().int("Plan id must be an integer").positive("Plan id must be positive")).min(1, "Select at least one plan"),
});

export const createClassSchema = classFieldsSchema;

export const updateClassSchema = classFieldsSchema.partial()
    .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const classIdParamSchema = z.object({
    id: z.coerce.number().int("Class id must be an integer").positive("Class id must be positive"),
});
