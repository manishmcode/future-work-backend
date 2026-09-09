import type { Knex } from "knex";

const TABLE_NAME = "user_meta";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("umeta_id").primary();
        table
            .integer("user_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("users")
            .onDelete("CASCADE");
        table.string("meta_key", 255).nullable();
        table.text("meta_value").nullable();

        table.index(["user_id"], "idx_user_meta_user_id");
        table.index(["meta_key"], "idx_user_meta_meta_key");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
