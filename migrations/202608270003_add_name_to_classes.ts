import type { Knex } from "knex";

const TABLE_NAME = "classes";
const COLUMN_NAME = "name";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.string(COLUMN_NAME, 150).nullable();
    });

    await knex(TABLE_NAME).whereNull(COLUMN_NAME).update({ [COLUMN_NAME]: "Untitled class" });

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.string(COLUMN_NAME, 150).notNullable().alter();
    });
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropColumn(COLUMN_NAME);
    });
}
