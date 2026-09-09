import { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/api-response";
import { libraryItemsQuerySchema } from "./library.schemas";
import {
    fetchLibraryCategories,
    fetchLibraryRows,
    fetchPaginatedLibraryItems,
    importEbooksFromJson,
} from "./library.service";

function forwardLibraryError(operation: string, error: unknown, next: NextFunction): void {
    console.error(`[library.${operation}] Request failed`, error);

    if (error instanceof AppError) {
        next(error);
        return;
    }

    const message = error instanceof Error ? error.message : `Unable to ${operation}`;
    next(new AppError(message, 500));
}

export async function getLibraryController(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        console.log("[library.all] Fetching all active library items");
        const result = await fetchLibraryRows();
        console.log("[library.all] Library items retrieved", {
            categories: result.length,
            items: result.reduce((total, category) => total + category.cards.length, 0),
        });
        sendSuccess(res, "Library retrieved successfully", result);
    } catch (error) {
        forwardLibraryError("all", error, next);
    }
}

export async function getLibraryCategoriesController(
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        console.log("[library.categories] Fetching active library categories");
        const result = await fetchLibraryCategories();
        console.log("[library.categories] Categories retrieved", {
            categories: result.length,
            items: result.reduce((total, category) => total + category.item_count, 0),
        });
        sendSuccess(res, "Library categories retrieved successfully", result);
    } catch (error) {
        forwardLibraryError("categories", error, next);
    }
}

export async function getPaginatedLibraryItemsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const parsed = libraryItemsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        console.log("[library.items] Fetching paginated library items", {
            page: parsed.data.page,
            limit: parsed.data.limit,
            category: parsed.data.category ?? null,
        });

        const result = await fetchPaginatedLibraryItems(
            parsed.data.page,
            parsed.data.limit,
            parsed.data.category,
        );

        console.log("[library.items] Paginated items retrieved", {
            returned: result.items.length,
            total: result.pagination.total,
            page: result.pagination.page,
            has_more: result.pagination.has_more,
        });
        sendSuccess(res, "Library items retrieved successfully", result);
    } catch (error) {
        forwardLibraryError("items", error, next);
    }
}

export async function importEbooksController(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        console.log("[library.import] Starting ebook JSON import");
        const result = await importEbooksFromJson();
        console.log("[library.import] Ebook import completed", result);
        sendSuccess(res, "Ebooks imported successfully", result);
    } catch (error) {
        forwardLibraryError("import", error, next);
    }
}
