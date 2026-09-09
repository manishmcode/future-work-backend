import knex, { Knex } from "knex";
import { env } from "./env";

function getConnection(): Knex.PgConnectionConfig | string {
    if (env.DATABASE_URL) {
        return env.DATABASE_URL;
    }

    return {
        host: env.DB_HOST!,
        port: env.DB_PORT ?? 5432,
        user: env.DB_USER!,
        password: env.DB_PASSWORD!,
        database: env.DB_NAME!,
    };
}

const connection: Knex.PgConnectionConfig | string = env.DATABASE_URL
    ? env.DATABASE_URL
    : getConnection();

export const db = knex({
    client: "pg",
    connection,
    pool: {
        min: 0,
        max: 10,
    },
});

export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await db.raw("SELECT 1");
        console.log("✅ Database connected successfully");
        console.log(`📊 Database: ${env.DB_NAME || "(from DATABASE_URL)"}`);
        console.log(`🔌 Host: ${env.DB_HOST || "(from DATABASE_URL)"}`);
        return true;
    } catch (error) {
        console.error("❌ Database connection failed:");
        console.error(error);
        return false;
    }
}
