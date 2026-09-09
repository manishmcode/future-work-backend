export interface Class {
    id: number;
    name: string;
    url: string;
    class_date: Date;
    end_time: string;
    end_date: Date;
    timezone: string;
    is_active: boolean;
    plan_ids: number[];
    created_at: Date;
    updated_at: Date;
}

export type LearnerClass = Omit<Class, "url">;

export interface CreateClassPayload {
    name: string;
    url: string;
    class_date: Date;
    end_time: string;
    end_date: Date;
    timezone: string;
    is_active?: boolean | undefined;
    plan_ids: number[];
}

export interface UpdateClassPayload {
    name?: string | undefined;
    url?: string | undefined;
    class_date?: Date | undefined;
    end_time?: string | undefined;
    end_date?: Date | undefined;
    timezone?: string | undefined;
    is_active?: boolean | undefined;
    plan_ids?: number[] | undefined;
}
