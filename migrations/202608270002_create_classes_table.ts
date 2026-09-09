import type { Knex } from "knex";

const TABLE_NAME = "classes";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table.string("name", 150).notNullable();
        table.text("url").notNullable();
        table.timestamp("class_date", { useTz: true }).notNullable();
        table.time("end_time").notNullable();
        table.timestamp("end_date", { useTz: true }).notNullable();
        table.string("timezone", 100).notNullable().defaultTo("UTC");
        table.boolean("is_active").notNullable().defaultTo(true);
        table.specificType("plan_ids", "integer[]").notNullable().defaultTo(knex.raw("'{}'::integer[]"));
        table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["is_active"], "idx_classes_is_active");
        table.index(["class_date"], "idx_classes_date");
        table.index(["end_date"], "idx_classes_end_date");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
