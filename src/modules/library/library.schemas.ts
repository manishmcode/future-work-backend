import { z } from "zod";

export const libraryItemsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(60).default(24),
    category: z.string().trim().min(1).max(100).optional(),
});
