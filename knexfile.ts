import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

function getConnection(): Knex.PgConnectionConfig | string {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    return {
        host: process.env.DB_HOST!,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
    };
}

const config: Knex.Config = {
    client: "pg",
    connection: getConnection(),
    pool: {
        min: 0,
        max: 10,
    },
    migrations: {
        directory: "./migrations",
        extension: "ts",
    },
};

export default config;
