import { app } from "./app";
import { checkDatabaseConnection, db } from "./config/db";
import { env } from "./config/env";

async function startServer(): Promise<void> {
    try {
        console.log("🚀 Starting server...");
        console.log(`📝 Environment: ${env.NODE_ENV}`);

        const dbConnected = await checkDatabaseConnection();

        if (!dbConnected) {
            console.error("⚠️  Server starting without database connection");
        }

        app.listen(env.PORT, () => {
            console.log(`✅ Server listening on port ${env.PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

void startServer();

async function shutdown(signal: string): Promise<void> {
    console.log(`⚠️  Received ${signal}. Shutting down gracefully...`);

    try {
        await db.destroy();
        console.log("✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
    }
}

process.on("SIGINT", () => {
    void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
