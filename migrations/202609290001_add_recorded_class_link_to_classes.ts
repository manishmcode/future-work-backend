import type { Knex } from "knex";

const TABLE_NAME = "classes";
const COLUMN_NAME = "recorded_class_link";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.text(COLUMN_NAME).nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropColumn(COLUMN_NAME);
    });
}
