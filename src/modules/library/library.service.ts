import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../common/errors/app-error";
import {
    getActiveLibraryItems,
    getLibraryCategories,
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

export async function fetchLibraryRows(): Promise<LibraryCourseRow[]> {
    const items = await getActiveLibraryItems();
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
            title: item.title,
            image: item.thumbnail_url ?? "",
            link: item.content_url,
            plan_ids: item.plan_ids,
        });
    }

    return Array.from(rowsByCategory.values());
}

export async function fetchLibraryCategories(): Promise<LibraryCategorySummary[]> {
    const categories = await getLibraryCategories();
    return categories.map((category) => ({
        title: category.category,
        item_count: Number(category.item_count),
    }));
}

export async function fetchPaginatedLibraryItems(
    page: number,
    limit: number,
    category?: string,
): Promise<PaginatedLibraryResult> {
    const result = await getPaginatedLibraryItems(page, limit, category);
    const totalPages = Math.ceil(result.total / limit);

    return {
        items: result.items.map((item) => ({
            title: item.title,
            image: item.thumbnail_url ?? "",
            link: item.content_url,
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
