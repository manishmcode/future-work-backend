import type { Knex } from "knex";

const TABLE_NAME = "subscriptions";
const COLUMN_NAME = "plan_id";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table
            .integer(COLUMN_NAME)
            .unsigned()
            .nullable()
            .references("id")
            .inTable("plans")
            .onDelete("SET NULL");
        table.index([COLUMN_NAME], "idx_subscriptions_plan_id");
    });

    await knex.raw(`
        UPDATE subscriptions AS subscriptions
        SET plan_id = plans.id
        FROM plans
        WHERE LOWER(subscriptions.plan_name) = LOWER(plans.name)
          AND subscriptions.plan_id IS NULL
    `);
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME)) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropIndex([COLUMN_NAME], "idx_subscriptions_plan_id");
        table.dropColumn(COLUMN_NAME);
    });
}
