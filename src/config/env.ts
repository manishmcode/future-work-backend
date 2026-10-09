import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().optional(),
    DB_HOST: z.string().optional(),
    DB_PORT: z.coerce.number().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().optional(),
    JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    RESET_PASSWORD_SECRET: z.string().min(8, "RESET_PASSWORD_SECRET must be at least 8 characters").optional(),
    RESET_PASSWORD_EXPIRES_IN: z.string().default("30m"),
    FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL").optional(),
    FRONTEND_RESET_PASSWORD_URL: z.string().url("FRONTEND_RESET_PASSWORD_URL must be a valid URL").optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.coerce.boolean().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    MAIL_FROM_NAME: z.string().optional(),
    CATALYST_API_KEY: z.string().optional(),
    CATALYST_GATEWAY_ID: z.string().optional(),
    CATALYST_CAMPAIGN_ID: z.string().optional(),
    CATALYST_BASE_URL: z.string().url("CATALYST_BASE_URL must be a valid URL").default("https://api.staging.waverunner.ai/api/v1"),
    CATALYST_WEBHOOK_SECRET: z.string().optional(),
    CATALYST_WEBHOOK_PROFILE_ID: z.string().optional(),
    CATALYST_CURRENCY: z.string().default("EUR"),
    CATALYST_DEFAULT_COUNTRY: z.string().default("DE"),
    SUPPORT_EMAIL: z.string().optional(),
    LIBRARY_ASSETS_ROOT: z.string().optional(),
    LIBRARY_ASSET_TOKEN_SECRET: z.string().min(8, "LIBRARY_ASSET_TOKEN_SECRET must be at least 8 characters").optional(),
    LIBRARY_ASSET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid environment variables: ${message}`);
}

const hasConnectionString = Boolean(parsed.data.DATABASE_URL);
const hasDiscreteDbConfig = Boolean(
    parsed.data.DB_HOST &&
    parsed.data.DB_PORT &&
    parsed.data.DB_USER &&
    parsed.data.DB_PASSWORD &&
    parsed.data.DB_NAME,
);

if (!hasConnectionString && !hasDiscreteDbConfig) {
    throw new Error(
        "Database config is missing. Set DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.",
    );
}

export const env = parsed.data;
