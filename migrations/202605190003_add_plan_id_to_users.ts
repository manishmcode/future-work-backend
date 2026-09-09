import type { Knex } from "knex";

const TABLE_NAME = "users";
const COLUMN_NAME = "plan_id";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
    if (hasColumn) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table
            .integer(COLUMN_NAME)
            .unsigned()
            .nullable()
            .references("id")
            .inTable("plans")
            .onDelete("SET NULL");

        table.index([COLUMN_NAME], "idx_users_plan_id");
    });
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
    if (!hasColumn) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropIndex([COLUMN_NAME], "idx_users_plan_id");
        table.dropColumn(COLUMN_NAME);
    });
}
