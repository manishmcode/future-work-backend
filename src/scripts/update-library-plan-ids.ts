import { db } from "../config/db";

const LIBRARY_TABLE = "library_items";

const CATEGORY_PLAN_IDS: Record<string, number[]> = {
    "How to Easily Optimize your Images and Accelerate your Website": [1],
    "Protect your WordPress Blog from Brute Force Attacks": [2],
    "Content writing - sharing": [3],
    "Best Google and YouTube Organic Search Engine Optimization or SEO Strategies!": [3],
    "Website Hosting for beginners cPanel with Siteground account": [3],
};

async function updateLibraryPlanIds(): Promise<void> {
    let updatedCount = 0;

    for (const [category, planIds] of Object.entries(CATEGORY_PLAN_IDS)) {
        const updatedRows = await db(LIBRARY_TABLE)
            .where({ category })
            .update({
                plan_ids: planIds,
                updated_at: db.fn.now(),
            });

        updatedCount += updatedRows;
    }

    console.log(`Updated plan_ids for ${updatedCount} library items.`);
}

updateLibraryPlanIds()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.destroy();
    });
