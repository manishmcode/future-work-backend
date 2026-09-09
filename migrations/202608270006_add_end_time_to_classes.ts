import type { Knex } from "knex";

const TABLE_NAME = "classes";
const COLUMN_NAME = "end_time";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.time(COLUMN_NAME).nullable();
    });

    await knex(TABLE_NAME).whereNull(COLUMN_NAME).update({
        [COLUMN_NAME]: knex.raw("(class_date + interval '1 hour')::time"),
    });

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.time(COLUMN_NAME).notNullable().alter();
    });
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropColumn(COLUMN_NAME);
    });
}
