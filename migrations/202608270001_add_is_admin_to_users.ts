import type { Knex } from "knex";

const TABLE_NAME = "users";
const COLUMN_NAME = "is_admin";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.boolean(COLUMN_NAME).notNullable().defaultTo(false);
        table.index([COLUMN_NAME], "idx_users_is_admin");
    });
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropIndex([COLUMN_NAME], "idx_users_is_admin");
        table.dropColumn(COLUMN_NAME);
    });
}
