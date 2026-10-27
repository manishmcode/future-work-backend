import type { Knex } from "knex";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function up(knex: Knex): Promise<void> {
    const data = JSON.parse(await readFile(path.resolve(process.cwd(), "library_items.json"), "utf8")) as
        Record<string, Array<{ content_url: string; duration_seconds?: number }>>;

    await knex.schema.alterTable("library_items", (table) => {
        table.float("duration_seconds").nullable();
    });

    // Backfill existing rows so longest-first works immediately after migration.
    for (const item of Object.values(data).flat()) {
        if (typeof item.duration_seconds === "number" && Number.isFinite(item.duration_seconds)) {
            await knex("library_items").where({ content_url: item.content_url })
                .update({ duration_seconds: item.duration_seconds });
        }
    }

    await knex.raw("CREATE INDEX library_items_duration_order_idx ON library_items (duration_seconds DESC NULLS LAST, sort_order ASC, id ASC) WHERE is_active = true");
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw("DROP INDEX IF EXISTS library_items_duration_order_idx");
    await knex.schema.alterTable("library_items", (table) => {
        table.dropColumn("duration_seconds");
    });
}
