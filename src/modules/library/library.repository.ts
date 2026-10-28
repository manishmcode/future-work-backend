import { db } from "../../config/db";
import { LibraryImportResult, LibraryItem, LibraryItemImportPayload } from "./library.types";

const LIBRARY_TABLE = "library_items";

// Normalize spacing and capitalization without changing stored category names.
const CATEGORY_PRIORITIES: Array<[string, number]> = [
    ["Boost Your Google and YouTube Rankings with SEO", 0],
    // Keep the previous SEO title in the same position until all environments are renamed.
    ["Best Google and YouTube Organic Search Engine Optimization or SEO Strategies!", 0],
    ["The Organized Life", 1],
    ["Smart Time Launchpad", 2],
    ["Zoom Meeting Masterclass", 3],
    ["Productivity Mastery", 4],
];

const LIBRARY_COLUMNS = [
    "id",
    "plan_ids",
    "title",
    "description",
    "type",
    "category",
    "thumbnail_url",
    "content_url",
    "is_active",
    "sort_order",
    "duration_seconds",
    "created_at",
    "updated_at",
] as const;

function applyPlanAccessFilter(
    query: { whereRaw: (sql: string, bindings?: unknown[]) => unknown },
    accessiblePlanIds?: number[],
): void {
    if (accessiblePlanIds === undefined) return;
    if (accessiblePlanIds.length === 0) {
        query.whereRaw("false");
        return;
    }

    query.whereRaw(`plan_ids && ARRAY[${accessiblePlanIds.map(() => "?").join(",")}]::integer[]`, accessiblePlanIds);
}

export async function getActiveLibraryItems(accessiblePlanIds?: number[]): Promise<LibraryItem[]> {
    const query = db<LibraryItem>(LIBRARY_TABLE)
        .select([...LIBRARY_COLUMNS])
        .where({ is_active: true })
        .orderBy("sort_order", "asc")
        .orderBy("id", "asc");

    applyPlanAccessFilter(query, accessiblePlanIds);

    return query;
}

export async function getLibraryItemById(id: number): Promise<LibraryItem | undefined> {
    return db<LibraryItem>(LIBRARY_TABLE)
        .select([...LIBRARY_COLUMNS])
        .where({ id, is_active: true })
        .first();
}

export async function getLibraryCategories(accessiblePlanIds?: number[]): Promise<Array<{ category: string; item_count: string }>> {
    const query = db(LIBRARY_TABLE)
        .select("category")
        .count<{ category: string; item_count: string }[]>("id as item_count")
        .where({ is_active: true })
        .groupBy("category")
        .orderByRaw(
            `CASE regexp_replace(lower(category), '[^a-z0-9]', '', 'g') ${CATEGORY_PRIORITIES.map(() => "WHEN ? THEN ?").join(" ")} ELSE 5 END ASC`,
            CATEGORY_PRIORITIES.flatMap(([name, priority]) => [name.toLowerCase().replace(/[^a-z0-9]/g, ""), priority]),
        )
        .orderByRaw("MIN(sort_order) ASC");

    applyPlanAccessFilter(query, accessiblePlanIds);

    return query;
}

export async function getPaginatedLibraryItems(
    page: number,
    limit: number,
    category?: string,
    accessiblePlanIds?: number[],
    search?: string,
): Promise<{ items: LibraryItem[]; total: number }> {
    const baseQuery = db<LibraryItem>(LIBRARY_TABLE).where({ is_active: true });

    applyPlanAccessFilter(baseQuery, accessiblePlanIds);

    if (category) {
        baseQuery.andWhere({ category });
    }

    if (search) {
        baseQuery.whereILike("title", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
    }

    const orderedQuery = baseQuery.clone().select([...LIBRARY_COLUMNS]);
    if (!category) orderedQuery.orderBy("duration_seconds", "desc", "last");
    orderedQuery.orderBy("sort_order", "asc").orderBy("id", "asc");

    const [items, countRow] = await Promise.all([
        orderedQuery
            .limit(limit)
            .offset((page - 1) * limit),
        baseQuery.clone().count<{ count: string }>("id as count").first(),
    ]);

    return {
        items,
        total: Number(countRow?.count ?? 0),
    };
}

export async function upsertLibraryItems(items: LibraryItemImportPayload[]): Promise<LibraryImportResult> {
    return db.transaction(async (trx) => {
        const existingRows = await trx<LibraryItem>(LIBRARY_TABLE)
            .select("id", "content_url")
            .whereIn("content_url", items.map((item) => item.content_url));
        const existingByUrl = new Map(existingRows.map((row) => [row.content_url, row.id]));
        const itemsToInsert = items.filter((item) => !existingByUrl.has(item.content_url));
        const itemsToUpdate = items.filter((item) => existingByUrl.has(item.content_url));

        for (const item of itemsToUpdate) {
            await trx(LIBRARY_TABLE)
                .where({ id: existingByUrl.get(item.content_url) })
                .update({ ...item, updated_at: trx.fn.now() });
        }

        const chunkSize = 500;
        for (let index = 0; index < itemsToInsert.length; index += chunkSize) {
            await trx(LIBRARY_TABLE).insert(itemsToInsert.slice(index, index + chunkSize));
        }

        return {
            total: items.length,
            inserted: itemsToInsert.length,
            updated: itemsToUpdate.length,
        };
    });
}
