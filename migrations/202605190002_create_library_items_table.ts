import type { Knex } from "knex";

const TABLE_NAME = "library_items";
const FILE_UPLOAD_URL = "https://futureworkacademy.net/assets";

type CourseCard = {
    title: string;
    image: string;
    link: string;
};

type CourseRowData = {
    title: string;
    cards: CourseCard[];
};

const courseRows: CourseRowData[] = [
    {
        title: "How to Easily Optimize your Images and Accelerate your Website",
        cards: [
            { title: "Optimize your images and accelerate your website", image: `${FILE_UPLOAD_URL}/first/SkillShare-Title-class04.png`, link: `${FILE_UPLOAD_URL}/first/class04-intro.mp4` },
            { title: "Benefits of optimizing images", image: `${FILE_UPLOAD_URL}/first/class02.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-02.mp4` },
            { title: "Online Tools for Image Optimization", image: `${FILE_UPLOAD_URL}/first/class03.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-03.mp4` },
            { title: "Download Images from Regular sources", image: `${FILE_UPLOAD_URL}/first/class04.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-04.mp4` },
            { title: "Optimizing Images for Regular websites", image: `${FILE_UPLOAD_URL}/first/class05.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-05.mp4` },
            { title: "Uploading Optimized Images for Regular websites", image: `${FILE_UPLOAD_URL}/first/class06.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-06.mp4` },
            { title: "Optimizing Images for High-Performance WordPress Websites", image: `${FILE_UPLOAD_URL}/first/class07.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-07.mp4` },
            { title: "Managing and Optimizing Media Library Images in WordPress", image: `${FILE_UPLOAD_URL}/first/class08.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-08.mp4` },
            { title: "End Notes & Key Takeaways", image: `${FILE_UPLOAD_URL}/first/class09.png`, link: `${FILE_UPLOAD_URL}/first/class04-lesson-09.mp4` },
            { title: "Final Thoughts & Conclusion", image: `${FILE_UPLOAD_URL}/first/class10.png`, link: `${FILE_UPLOAD_URL}/first/class04-CONCLUSION.mp4` },
        ],
    },
    {
        title: "Protect your WordPress Blog from Brute Force Attacks",
        cards: [
            { title: "How to Protect Your WordPress Blog from Brute Force Attacks", image: `${FILE_UPLOAD_URL}/second/cover-image.jpg`, link: `${FILE_UPLOAD_URL}/second/class02-lesson1.mp4` },
            { title: "Cybersecurity Basics: Brute Force Attacks", image: `${FILE_UPLOAD_URL}/second/class02.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson2c.mp4` },
            { title: "3 steps to Secure Your WordPress Blog", image: `${FILE_UPLOAD_URL}/second/class03.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson3.mp4` },
            { title: "How to Change WordPress Admin Username (Step-by-Step)", image: `${FILE_UPLOAD_URL}/second/class04.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson4.mp4` },
            { title: "How to Delete WordPress Admin Without Losing Content", image: `${FILE_UPLOAD_URL}/second/class05.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson5.mp4` },
            { title: "WordPress Display Name Mistake You Must Fix", image: `${FILE_UPLOAD_URL}/second/class06.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson6.mp4` },
            { title: "How to Hide wp-admin Login Page in WordPress", image: `${FILE_UPLOAD_URL}/second/class07.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson7.mp4` },
            { title: "Install This Plugin to Stop Hackers (WordPress)", image: `${FILE_UPLOAD_URL}/second/class08.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson8.mp4` },
            { title: "Brute Force Attacks Detected (WordPress Security Test)", image: `${FILE_UPLOAD_URL}/second/class09.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson9.mp4` },
            { title: "End Notes & Key Takeaways", image: `${FILE_UPLOAD_URL}/first/class09.png`, link: `${FILE_UPLOAD_URL}/second/class02-lesson10.mp4` },
            { title: "Final Thoughts & Conclusion", image: `${FILE_UPLOAD_URL}/first/class10.png`, link: `${FILE_UPLOAD_URL}/second/class02-CONCLUSION.mp4` },
        ],
    },
    {
        title: "Content writing - sharing",
        cards: [
            { title: "Create a Professional Blog Content Strategy", image: `${FILE_UPLOAD_URL}/third/001.png`, link: `${FILE_UPLOAD_URL}/third/001-BloggingCourseWelcome_Dec2024.mp4` },
            { title: "Plan and Strategize Your Content Effectively", image: `${FILE_UPLOAD_URL}/third/002.png`, link: `${FILE_UPLOAD_URL}/third/002-ContentWritingStrategy.mp4` },
            { title: "Choose the Right Keywords for Your Campaign", image: `${FILE_UPLOAD_URL}/third/004.png`, link: `${FILE_UPLOAD_URL}/third/004-GoogleKeywordToolSetup_JAN2025_MAIN.mp4` },
            { title: "Follow vs. No-Follow Links", image: `${FILE_UPLOAD_URL}/third/follow.png`, link: `${FILE_UPLOAD_URL}/third/026-FollowVsNoFollowLinks_2025.mp4` },
            { title: "Google E-A-T, YMYL & What Is Quality Content?", image: `${FILE_UPLOAD_URL}/third/google-eat.png`, link: `${FILE_UPLOAD_URL}/third/021-GoogleEAT.mp4` },
            { title: "LLM SEO: Large Language Model Search Engine Optimization", image: `${FILE_UPLOAD_URL}/third/LLM.png`, link: `${FILE_UPLOAD_URL}/third/050.31-LLMSEOSectionIntroduction.mp4` },
            { title: "Ideal Page Length for SEO", image: `${FILE_UPLOAD_URL}/third/seopage.png`, link: `${FILE_UPLOAD_URL}/third/032-HowLongPagesShouldBeForSEO_2023.mp4` },
            { title: "Profitable Fiverr Keyword Targeting", image: `${FILE_UPLOAD_URL}/third/fiver.png`, link: `${FILE_UPLOAD_URL}/third/085-FiverrProfitableKeyowrds.mp4` },
            { title: "How to Choose a Good Domain Name", image: `${FILE_UPLOAD_URL}/third/choosedomain.png`, link: `${FILE_UPLOAD_URL}/third/099-HowToChooseADomainIntroduction_2023.mp4` },
        ],
    },
    {
        title: "Best Google and YouTube Organic Search Engine Optimization or SEO Strategies!",
        cards: [
            { title: "NEW Way to Think About SEO!", image: `${FILE_UPLOAD_URL}/fourth/01.png`, link: `${FILE_UPLOAD_URL}/fourth/01_01AnewwaytothinkaboutSEOGetfoundeverywhereinallsearches-210201-114745.mp4` },
            { title: "How to Find Your Niche (FAST!)", image: `${FILE_UPLOAD_URL}/fourth/03.png`, link: `${FILE_UPLOAD_URL}/fourth/03_04Howtofindyournicheandseewhatyoualreadyknowthathastraffic-210201-114745.mp4` },
            { title: "Real SEO Example Explained", image: `${FILE_UPLOAD_URL}/fourth/04.png`, link: `${FILE_UPLOAD_URL}/fourth/04_05Anexampleofwhatyoucandowiththeinformationinthiscourse-210201-114745.mp4` },
            { title: "Google + YouTube = Traffic Machine", image: `${FILE_UPLOAD_URL}/fourth/05.png`, link: `${FILE_UPLOAD_URL}/fourth/05_06GoogleandYouTubesearchsecretswithWordPress-210201-115045.mp4` },
            { title: "Google SEO Secrets Revealed!", image: `${FILE_UPLOAD_URL}/fourth/06.png`, link: `${FILE_UPLOAD_URL}/fourth/06_07GoogleSEOsecretsexplainedespeciallyminimizingbounceandclickback-210201-115045.mp4` },
        ],
    },
    {
        title: "Website Hosting for beginners cPanel with Siteground account",
        cards: [
            { title: "Website Hosting", image: `${FILE_UPLOAD_URL}/fifth/01.png`, link: `${FILE_UPLOAD_URL}/fifth/01.mp4` },
            { title: "Choose Your Domain Name", image: `${FILE_UPLOAD_URL}/fifth/02.png`, link: `${FILE_UPLOAD_URL}/fifth/02.mp4` },
            { title: "Set Up Your Hosting Account", image: `${FILE_UPLOAD_URL}/fifth/03.png`, link: `${FILE_UPLOAD_URL}/fifth/03.mp4` },
            { title: "Manage Your Website with cPanel", image: `${FILE_UPLOAD_URL}/fifth/04.png`, link: `${FILE_UPLOAD_URL}/fifth/04.mp4` },
            { title: "Manage Domains & Emails", image: `${FILE_UPLOAD_URL}/fifth/05.png`, link: `${FILE_UPLOAD_URL}/fifth/05.mp4` },
            { title: "Backup & Restore Your Website", image: `${FILE_UPLOAD_URL}/fifth/06.png`, link: `${FILE_UPLOAD_URL}/fifth/06.mp4` },
            { title: "Manage Website Files", image: `${FILE_UPLOAD_URL}/fifth/07.png`, link: `${FILE_UPLOAD_URL}/fifth/07.mp4` },
            { title: "Upload Files via FTP", image: `${FILE_UPLOAD_URL}/fifth/08.png`, link: `${FILE_UPLOAD_URL}/fifth/08.mp4` },
            { title: "Set Up Your Database", image: `${FILE_UPLOAD_URL}/fifth/09.png`, link: `${FILE_UPLOAD_URL}/fifth/09.mp4` },
        ],
    },
];

const getPlanIdsForCardIndex = (cardIndex: number): number[] => {
    if (cardIndex < 4) {
        return [1, 2, 3];
    }

    if (cardIndex < 7) {
        return [1, 2];
    }

    return [3];
};

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await knex.schema.createTable(TABLE_NAME, (table) => {
        table.increments("id").primary();
        table.specificType("plan_ids", "integer[]").notNullable().defaultTo(knex.raw("'{}'::integer[]"));
        table.string("title", 150).notNullable();
        table.text("description").nullable();
        table.string("type", 30).notNullable();
        table.string("category", 100).notNullable();
        table.text("thumbnail_url").nullable();
        table.text("content_url").notNullable();
        table.boolean("is_active").notNullable().defaultTo(true);
        table.integer("sort_order").notNullable().defaultTo(0);
        table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["type"], "idx_library_items_type");
        table.index(["category"], "idx_library_items_category");
        table.index(["is_active"], "idx_library_items_is_active");
        table.index(["sort_order"], "idx_library_items_sort_order");
    });

    let sortOrder = 0;
    const libraryItems = courseRows.flatMap((row) =>
        row.cards.map((card, cardIndex) => ({
            plan_ids: getPlanIdsForCardIndex(cardIndex),
            title: card.title,
            description: null,
            type: "video",
            category: row.title,
            thumbnail_url: card.image,
            content_url: card.link,
            is_active: true,
            sort_order: sortOrder++,
        }))
    );

    await knex(TABLE_NAME).insert(libraryItems);
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TABLE_NAME);
}
