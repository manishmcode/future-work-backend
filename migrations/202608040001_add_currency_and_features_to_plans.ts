import type { Knex } from "knex";

const TABLE_NAME = "plans";

interface ExistingPlan {
    id: number;
    name: string;
    description: string | null;
}

function isIncluded(planName: string, featureName: string): boolean {
    const plan = planName.trim().toLowerCase();
    const feature = featureName.trim().toLowerCase();

    if (feature.startsWith("no ")) return false;
    if (feature === "unlimited access" && ["basic", "standard"].includes(plan)) return false;

    return true;
}

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.string("currency", 3).notNullable().defaultTo("EUR");
        table.jsonb("features").notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    });

    const plans = await knex<ExistingPlan>(TABLE_NAME).select("id", "name", "description");

    for (const plan of plans) {
        const features = (plan.description ?? "")
            .split(/\r?\n/)
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({ name, is_included: isIncluded(plan.name, name) }));

        await knex(TABLE_NAME).where({ id: plan.id }).update({
            currency: "EUR",
            features: JSON.stringify(features),
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
        table.dropColumn("features");
        table.dropColumn("currency");
    });
}
