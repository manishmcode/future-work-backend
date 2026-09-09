import type { Knex } from "knex";

const TABLE_NAME = "contact_us";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table.string("email", 255).notNullable();
        table.text("message").nullable();
        table.jsonb("options").nullable();
        table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["email"], "idx_contact_us_email");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
