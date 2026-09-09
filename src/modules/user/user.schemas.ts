import { z } from "zod";

export const updateProfileSchema = z.object({
    firstname: z.string().min(2, "firstname must be at least 2 characters"),
    lastname: z.string(),
    display_name: z.string().min(2, "display_name must be at least 2 characters"),
});
