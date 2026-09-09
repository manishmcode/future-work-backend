import type { Knex } from "knex";

const TABLE_NAME = "subscriptions";

const NEW_COLUMNS = [
    { name: "currency", length: 10 },
    { name: "billing_frequency", length: 30 },
    { name: "catalyst_session_token", length: 255 },
    { name: "catalyst_subscription_id", length: 255 },
    { name: "catalyst_transaction_id", length: 255 },
    { name: "iban_last4", length: 10 },
];

export async function up(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable(TABLE_NAME);
    if (!hasTable) return;

    for (const col of NEW_COLUMNS) {
        const has = await knex.schema.hasColumn(TABLE_NAME, col.name);
        if (!has) {
            await knex.schema.alterTable(TABLE_NAME, (table) => {
                table.string(col.name, col.length).nullable();
            });
        }
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable(TABLE_NAME);
    if (!hasTable) return;

    for (const col of NEW_COLUMNS) {
        const has = await knex.schema.hasColumn(TABLE_NAME, col.name);
        if (has) {
            await knex.schema.alterTable(TABLE_NAME, (table) => {
                table.dropColumn(col.name);
            });
        }
    }
}
