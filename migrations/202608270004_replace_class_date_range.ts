import type { Knex } from "knex";

const TABLE_NAME = "classes";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists) return;

    const hasStartDate = await knex.schema.hasColumn(TABLE_NAME, "start_date");
    const hasEndDate = await knex.schema.hasColumn(TABLE_NAME, "end_date");
    const hasClassDate = await knex.schema.hasColumn(TABLE_NAME, "class_date");

    if (hasStartDate || hasEndDate) {
        await knex.raw("DROP INDEX IF EXISTS idx_classes_schedule");
    }

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        if (hasStartDate && !hasClassDate) table.renameColumn("start_date", "class_date");
        if (hasEndDate) table.dropColumn("end_date");
    });

    if (hasStartDate && !hasClassDate) {
        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.index(["class_date"], "idx_classes_date");
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (!exists || !await knex.schema.hasColumn(TABLE_NAME, "class_date")) return;

    await knex.raw("DROP INDEX IF EXISTS idx_classes_date");
    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.renameColumn("class_date", "start_date");
        table.timestamp("end_date", { useTz: true }).nullable();
        table.index(["start_date", "end_date"], "idx_classes_schedule");
    });
}
