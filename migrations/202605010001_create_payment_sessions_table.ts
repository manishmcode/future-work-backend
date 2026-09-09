import type { Knex } from "knex";

const TABLE_NAME = "payment_sessions";

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table
            .integer("user_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("users")
            .onDelete("CASCADE");

        // CatalystPay session token (ps_...)
        table.string("session_token", 255).notNullable().unique();

        // Plan / pricing info captured at session creation time
        table.string("plan_name", 100).notNullable();
        table.decimal("amount", 10, 2).notNullable();
        table.string("currency", 10).notNullable().defaultTo("EUR");
        table.string("billing_type", 30).notNullable().defaultTo("RECURRING");
        table.string("billing_frequency", 30).notNullable().defaultTo("MONTHLY");

        // Lifecycle
        table.string("status", 50).notNullable().defaultTo("PENDING");
        // The HPP payment URL returned by CatalystPay
        table.text("payment_url").nullable();

        // CatalystPay entity references populated via webhook
        table.string("catalyst_order_id", 255).nullable();
        table.string("catalyst_order_number", 100).nullable();
        table.string("catalyst_subscription_id", 255).nullable();
        table.string("catalyst_transaction_id", 255).nullable();
        table.string("iban_last4", 10).nullable();

        // Raw webhook payload stored for audit / reconciliation
        table.jsonb("webhook_payload").nullable();

        // Once the subscription is activated this links to it
        table
            .integer("subscription_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("subscriptions")
            .onDelete("SET NULL");

        table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["user_id"], "idx_payment_sessions_user_id");
        table.index(["session_token"], "idx_payment_sessions_session_token");
        table.index(["status"], "idx_payment_sessions_status");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
