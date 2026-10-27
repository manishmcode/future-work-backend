export interface LibraryItem {
    id: number;
    plan_ids: number[];
    title: string;
    description: string | null;
    type: string;
    category: string;
    thumbnail_url: string | null;
    content_url: string;
    is_active: boolean;
    sort_order: number;
    duration_seconds: number | null;
    created_at: Date;
    updated_at: Date;
}

export interface LibraryCourseCard {
    duration_seconds: number | null;
    title: string;
    image: string;
    link: string;
    type: string;
    plan_ids: number[];
}

export interface LibraryCourseRow {
    title: string;
    cards: LibraryCourseCard[];
}

export interface EbookJsonItem {
    duration_seconds?: number | null;
    title?: string;
    type: string;
    category: string;
    content_url: string;
    thumbnail_url?: string | null;
    sort_order?: number;
    is_active?: boolean;
    plan_id?: number[];
    plan_ids?: number[];
}

export interface LibraryItemImportPayload {
    duration_seconds: number | null;
    plan_ids: number[];
    title: string;
    description: null;
    type: string;
    category: string;
    thumbnail_url: string | null;
    content_url: string;
    is_active: boolean;
    sort_order: number;
}

export interface LibraryImportResult {
    total: number;
    inserted: number;
    updated: number;
}

export interface LibraryCategorySummary {
    title: string;
    item_count: number;
}

export interface PaginatedLibraryCard extends LibraryCourseCard {
    category: string;
}

export interface PaginatedLibraryResult {
    items: PaginatedLibraryCard[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
}
