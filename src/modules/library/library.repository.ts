import { db } from "../../config/db";
import { LibraryImportResult, LibraryItem, LibraryItemImportPayload } from "./library.types";

const LIBRARY_TABLE = "library_items";

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
    "created_at",
    "updated_at",
] as const;

export async function getActiveLibraryItems(): Promise<LibraryItem[]> {
    return db<LibraryItem>(LIBRARY_TABLE)
        .select([...LIBRARY_COLUMNS])
        .where({ is_active: true })
        .orderBy("sort_order", "asc")
        .orderBy("id", "asc");
}

export async function getLibraryCategories(): Promise<Array<{ category: string; item_count: string }>> {
    return db(LIBRARY_TABLE)
        .select("category")
        .count<{ category: string; item_count: string }[]>("id as item_count")
        .where({ is_active: true })
        .groupBy("category")
        .orderByRaw("MIN(sort_order) ASC");
}

export async function getPaginatedLibraryItems(
    page: number,
    limit: number,
    category?: string,
): Promise<{ items: LibraryItem[]; total: number }> {
    const baseQuery = db<LibraryItem>(LIBRARY_TABLE).where({ is_active: true });

    if (category) {
        baseQuery.andWhere({ category });
    }

    const [items, countRow] = await Promise.all([
        baseQuery
            .clone()
            .select([...LIBRARY_COLUMNS])
            .orderBy("sort_order", "asc")
            .orderBy("id", "asc")
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
