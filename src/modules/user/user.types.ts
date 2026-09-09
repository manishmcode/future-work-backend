export interface User {
    id: number;
    name: string;
    email: string;
    password: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    plan_id: number | null;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
}

export type PublicUser = Pick<User, "id" | "name" | "email" | "plan_id" | "is_admin" | "created_at" | "updated_at">;

export interface UserProfile extends PublicUser {
    user_meta: Record<string, unknown>;
}

export interface UserMetaRow {
    umeta_id: number;
    user_id: number;
    meta_key: string | null;
    meta_value: string | null;
}

export interface UpdateProfilePayload {
    firstname: string;
    lastname: string;
    display_name: string;
}

