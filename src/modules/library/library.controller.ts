import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../../common/errors/app-error";
import { AuthRequest } from "../../common/middlewares/auth.middleware";
import { sendSuccess } from "../../common/utils/api-response";
import { libraryItemsQuerySchema, signedLibraryAssetParamsSchema } from "./library.schemas";
import {
    fetchLibraryCategories,
    fetchLibraryRows,
    fetchPaginatedLibraryItems,
    getAuthorizedLibraryAsset,
    importEbooksFromJson,
    resolveSignedLibraryAssetToken,
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

export async function getLibraryController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) throw new AppError("Unauthorized", 401);
        if (!req.authToken) throw new AppError("Authorization token is missing", 401);

        console.log("[library.all] Fetching all active library items");
        const result = await fetchLibraryRows(userId, req.authUser?.isAdmin === true, req.authToken);
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
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) throw new AppError("Unauthorized", 401);

        console.log("[library.categories] Fetching active library categories");
        const result = await fetchLibraryCategories(userId, req.authUser?.isAdmin === true);
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
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) throw new AppError("Unauthorized", 401);
        if (!req.authToken) throw new AppError("Authorization token is missing", 401);

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
            userId,
            req.authUser?.isAdmin === true,
            req.authToken,
            parsed.data.page,
            parsed.data.limit,
            parsed.data.category,
            parsed.data.search,
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

function parseRangeHeader(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | null {
    if (!rangeHeader) return null;

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) throw new AppError("Invalid range header", 416);

    const startText = match[1];
    const endText = match[2];

    if (!startText && !endText) throw new AppError("Invalid range header", 416);

    if (!startText) {
        const suffixLength = Number(endText);
        if (!Number.isInteger(suffixLength) || suffixLength <= 0) throw new AppError("Invalid range header", 416);
        return {
            start: Math.max(fileSize - suffixLength, 0),
            end: fileSize - 1,
        };
    }

    const start = Number(startText);
    const end = endText ? Number(endText) : fileSize - 1;

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        start >= fileSize
    ) {
        throw new AppError("Invalid range header", 416);
    }

    return {
        start,
        end: Math.min(end, fileSize - 1),
    };
}

async function streamLibraryAsset(
    req: Request,
    res: Response,
    asset: Awaited<ReturnType<typeof getAuthorizedLibraryAsset>>,
): Promise<void> {
    const fileStats = await stat(asset.filePath);

    if (!fileStats.isFile()) throw new AppError("Library asset not found", 404);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");

    const range = parseRangeHeader(req.headers.range, fileStats.size);

    if (range) {
        const chunkSize = range.end - range.start + 1;
        res.status(206);
        res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileStats.size}`);
        res.setHeader("Content-Length", chunkSize);
        createReadStream(asset.filePath, { start: range.start, end: range.end }).pipe(res);
        return;
    }

    res.setHeader("Content-Length", fileStats.size);
    createReadStream(asset.filePath).pipe(res);
}

export async function getSignedLibraryAssetController(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.authUser?.userId;
        if (!userId) throw new AppError("Unauthorized", 401);
        if (!req.authToken) throw new AppError("Authorization token is missing", 401);

        const parsed = signedLibraryAssetParamsSchema.safeParse(req.params);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((issue) => issue.message).join(", "), 422);
        }

        const assetRequest = resolveSignedLibraryAssetToken(parsed.data.token, userId, req.authToken);
        const asset = await getAuthorizedLibraryAsset(
            userId,
            req.authUser?.isAdmin === true,
            assetRequest.itemId,
            assetRequest.kind,
        );

        await streamLibraryAsset(req, res, asset);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            next(new AppError("Library asset not found", 404));
            return;
        }

        forwardLibraryError("signedAsset", error, next);
    }
}
