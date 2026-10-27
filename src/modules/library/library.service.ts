import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AppError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { getPlans } from "../plans/plans.repository";
import { findUserById } from "../user/user.repository";
import {
    getActiveLibraryItems,
    getLibraryCategories,
    getLibraryItemById,
    getPaginatedLibraryItems,
    upsertLibraryItems,
} from "./library.repository";
import {
    EbookJsonItem,
    LibraryCategorySummary,
    LibraryCourseRow,
    LibraryImportResult,
    LibraryItemImportPayload,
    PaginatedLibraryResult,
} from "./library.types";

type LibraryAssetKind = "image" | "content";

export interface AuthorizedLibraryAsset {
    filePath: string;
    sourceUrl: string;
    contentType: string;
}

interface LibraryAssetTokenPayload extends JwtPayload {
    purpose: "library_asset";
    item_id: number;
    kind: LibraryAssetKind;
    session_hash: string;
}

function getAssetTokenSecret(): string {
    return env.LIBRARY_ASSET_TOKEN_SECRET ?? env.JWT_SECRET;
}

function hashSessionToken(authToken: string): string {
    return createHash("sha256").update(authToken).digest("base64url");
}

function getAuthTokenExpiresAt(authToken: string): number | null {
    const decoded = jwt.decode(authToken);
    if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") return null;
    return decoded.exp;
}

function libraryAssetUrl(
    itemId: number,
    kind: LibraryAssetKind,
    userId: number,
    authToken: string,
): string {
    const now = Math.floor(Date.now() / 1000);
    const authExpiresAt = getAuthTokenExpiresAt(authToken);
    const ttlSeconds = authExpiresAt
        ? Math.min(env.LIBRARY_ASSET_TOKEN_TTL_SECONDS, Math.max(authExpiresAt - now, 0))
        : env.LIBRARY_ASSET_TOKEN_TTL_SECONDS;

    if (ttlSeconds <= 0) throw new AppError("JWT expired", 401);

    const token = jwt.sign(
        {
            purpose: "library_asset",
            item_id: itemId,
            kind,
            session_hash: hashSessionToken(authToken),
        },
        getAssetTokenSecret(),
        {
            subject: String(userId),
            expiresIn: ttlSeconds,
        },
    );

    return `/v/${token}`;
}

function contentTypeFromPath(filePathOrUrl: string): string {
    const pathname = (() => {
        try {
            return new URL(filePathOrUrl).pathname;
        } catch {
            return filePathOrUrl;
        }
    })().toLowerCase();

    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".svg")) return "image/svg+xml";
    if (pathname.endsWith(".mp4")) return "video/mp4";
    if (pathname.endsWith(".webm")) return "video/webm";
    if (pathname.endsWith(".ogg")) return "video/ogg";
    if (pathname.endsWith(".pdf")) return "application/pdf";
    return "application/octet-stream";
}

function localAssetPathFromPublicUrl(publicUrl: string): string {
    if (!env.LIBRARY_ASSETS_ROOT) {
        throw new AppError("LIBRARY_ASSETS_ROOT is not configured", 500);
    }

    let pathname: string;
    try {
        pathname = new URL(publicUrl).pathname;
    } catch {
        pathname = publicUrl;
    }

    const normalizedPathname = pathname.replace(/\\/g, "/");
    const assetsPrefix = "/assets/";
    const assetsIndex = normalizedPathname.indexOf(assetsPrefix);

    if (assetsIndex === -1) {
        throw new AppError("Library asset URL must point to the assets directory", 500);
    }

    const relativeAssetPath = decodeURIComponent(normalizedPathname.slice(assetsIndex + assetsPrefix.length));
    const rootPath = path.resolve(env.LIBRARY_ASSETS_ROOT);
    const filePath = path.resolve(rootPath, relativeAssetPath);

    if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
        throw new AppError("Invalid library asset path", 400);
    }

    return filePath;
}

async function getAccessiblePlanIds(userId: number, isAdmin: boolean): Promise<number[] | undefined> {
    if (isAdmin) return undefined;

    const user = await findUserById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (user.plan_id === null) return [];

    const plans = await getPlans();
    const currentPlan = plans.find((plan) => plan.id === user.plan_id);
    if (!currentPlan) return [];

    const currentPrice = Number(currentPlan.price);
    return plans
        .filter((plan) => plan.is_active && Number(plan.price) <= currentPrice)
        .map((plan) => plan.id);
}

async function ensureUserCanAccessLibraryItem(userId: number, isAdmin: boolean, itemPlanIds: number[]): Promise<void> {
    if (isAdmin) return;

    const accessiblePlanIds = await getAccessiblePlanIds(userId, isAdmin) ?? [];
    if (accessiblePlanIds.length === 0 || !itemPlanIds.some((planId) => accessiblePlanIds.includes(planId))) {
        throw new AppError("Your subscription plan does not include this library item", 403);
    }
}

export async function fetchLibraryRows(userId: number, isAdmin: boolean, authToken: string): Promise<LibraryCourseRow[]> {
    const accessiblePlanIds = await getAccessiblePlanIds(userId, isAdmin);
    const items = await getActiveLibraryItems(accessiblePlanIds);
    const rowsByCategory = new Map<string, LibraryCourseRow>();

    for (const item of items) {
        const existingRow = rowsByCategory.get(item.category);

        if (!existingRow) {
            rowsByCategory.set(item.category, {
                title: item.category,
                cards: [],
            });
        }

        rowsByCategory.get(item.category)?.cards.push({
            duration_seconds: item.duration_seconds,
            title: item.title,
            image: item.thumbnail_url ? libraryAssetUrl(item.id, "image", userId, authToken) : "",
            link: libraryAssetUrl(item.id, "content", userId, authToken),
            type: item.type,
            plan_ids: item.plan_ids,
        });
    }

    return Array.from(rowsByCategory.values());
}

export async function fetchLibraryCategories(userId: number, isAdmin: boolean): Promise<LibraryCategorySummary[]> {
    const accessiblePlanIds = await getAccessiblePlanIds(userId, isAdmin);
    const categories = await getLibraryCategories(accessiblePlanIds);
    return categories.map((category) => ({
        title: category.category,
        item_count: Number(category.item_count),
    }));
}

export async function fetchPaginatedLibraryItems(
    userId: number,
    isAdmin: boolean,
    authToken: string,
    page: number,
    limit: number,
    category?: string,
    search?: string,
): Promise<PaginatedLibraryResult> {
    const accessiblePlanIds = await getAccessiblePlanIds(userId, isAdmin);
    const result = await getPaginatedLibraryItems(page, limit, category, accessiblePlanIds, search);
    const totalPages = Math.ceil(result.total / limit);

    return {
        items: result.items.map((item) => ({
            duration_seconds: item.duration_seconds,
            title: item.title,
            image: item.thumbnail_url ? libraryAssetUrl(item.id, "image", userId, authToken) : "",
            link: libraryAssetUrl(item.id, "content", userId, authToken),
            type: item.type,
            plan_ids: item.plan_ids,
            category: item.category,
        })),
        pagination: {
            page,
            limit,
            total: result.total,
            total_pages: totalPages,
            has_more: page < totalPages,
        },
    };
}

export function resolveSignedLibraryAssetToken(
    token: string,
    userId: number,
    authToken: string,
): { itemId: number; kind: LibraryAssetKind } {
    let decoded: string | JwtPayload;

    try {
        decoded = jwt.verify(token, getAssetTokenSecret());
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) throw new AppError("Asset URL has expired", 401);
        throw new AppError("Invalid asset URL", 401);
    }

    const payload = decoded as Partial<LibraryAssetTokenPayload>;
    if (
        typeof decoded === "string" ||
        payload.purpose !== "library_asset" ||
        Number(payload.sub) !== userId ||
        typeof payload.item_id !== "number" ||
        !Number.isInteger(payload.item_id) ||
        payload.item_id <= 0 ||
        (payload.kind !== "image" && payload.kind !== "content") ||
        payload.session_hash !== hashSessionToken(authToken)
    ) {
        throw new AppError("Invalid asset URL", 401);
    }

    return {
        itemId: payload.item_id,
        kind: payload.kind,
    };
}

export async function getAuthorizedLibraryAsset(
    userId: number,
    isAdmin: boolean,
    itemId: number,
    kind: LibraryAssetKind,
): Promise<AuthorizedLibraryAsset> {
    const item = await getLibraryItemById(itemId);
    if (!item) throw new AppError("Library item not found", 404);

    await ensureUserCanAccessLibraryItem(userId, isAdmin, item.plan_ids);

    const sourceUrl = kind === "image" ? item.thumbnail_url : item.content_url;
    if (!sourceUrl) throw new AppError("Library asset not found", 404);

    return {
        filePath: localAssetPathFromPublicUrl(sourceUrl),
        sourceUrl,
        contentType: contentTypeFromPath(sourceUrl),
    };
}

function titleFromContentUrl(contentUrl: string): string {
    try {
        const pathname = new URL(contentUrl).pathname;
        const pathParts = pathname.split("/").filter(Boolean);
        const filename = pathParts[pathParts.length - 1] ?? "Untitled ebook";
        return decodeURIComponent(filename).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    } catch {
        return "Untitled ebook";
    }
}

function parseEbookFile(value: unknown): LibraryItemImportPayload[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new AppError("Ebook JSON must be an object grouped by category", 500);
    }

    const rows: LibraryItemImportPayload[] = [];
    const seenUrls = new Set<string>();

    for (const [categoryName, categoryItems] of Object.entries(value)) {
        if (!Array.isArray(categoryItems)) {
            throw new AppError(`Ebook category "${categoryName}" must contain an array`, 500);
        }

        for (const rawItem of categoryItems) {
            const item = rawItem as Partial<EbookJsonItem>;
            if (
                typeof item.content_url !== "string" ||
                !item.content_url ||
                typeof item.category !== "string" ||
                !item.category ||
                typeof item.type !== "string" ||
                !item.type
            ) {
                throw new AppError(`Invalid ebook record in category "${categoryName}"`, 500);
            }

            if (seenUrls.has(item.content_url)) continue;
            seenUrls.add(item.content_url);

            rows.push({
                duration_seconds: typeof item.duration_seconds === "number" && Number.isFinite(item.duration_seconds) && item.duration_seconds >= 0
                    ? item.duration_seconds : null,
                plan_ids: Array.isArray(item.plan_ids ?? item.plan_id)
                    ? (item.plan_ids ?? item.plan_id ?? []).filter((id): id is number => Number.isInteger(id) && id > 0)
                    : [],
                title: (typeof item.title === "string" && item.title.trim()
                    ? item.title.trim()
                    : titleFromContentUrl(item.content_url)).slice(0, 150),
                description: null,
                type: item.type.slice(0, 30),
                category: item.category.slice(0, 100),
                thumbnail_url: typeof item.thumbnail_url === "string" ? item.thumbnail_url : null,
                content_url: item.content_url,
                is_active: item.is_active !== false,
                sort_order: Number.isInteger(item.sort_order) ? item.sort_order as number : 0,
            });
        }
    }

    return rows;
}

export async function importEbooksFromJson(): Promise<LibraryImportResult> {
    const filePath = path.resolve(process.cwd(), "library_items.json");
    let fileContents: string;

    try {
        fileContents = await readFile(filePath, "utf8");
    } catch {
        throw new AppError("library_items.json was not found in the project root", 500);
    }

    let json: unknown;
    try {
        json = JSON.parse(fileContents);
    } catch {
        throw new AppError("library_items.json contains invalid JSON", 500);
    }

    const items = parseEbookFile(json);
    if (items.length === 0) {
        throw new AppError("The ebook JSON file contains no items", 400);
    }

    return upsertLibraryItems(items);
}
