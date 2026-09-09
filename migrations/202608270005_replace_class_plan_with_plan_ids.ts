import type { Knex } from "knex";

const TABLE_NAME = "classes";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    const hasPlanId = await knex.schema.hasColumn(TABLE_NAME, "plan_id");
    const hasPlanIds = await knex.schema.hasColumn(TABLE_NAME, "plan_ids");

    if (!hasPlanIds) {
        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.specificType("plan_ids", "integer[]").notNullable().defaultTo(knex.raw("'{}'::integer[]"));
        });
    }

    if (hasPlanId) {
        await knex(TABLE_NAME).whereNotNull("plan_id").update({
            plan_ids: knex.raw("ARRAY[plan_id]"),
        });
        await knex.raw("DROP INDEX IF EXISTS idx_classes_plan_id");
        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.dropColumn("plan_id");
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, "plan_ids")) return;

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.integer("plan_id").unsigned().nullable().references("id").inTable("plans").onDelete("CASCADE");
    });
    await knex(TABLE_NAME).update({ plan_id: knex.raw("plan_ids[1]") });
    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.index(["plan_id"], "idx_classes_plan_id");
        table.dropColumn("plan_ids");
    });
}
