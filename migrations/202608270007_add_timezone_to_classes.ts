import type { Knex } from "knex";

const TABLE_NAME = "classes";

export async function up(knex: Knex): Promise<void> {
    if (!await knex.schema.hasTable(TABLE_NAME)) return;

    const hasTimezone = await knex.schema.hasColumn(TABLE_NAME, "timezone");
    const hasEndDate = await knex.schema.hasColumn(TABLE_NAME, "end_date");

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        if (!hasTimezone) table.string("timezone", 100).nullable();
        if (!hasEndDate) table.timestamp("end_date", { useTz: true }).nullable();
    });

    if (!hasTimezone) {
        await knex(TABLE_NAME).whereNull("timezone").update({ timezone: "Asia/Kolkata" });
        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.string("timezone", 100).notNullable().defaultTo("UTC").alter();
        });
    }

    if (!hasEndDate) {
        await knex.raw(`
            UPDATE classes
            SET end_date = (
                ((class_date AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata'))::date + end_time)
                AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata')
            )
            WHERE end_date IS NULL
        `);
        await knex.schema.alterTable(TABLE_NAME, (table) => {
            table.timestamp("end_date", { useTz: true }).notNullable().alter();
            table.index(["end_date"], "idx_classes_end_date");
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    if (!await knex.schema.hasTable(TABLE_NAME)) return;

    const hasTimezone = await knex.schema.hasColumn(TABLE_NAME, "timezone");
    const hasEndDate = await knex.schema.hasColumn(TABLE_NAME, "end_date");

    await knex.schema.alterTable(TABLE_NAME, (table) => {
        if (hasEndDate) {
            table.dropIndex(["end_date"], "idx_classes_end_date");
            table.dropColumn("end_date");
        }
        if (hasTimezone) table.dropColumn("timezone");
    });
}
