/**
 * Script to clean stale migration records from knex_migrations table.
 * Removes any records for migration files that no longer exist on disk.
 *
 * Usage: npm run migrate:cleanup
 */
import fs from "fs";
import path from "path";
import { db } from "../src/config/db";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function cleanup() {
    // Get all migration filenames on disk
    const filesOnDisk = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".ts"));

    console.log(`📂 Migration files on disk (${filesOnDisk.length}):`);
    filesOnDisk.forEach((f) => console.log(`   ✅ ${f}`));

    // Get all migration records from DB
    const rows = await db("knex_migrations").select("id", "name");
    console.log(`\n📊 Migration records in DB (${rows.length}):`);
    rows.forEach((r: any) => console.log(`   ${filesOnDisk.includes(r.name) ? "✅" : "❌"} ${r.name}`));

    // Find stale records (in DB but not on disk)
    const stale = rows.filter((r: any) => !filesOnDisk.includes(r.name));

    if (stale.length === 0) {
        console.log("\n✅ No stale migration records found. Everything is clean!");
        await db.destroy();
        return;
    }

    console.log(`\n🗑️  Removing ${stale.length} stale migration record(s)...`);
    const staleNames = stale.map((r: any) => r.name);
    await db("knex_migrations").whereIn("name", staleNames).del();

    console.log("✅ Stale records removed:");
    staleNames.forEach((n: string) => console.log(`   🗑️  ${n}`));
    console.log("\nYou can now run: npm run migrate:latest");

    await db.destroy();
}

cleanup().catch((err) => {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
});
