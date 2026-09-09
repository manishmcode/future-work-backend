import type { Knex } from "knex";

const TABLE_NAME = "plans";

const PLAN_ROWS = [
    {
        name: "Basic",
        price: 29.00,
        is_active: true,
        description: [
            "Access to Basic Courses",
            "Access on any device",
            "Cancel Anytime",
        ].join("\n"),
    },
    {
        name: "Premium",
        price: 99.00,
        is_active: true,
        description: [
            "Access to All Courses",
            "Access On Any Device",
            "Unlimited Downloads",
            "Unlimited Transcripts",
            "Cancel Anytime",
        ].join("\n"),
    },
    {
        name: "Standard",
        price: 59.00,
        is_active: true,
        description: [
            "Access to Advanced Courses",
            "Access on any device",
            "Limited Downloads",
            "Limited Transcripts",
            "Cancel Anytime",
        ].join("\n"),
    },
];

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table.string("name", 100).notNullable();
        table.decimal("price", 10, 2).notNullable();
        table.boolean("is_active").notNullable().defaultTo(true);
        table.text("description").nullable();
    });

    await knex(TABLE_NAME).insert(PLAN_ROWS);
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
