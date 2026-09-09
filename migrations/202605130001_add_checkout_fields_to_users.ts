import type { Knex } from "knex";

const TABLE_NAME = "users";
const COLUMNS = [
    { name: "phone", length: 40 },
    { name: "address", length: 255 },
    { name: "city", length: 120 },
    { name: "postal_code", length: 40 },
    { name: "country", length: 2 },
] as const;

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    for (const column of COLUMNS) {
        const hasColumn = await knex.schema.hasColumn(TABLE_NAME, column.name);
        if (hasColumn) {
            continue;
        }

        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.string(column.name, column.length).nullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    for (const column of [...COLUMNS].reverse()) {
        const hasColumn = await knex.schema.hasColumn(TABLE_NAME, column.name);
        if (!hasColumn) {
            continue;
        }

        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.dropColumn(column.name);
        });
    }
}
