import type { Knex } from "knex";

const TABLE_NAME = "subscriptions";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table
            .integer("user_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("users")
            .onDelete("CASCADE");
        table.string("plan_name", 100).notNullable();
        table.decimal("price", 10, 2).notNullable();
        table.string("status", 30).notNullable().defaultTo("active");
        table.string("payment_status", 30).notNullable().defaultTo("mock_success");
        table.string("payment_reference", 120).notNullable();
        table.timestamp("starts_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("ends_at", { useTz: true }).nullable();
        table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["user_id"], "idx_subscriptions_user_id");
        table.index(["status"], "idx_subscriptions_status");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
